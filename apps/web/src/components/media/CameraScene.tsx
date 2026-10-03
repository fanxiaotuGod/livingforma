import { useEffect, useRef, useState } from 'react';
import { Cross2Icon, SpeakerLoudIcon, SpeakerOffIcon, StopIcon, VideoIcon } from '@radix-ui/react-icons';
import { MEDIA_LIMITS, type MediaObservation } from '@livingforma/contracts';
import { RequestError } from '../../lib/client';
import { bytesToBase64, captureJpeg, isCancelled, mediaError, useDeviceSession, useMediaCapabilities } from '../../lib/media';

type CameraPhase = 'idle' | 'starting' | 'preview' | 'observing' | 'speaking';
export function CameraScene({ slug, csrf, isOwner }: { slug: string; csrf: string | null; isOwner: boolean }) {
  const [phase, setPhase] = useState<CameraPhase>('idle'), [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState(''), [note, setNote] = useState(''), [observation, setObservation] = useState<MediaObservation | null>(null);
  const [frames, setFrames] = useState(0), [remaining, setRemaining] = useState(0);
  const [automatic, setAutomatic] = useState(false), [speak, setSpeak] = useState(true);
  const video = useRef<HTMLVideoElement>(null), token = useRef(-1), inFlight = useRef(false), started = useRef(false), frameCount = useRef(0), lastFrame = useRef(0);
  const speechEnabled = useRef(speak); speechEnabled.current = speak;
  const device = useDeviceSession(slug, csrf, 'scene', reason => {
    inFlight.current = false; started.current = false; frameCount.current = 0; lastFrame.current = 0;
    setStream(null); setPhase('idle'); setFrames(0); setRemaining(0); setAutomatic(false); setObservation(null); setNote(reason);
  });
  const { capabilities, error: capabilityError } = useMediaCapabilities(slug, isOwner);
  useEffect(() => { if (!isOwner) device.stop(); }, [isOwner, device]);
  useEffect(() => {
    if (!video.current) return;
    const element = video.current; element.srcObject = stream;
    if (stream) void element.play().catch(() => setError('The preview could not start. Stop the camera and try again.'));
    return () => { element.pause(); element.srcObject = null; };
  }, [stream]);
  useEffect(() => {
    if (!stream) return;
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((lastFrame.current + MEDIA_LIMITS.minimumFrameIntervalMs - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
  }, [stream]);
  useEffect(() => {
    if (!automatic || !stream || inFlight.current || frameCount.current >= MEDIA_LIMITS.maxFramesPerSession) return;
    const timer = setTimeout(() => { void observe(); }, Math.max(0, lastFrame.current + MEDIA_LIMITS.minimumFrameIntervalMs - Date.now()));
    return () => clearTimeout(timer);
  }, [automatic, stream, phase, frames]);

  async function start() {
    if (!isOwner || started.current || !capabilities?.canObserve) return;
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access is not supported in this browser.'); return; }
    started.current = true; setError(''); setNote('');
    let current = -1;
    try {
      const opening = device.begin(); setPhase('starting'); current = await opening; token.current = current;
      const source = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'environment' }, audio: false });
      device.attach(source, current); setStream(source); setPhase('preview');
    } catch (error) {
      if (isCancelled(error) || (current >= 0 && !device.valid(current))) return;
      device.stop(); setError(mediaError(error));
    }
  }

  async function playDescription(result: MediaObservation, current: number) {
    if (!result.audioBase64 || result.audioMimeType !== 'audio/mpeg' || !device.valid(current)) return;
    setPhase('speaking');
    try { await device.play(result.audioBase64, current, () => setPhase('preview')); }
    catch (error) { if (device.valid(current)) { setPhase('preview'); setNote('Audio could not play automatically. You can read the description or press Play description.'); } }
  }

  async function observe() {
    const current = token.current;
    if (!device.valid(current) || inFlight.current || !video.current || frameCount.current >= MEDIA_LIMITS.maxFramesPerSession || Date.now() - lastFrame.current < MEDIA_LIMITS.minimumFrameIntervalMs) return;
    inFlight.current = true; device.stopPlayback(); setError(''); setNote(''); setPhase('observing');
    try {
      const image = await captureJpeg(video.current);
      if (!device.valid(current)) return;
      lastFrame.current = Date.now(); frameCount.current++; setFrames(frameCount.current); setRemaining(MEDIA_LIMITS.minimumFrameIntervalMs / 1000);
      const result = await device.send<MediaObservation>('observe', { capturedAt: new Date().toISOString(), mimeType: 'image/jpeg', imageBase64: bytesToBase64(image), includeSpeech: speechEnabled.current }, current);
      if (!device.valid(current)) return;
      setObservation(result); setPhase('preview');
      if (result.speechError) setNote(`Description ready. Voice playback is unavailable: ${result.speechError}`);
      else if (speechEnabled.current) await playDescription(result, current);
      if (frameCount.current >= MEDIA_LIMITS.maxFramesPerSession) { setAutomatic(false); setNote('Eight views described. Stop and start a new camera session to continue.'); }
    } catch (error) {
      if (isCancelled(error)) return;
      if (device.valid(current) && error instanceof RequestError && [401, 403, 404, 410].includes(error.status)) { device.stop(); setError(mediaError(error)); return; }
      if (device.valid(current)) { setPhase('preview'); setError(mediaError(error)); setAutomatic(false); }
    } finally { if (device.valid(current)) inFlight.current = false; }
  }

  if (!isOwner) return <div className="camera-visitor"><VideoIcon/><h3>A view of the world, on your terms.</h3><p>Only the space owner can start this camera scene. Your camera and microphone are off.</p></div>;
  const active = phase !== 'idle';
  return <div className="camera-scene">
    <div className={`camera-preview ${stream ? 'has-stream' : ''}`}>
      <video ref={video} autoPlay playsInline muted aria-label="Your local camera preview"/>
      {!stream && <div className="camera-preview-empty"><VideoIcon/><h3>Let the world into your space.</h3><p>Your camera starts only when you choose.</p></div>}
      {stream && <div className="camera-preview-status"><span><i/>Local preview</span><button className="camera-close" aria-label="Stop camera" onClick={() => device.stop('Camera stopped.')}><Cross2Icon/></button></div>}
    </div>
    <div className="camera-controls">
      {!active ? <button className="button primary" onClick={() => void start()} disabled={!capabilities?.canObserve}><VideoIcon/>Start camera</button> : <>
        <button className="button primary" onClick={() => void observe()} disabled={!stream || phase === 'observing' || remaining > 0 || frames >= MEDIA_LIMITS.maxFramesPerSession}>{phase === 'observing' ? 'Describing this view…' : remaining > 0 ? `Next view in ${remaining}s` : 'Describe this view'}</button>
        <button className="button secondary" onClick={() => device.stop('Camera stopped.')}><StopIcon/>Stop</button>
      </>}
      <span className="camera-state" role="status">{phase === 'starting' ? 'Waiting for camera access…' : phase === 'speaking' ? 'Speaking the latest description' : phase === 'preview' ? `${frames} / ${MEDIA_LIMITS.maxFramesPerSession} views sent` : phase === 'observing' ? 'One view is being processed' : 'Camera is off'}</span>
    </div>
    {stream && <div className="camera-preferences"><label><input type="checkbox" checked={automatic} disabled={frames >= MEDIA_LIMITS.maxFramesPerSession} onChange={e => setAutomatic(e.target.checked)}/>Describe automatically, at least 15 seconds apart</label><label><input type="checkbox" checked={speak} disabled={!capabilities?.canSpeak} onChange={e => { setSpeak(e.target.checked); if (!e.target.checked) { device.stopPlayback(); if (phase === 'speaking') setPhase('preview'); } }}/>{speak ? <SpeakerLoudIcon/> : <SpeakerOffIcon/>}Read descriptions aloud</label></div>}
    <p className="media-disclosure">Preview stays on this device. When you describe a view, a still image is sent to AI services; descriptions may be sent for speech. LivingForma does not save images or recordings. Leaving this tab stops the camera.</p>
    {observation && <div className="camera-description" aria-live="polite"><span className="eyebrow">THE LATEST VIEW</span><p>{observation.text}</p>{observation.audioBase64 && phase !== 'speaking' && <button className="text-button" onClick={() => void playDescription(observation, token.current)}><SpeakerLoudIcon/>Play description</button>}{phase === 'speaking' && <button className="text-button" onClick={() => { device.stopPlayback(); setPhase('preview'); }}><SpeakerOffIcon/>Stop speaking</button>}</div>}
    {note && <p className="inline-note" role="status">{note}</p>}
    {capabilities && !capabilities.canObserve && <p className="inline-note">Scene descriptions are not available right now. Your records and text controls are still ready.</p>}
    {(error || capabilityError) && <p className="form-error" role="alert">{error || capabilityError}</p>}
  </div>;
}
