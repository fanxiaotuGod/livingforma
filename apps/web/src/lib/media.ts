import { useEffect, useMemo, useRef, useState } from 'react';
import { MEDIA_LIMITS, type MediaCapabilities, type MediaSession } from '@livingforma/contracts';
import { getIdentity, protectedRequest, rawRequest, request } from './session-client';
import { MEDIA_STOP_EVENT, stopLocalDevices } from './media-events';

const abortError = () => new DOMException('Media activity was cancelled.', 'AbortError');
export const isCancelled = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
export function mediaError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Device access was not allowed. You can keep using the text box.';
    if (error.name === 'NotFoundError') return 'No matching device was found. Connect one, or keep using text.';
    if (error.name === 'NotReadableError') return 'This device is busy in another app. Close it there and try again.';
  }
  return error instanceof Error ? error.message : 'This media request could not be completed. Please try again.';
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

/** Emits a canonical 44-byte WAV header followed by little-endian mono PCM16. */
export function encodeMonoWav(samples: Float32Array, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const data = new DataView(buffer);
  const ascii = (offset: number, text: string) => [...text].forEach((letter, i) => data.setUint8(offset + i, letter.charCodeAt(0)));
  ascii(0, 'RIFF'); data.setUint32(4, buffer.byteLength - 8, true); ascii(8, 'WAVE');
  ascii(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
  data.setUint16(22, 1, true); data.setUint32(24, sampleRate, true);
  data.setUint32(28, sampleRate * 2, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
  ascii(36, 'data'); data.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const value = Math.max(-1, Math.min(1, Number.isFinite(sample) ? sample : 0));
    data.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  });
  return new Uint8Array(buffer);
}

export async function recordingToWav(blob: Blob, signal: AbortSignal) {
  signal.throwIfAborted();
  const context = new AudioContext();
  const abort = () => { void context.close().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    signal.throwIfAborted();
    const sampleRate = 16000;
    // Trim container padding beyond the hard recording limit, then let the server
    // independently validate the resulting PCM length and format.
    const length = Math.min(Math.floor(decoded.duration * sampleRate), MEDIA_LIMITS.maxRecordingSeconds * sampleRate);
    if (length < sampleRate / 10) throw new Error('That recording was too short. Please try a few words.');
    const offline = new OfflineAudioContext(1, length, sampleRate);
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
    const converted = await offline.startRendering();
    signal.throwIfAborted();
    return encodeMonoWav(converted.getChannelData(0), sampleRate);
  } finally {
    signal.removeEventListener('abort', abort);
    if (context.state !== 'closed') await context.close().catch(() => {});
  }
}

export async function captureJpeg(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) throw new Error('The camera is still warming up. Try again in a moment.');
  const canvas = document.createElement('canvas');
  const ratio = Math.min(1, 960 / video.videoWidth, 720 / video.videoHeight);
  canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
  canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot capture a camera frame.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const quality of [.78, .58, .38]) {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Unable to capture this frame.')), 'image/jpeg', quality));
    if (blob.size <= MEDIA_LIMITS.maxImageBytes) return new Uint8Array(await blob.arrayBuffer());
  }
  throw new Error('This frame is too large to send. Try a less detailed view.');
}

/** One finite, local-only device session. No media is persisted in application state. */
export class DeviceSession {
  private epoch = 0;
  private sequence = 0;
  private controller: AbortController | null = null;
  private session: MediaSession | null = null;
  private stream: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private cleanups = new Set<() => void>();
  onStopped: ((reason: string) => void) | null = null;

  private readonly accountId = getIdentity().session?.user?.id ?? null;
  constructor(readonly slug: string, readonly kind: 'voice' | 'scene', private csrf: string | null) {}
  get signal() { if (!this.controller) throw abortError(); return this.controller.signal; }
  get active() { return this.session !== null && !this.controller?.signal.aborted; }
  valid(token: number) { return this.active && this.epoch === token; }
  private endpoint(id: string) { return `/api/spaces/${encodeURIComponent(this.slug)}/media/sessions/${encodeURIComponent(id)}`; }
  private endRemote(session: MediaSession) {
    void rawRequest(this.endpoint(session.id), { method: 'DELETE', keepalive: true }, this.csrf).catch(() => {});
  }
  addCleanup(fn: () => void) { this.cleanups.add(fn); return () => this.cleanups.delete(fn); }

