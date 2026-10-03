import { useEffect, useRef, useState } from 'react';
import { Cross2Icon, SpeakerModerateIcon, StopIcon } from '@radix-ui/react-icons';
import { MEDIA_LIMITS, type MediaTranscript } from '@livingforma/contracts';
import { bytesToBase64, isCancelled, mediaError, recordingToWav, useDeviceSession, useMediaCapabilities } from '../../lib/media';

type VoicePhase = 'idle' | 'starting' | 'recording' | 'transcribing' | 'ready';
export function VoiceInput({ slug, csrf, onTranscript, onBusyChange, disabled = false }: {
  slug: string; csrf: string | null; onTranscript: (text: string) => void;
  onBusyChange: (busy: boolean) => void; disabled?: boolean;
}) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [elapsed, setElapsed] = useState(0), [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const busy = useRef(false);
  const { capabilities, error: capabilityError } = useMediaCapabilities(slug, true);
  const device = useDeviceSession(slug, csrf, 'voice', () => { busy.current = false; recorder.current = null; setPhase('idle'); setElapsed(0); });
  const active = ['starting', 'recording', 'transcribing'].includes(phase);
  useEffect(() => { onBusyChange(active); return () => onBusyChange(false); }, [active, onBusyChange]);
  const supported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== 'undefined';

  async function start() {
    if (busy.current || disabled || !capabilities?.canTranscribe || !supported) return;
    busy.current = true; setError(''); setElapsed(0);
    let token = -1;
    try {
      const opening = device.begin(); setPhase('starting'); token = await opening;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
      device.attach(stream, token);
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = []; recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = event => { if (device.valid(token) && event.data.size) chunks.push(event.data); };
      const started = performance.now();
      const interval = setInterval(() => setElapsed(Math.min(MEDIA_LIMITS.maxRecordingSeconds, Math.floor((performance.now() - started) / 1000))), 200);
      const timeout = setTimeout(() => { if (device.valid(token) && mediaRecorder.state === 'recording') mediaRecorder.stop(); }, MEDIA_LIMITS.maxRecordingSeconds * 1000);
      const clearTimers = () => { clearInterval(interval); clearTimeout(timeout); };
      device.addCleanup(() => {
        clearTimers(); mediaRecorder.ondataavailable = null; mediaRecorder.onstop = null; mediaRecorder.onerror = null;
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop(); chunks.length = 0;
      });
      mediaRecorder.onerror = () => { device.stop(); setError('Recording stopped unexpectedly. Your text draft is still safe.'); };
      mediaRecorder.onstop = async () => {
        clearTimers(); device.releaseTracks(); recorder.current = null;
        if (!device.valid(token)) return;
        setPhase('transcribing');
        try {
          const wav = await recordingToWav(new Blob(chunks, { type: mediaRecorder.mimeType }), device.signal);
          chunks.length = 0;
          if (!device.valid(token)) return;
          const result = await device.send<MediaTranscript>('transcribe', { mimeType: 'audio/wav', audioBase64: bytesToBase64(wav) }, token);
          if (!result.text.trim()) throw new Error('No words were found. Try again, or type your idea.');
          onTranscript(result.text.trim());
          device.stop(); setPhase('ready');
        } catch (error) {
          if (isCancelled(error) || !device.valid(token)) return;
          device.stop(); setError(mediaError(error));
        } finally { if (!device.active || device.valid(token)) busy.current = false; }
      };
      mediaRecorder.start(); setPhase('recording');
    } catch (error) {
      if (isCancelled(error) || (token >= 0 && !device.valid(token))) return;
      device.stop(); setError(mediaError(error)); busy.current = false;
    }
  }

  return <div className={`voice-input voice-${phase}`}>
    <div className="voice-control-row">
      {phase === 'recording' ? <button type="button" className="voice-recording-button" onClick={() => recorder.current?.stop()}><StopIcon/>Finish recording<span>{elapsed}s / {MEDIA_LIMITS.maxRecordingSeconds}s</span></button>
        : phase === 'starting' || phase === 'transcribing' ? <span className="media-state" role="status"><i/>{phase === 'starting' ? 'Connecting to your microphone…' : 'Turning your words into a draft…'}</span>
        : <button type="button" className="text-button voice-start" onClick={() => void start()} disabled={disabled || !capabilities?.canTranscribe || !supported}><SpeakerModerateIcon/>Speak your idea</button>}
      {active && <button type="button" className="text-button" onClick={() => device.stop('Recording cancelled.')} aria-label="Cancel voice recording"><Cross2Icon/>Cancel</button>}
    </div>
    <p className="media-disclosure">Up to 20 seconds of audio is sent to AI services for transcription. LivingForma does not save recordings. Review the draft before applying it.</p>
    {phase === 'ready' && <p className="media-ready" role="status">Added to your draft. Review it, then apply your changes.</p>}
    {!supported && <p className="inline-note">Voice recording is not supported in this browser. The text box is ready for your idea.</p>}
    {capabilities && !capabilities.canTranscribe && <p className="inline-note">Voice transcription is not available right now. You can keep using text.</p>}
    {(error || capabilityError) && <p className="form-error" role="alert">{error || capabilityError}</p>}
  </div>;
}
