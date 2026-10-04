# Voice and camera lifecycle

Implemented in LF-180 on 2026-10-03. Product UI is English. These controls consume the accepted media API and remain outside shared AppSpec state and SSE events.

## Use the controls

Run `pnpm dev` from the repository and open `http://localhost:5173`. The configured `APP_ORIGIN` must match the browser origin. Sign in as the space Owner; participants and visitors do not receive device controls.

- Open the top-left orb, choose **Speak your idea**, then **Finish recording**. Transcription appends to the editable text draft. Review it and choose **Apply changes** to invoke the existing planner. Recording or transcription never applies a definition automatically.
- In a generated camera component, choose **Start camera** for a local preview. No frame is sent until **Describe this view** or the explicitly selected automatic option. The cloud processing disclosure is visible before starting. **Stop speaking** interrupts audio; **Stop** releases the camera and its session.
- Automatic description is off initially. When selected, it sends at least 15 seconds apart, with one request in flight, and at most eight frames per session. Sessions expire after five minutes and require another explicit start.
- Device denial, unavailable providers and transcription errors preserve the text workflow. Narration errors preserve the visual description. A browser that blocks automatic audio playback receives a manual Play control.

## Transport and cleanup

`lib/media.ts` owns local device sessions, abort controllers, identity epochs, sequence checks, expiry timers, tracks, audio elements and object URLs. `VoiceInput.tsx` and `CameraScene.tsx` share this lifecycle. `media-events.ts` is a local event channel for navigation and sign-out; remote snapshots cannot trigger capture.

The browser records in a supported MediaRecorder container, decodes it with AudioContext, and uses OfflineAudioContext to resample/downmix to 16 kHz mono. Only PCM16 WAV is posted to the server. The server parses actual bytes and derives duration; the client sends no duration assertion. Recordings are capped at 20 seconds. JPEG capture fits within 960×720, lowers quality when necessary, and rejects payloads above 400 kB. Each frame carries its own current capture timestamp.

Stop, dialog close, component unmount, space navigation, sign-out, hidden document and page exit cancel local work. They stop all tracks, detach recorder callbacks, close decoding audio contexts, pause playback, revoke object URLs, abort fetches and delete the server session. Late device permission results are immediately released. Old transcription/scene responses cannot update the draft or start narration. Authentication/session errors require a fresh explicit start.

Implementation follows browser APIs documented by [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext), and [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). The existing Motion reduced-motion policy remains in effect; media indicators do not require animation to communicate state.

## Evidence and limits

- `pnpm exec vitest run apps/web/src/lib/media.test.ts`: 5 tests passed. Browser WAV bytes pass the actual server WAV parser, including the 20-second limit; Open Library links reject executable or unrelated URLs.
- `pnpm exec tsx docs/frontend/browser-evidence/media-verify.ts`: 11 browser scenarios passed, 10 sessions deleted, zero page errors. Chrome used virtual camera/microphone devices while real MediaRecorder, AudioContext, JPEG encoding and audio playback APIs ran. Every API route was intercepted as a fixture, so these tests made no provider calls. Permission denial used an injected browser error. See [results](browser-evidence/media-results.json), [voice draft](browser-evidence/voice-draft.png), and [camera preview](browser-evidence/camera-preview.png).
- `pnpm exec tsx docs/frontend/browser-evidence/components.ts`: six scenarios passed, including all 12 available manifests after coordinator promoted camera, six skins, tool approval and safe structured results. See [results](browser-evidence/components-results.json).
- `pnpm exec tsc --noEmit` and `pnpm --filter @livingforma/web build` passed. Vite reported its existing large-chunk advisory (535.59 kB JavaScript before gzip), not a build error.

These results prove the frontend transport and device lifecycle with explicit fixtures. Actual STT, vision, TTS, planner and cloud persistence evidence belongs to the coordinator's LF-185 integration run and the Agent/Backend provider tests. No private camera or microphone content was used here. No DevTools frame trace was captured and no measured 60 fps claim is made.