  async begin() {
    stopLocalDevices('Another media activity started.');
    this.stop();
    const token = this.epoch;
    this.controller = new AbortController();
    const session = await protectedRequest<MediaSession>(`/api/spaces/${encodeURIComponent(this.slug)}/media/sessions`, {
      method: 'POST', body: JSON.stringify({ kind: this.kind }), signal: this.signal,
    }, this.accountId);
    if (this.epoch !== token || this.signal.aborted) { this.endRemote(session); throw abortError(); }
    this.session = session; this.sequence = 0;
    const remaining = Math.min(MEDIA_LIMITS.maxSessionSeconds * 1000, Date.parse(session.expiresAt) - Date.now());
    if (!Number.isFinite(remaining) || remaining <= 0) { this.stop('This device session expired. Please start again.'); throw abortError(); }
    const expiry = setTimeout(() => this.stop('This device session expired. Please start again.'), remaining);
    this.addCleanup(() => clearTimeout(expiry));
    return token;
  }

  attach(stream: MediaStream, token: number) {
    if (!this.valid(token)) { stream.getTracks().forEach(track => track.stop()); throw abortError(); }
    this.stream = stream;
    const ended = () => this.stop('The device disconnected. You can reconnect it and start again.');
    for (const track of stream.getTracks()) track.addEventListener('ended', ended, { once: true });
    this.addCleanup(() => stream.getTracks().forEach(track => track.removeEventListener('ended', ended)));
  }
  releaseTracks() { this.stream?.getTracks().forEach(track => track.stop()); this.stream = null; }
  async send<T extends { sequence: number }>(path: 'transcribe' | 'observe', body: Record<string, unknown>, token: number) {
    if (!this.valid(token) || !this.session) throw abortError();
    const sequence = ++this.sequence;
    const result = await protectedRequest<T>(`${this.endpoint(this.session.id)}/${path}`, {
      method: 'POST', body: JSON.stringify({ ...body, sequence }), signal: this.signal,
    }, this.accountId);
    if (!this.valid(token) || result.sequence !== sequence || this.sequence !== sequence) throw abortError();
    return result;
  }
  stopPlayback() {
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); this.audio.onended = null; this.audio.onerror = null; this.audio = null; }
    if (this.audioUrl) { URL.revokeObjectURL(this.audioUrl); this.audioUrl = null; }
  }
  async play(base64: string, token: number, onEnd: () => void) {
    if (!this.valid(token)) throw abortError();
    this.stopPlayback();
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    this.audioUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
    const player = new Audio(this.audioUrl); this.audio = player;
    player.onended = () => { if (this.valid(token) && this.audio === player) { this.stopPlayback(); onEnd(); } };
    player.onerror = () => { if (this.valid(token) && this.audio === player) { this.stopPlayback(); onEnd(); } };
    try { await player.play(); if (!this.valid(token)) this.stopPlayback(); }
    catch (error) { this.stopPlayback(); throw error; }
  }
  stop(reason = '') {
    const hadWork = !!this.controller || !!this.session || !!this.stream || !!this.audio;
    this.epoch++;
    this.controller?.abort(); this.controller = null;
    for (const cleanup of this.cleanups) cleanup(); this.cleanups.clear();
    this.releaseTracks(); this.stopPlayback();
    const session = this.session; this.session = null;
    if (session) this.endRemote(session);
    if (hadWork) this.onStopped?.(reason);
  }
}

export function useDeviceSession(slug: string, csrf: string | null, kind: 'voice' | 'scene', onStopped: (reason: string) => void) {
  const callback = useRef(onStopped); callback.current = onStopped;
  const device = useMemo(() => new DeviceSession(slug, kind, csrf), [slug, kind, csrf]);
  useEffect(() => {
    device.onStopped = reason => callback.current(reason);
    const stop = (event: Event) => device.stop((event as CustomEvent<string>).detail || 'Media stopped.');
    const hide = () => { if (document.hidden) device.stop('Media stopped when you left this tab.'); };
    const leave = () => device.stop();
    window.addEventListener(MEDIA_STOP_EVENT, stop); window.addEventListener('pagehide', leave); document.addEventListener('visibilitychange', hide);
    return () => { device.onStopped = null; device.stop(); window.removeEventListener(MEDIA_STOP_EVENT, stop); window.removeEventListener('pagehide', leave); document.removeEventListener('visibilitychange', hide); };
  }, [device]);
  return device;
}

export function useMediaCapabilities(slug: string, enabled: boolean) {
  const [capabilities, setCapabilities] = useState<MediaCapabilities | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) { setCapabilities(null); return; }
    const controller = new AbortController(); setError('');
    request<MediaCapabilities>(`/api/spaces/${encodeURIComponent(slug)}/media`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setCapabilities(result); })
      .catch(error => { if (!controller.signal.aborted) setError(mediaError(error)); });
    return () => controller.abort();
  }, [slug, enabled]);
  return { capabilities, error };
}
