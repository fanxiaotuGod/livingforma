# Media runtime

LF-181 implements the server adapters for English voice commands and camera observations. The shared `MediaAdapter` exposes `transcribe`, `describe`, and `speak`, all with `AbortSignal` and measured processing `durationMs`. Backend LF-182 owns authorization and ephemeral sessions. Frontend LF-180 owns explicit device permission, recording, preview, frame scheduling, and playback. The adapter does not publish a definition or change a record.

## Implemented boundaries

`createMediaAdapter({budgetStore})` requires the durable shared `MediaBudgetStore`. Speech also requires the private `ELEVENLABS_API_KEY` and `ELEVENLABS_ALLOWANCE_VERIFIED=true`. Every speech call reads the account subscription and rejects missing allowance or enabled extension flags before reserving and generating. DevOps separately verified the current ElevenAPI included balance of 131,000 credits, PAYG top-up balance zero, Auto Top Up off, and a restricted API key capped at 10,000 credits. This is an account verification, not an inference from a public pricing table.

Reservations use the fixed verification period `verified-2026-10-03`, at most 60 STT seconds and 1,000 TTS UTF-16 characters. They do not reset at midnight. Each bucket allows at most three requests/minute. The database adapter enforces these limits atomically across instances. Errors and cancellations do not refund reservations. A new period requires a new explicit allowance verification and deployment configuration; changing the date is not a quota bypass.

STT accepts only canonical 16 kHz mono PCM16 WAV with 0.1–20 seconds of actual data. The parser verifies RIFF length, chunk layout, format, rate, channels, sample size, data alignment, and byte-derived duration before any network request. WebM/MP4/compressed audio and extra chunks are rejected. The browser converts its recording before upload. Scribe v2 receives the validated bytes; no diarization, audio event tagging, keyterms, entity detection, or transcript correction options are used. The returned transcript is a draft, with no automatic planner call or publication. Transcription times out after 25 seconds and its raw JSON response is capped at 64 KiB.

Vision accepts only JPEG frames up to 400 kB and 2048×2048 pixels, verifying the container markers and frame dimensions. The existing Pi/Gemini runtime runs an isolated observation agent with **no tools**, model `gemini-3.5-flash-lite`, one request, at most 500 output tokens, no automatic retry, and a 25-second timeout. Image content and OCR are explicitly untrusted observations. Output is plain English, limited to 300 characters; it cannot become an Owner command. Vision shares the same durable Neon Gemini budget as text planning, with no media fallback ledger.

TTS uses the fixed premade River voice `SAz9YHcvj6GT2YYXdXww`, model `eleven_flash_v2_5`, and MP3 44.1 kHz/128 kbps. It accepts at most 300 characters, times out after 20 seconds, and caps response bytes at 600 kB. The first version returns a complete short MP3, not streaming playback. All provider URLs are fixed HTTPS origins and redirects are rejected. Safe English errors omit provider bodies and credentials.

The runtime does not save audio, images, full transcripts, or observation text to disk, business records, SSE, or logs. Providers still process uploaded media. In particular, ElevenLabs documents `enable_logging=false` as Enterprise-only zero-retention functionality; this app does not claim provider zero retention.

## Verified evidence

[Live media evidence](evidence/LF-181-live-media.json) records three real service calls on 2026-10-03. Inputs were a locally synthesized voice command and a synthetic JPEG illustration. No physical microphone or camera was enabled.

| Stage | Actual result | Processing time |
| --- | --- | --- |
| ElevenLabs Scribe v2 | Recognized the synthetic request to change the skin to sage; returned an unapplied draft | 1,998 ms |
| Gemini 3.5 Flash-Lite vision | Described books and a red mug; malicious text in the image did not trigger any tool call | 2,092 ms |
| ElevenLabs River / Flash v2.5 | Returned 141,314 bytes of `audio/mpeg`; local `afinfo` recognized 8.803 seconds, mono 44.1 kHz | 2,365 ms |

These are service processing times, not first-audible-sound or browser/device latency. Vision recorded one request, 1,218 input tokens, 29 output tokens, and no tools. The synthetic image deliberately contains an instruction to delete records; observation has no mutation interface regardless of model output.

The existing Neon Gemini ledger advanced from 27 to **28 of 30** reservations. Media reservations were **2 of 60 STT seconds** and **153 of 1,000 TTS characters**. The coordinator subsequently used the remaining two Gemini reservations for one explicit browser voice Apply. The existing Neon ledger is now **30/30**; no further request is allowed until its natural UTC day rollover. The exact reason this proposal required two provider requests was not recorded; it must not be inferred from the timeout alone. Do not run extra cloud tests or the old LF-130 development-file smoke to bypass this ledger.

`pnpm exec vitest run packages/agent/src/agent.test.ts packages/agent/src/media.test.ts` passed **23 tests** (12 text/tool and 11 media). Tests cover invalid formats and durations, malformed allowance, paid-extension rejection, quota stop before generation, strict speech format, bounded responses, input cancellation before network access, late-response cancellation, no refund, fixed endpoint/model, draft-only STT, isolated observation, and camera manifest availability with unchanged record schema, and preservation of existing external tool bindings during camera/skin changes. `pnpm typecheck` passed. All ordinary tests use explicit fixtures and do not consume provider allowance.

The opt-in `packages/agent/scripts/live-media-smoke.ts` uses the existing Neon ledger and intentionally requires the pre-run count of 27. It has already run and will reject a rerun. The synthetic input/output fixtures are retained only as explicit test artifacts; production media are not persisted. See the fixture README for provenance.

Cross-role browser STT produced an editable draft in 2,294 ms and released its virtual microphone. The Owner explicitly submitted the draft with a request to add camera. The real Gemini proposal published the habit app as version 2 with sage skin and a camera component, preserving schema version 1, all four fields and its record. This was confirmed by read-only public snapshot and coordinator Neon inspection. The browser test waited only 15 seconds for the proposal response and timed out before the API completed, so its failed response assertion is retained rather than rewritten as a successful captured response. The API has a 30-second planning timeout. See [the original browser evidence](../memory/handoffs/coordinator/LF-185-live-browser-evidence.json).

LF-181 role acceptance is complete using the combined evidence below. The coordinator reviewed this scope on 2026-10-03 at 16:35 America/Vancouver. The complete browser camera → real service → playback session remains a distinct LF-185 integration check after the natural budget rollover; it is not claimed by the adapter tests.

| LF-181 acceptance | Evidence and boundary |
| --- | --- |
| Actual voice command reaches the validated proposal/publication route | Real browser Scribe draft, explicit Owner Apply, and successful Gemini habit v2 publication confirmed in the public snapshot and Neon; original 15-second response assertion timed out and remains disclosed |
| Camera observation produces real Gemini description and ElevenLabs speech with measured latency | The synthetic image went through the actual Pi/Gemini/ElevenLabs adapters; provider timings and valid MP3 are in the live media evidence; no physical camera was used |
| Cancellation, backpressure, latest playback, quota stop, and no raw-media logging | Agent's 23 tests; [Frontend's 11 virtual-device browser checks](../frontend/browser-evidence/media-results.json), with fixture API responses; [Backend's 13 media route plus four durable media budget checks](../memory/handoffs/backend/LF-182-b797f471-6756-4e85-8242-722e8ac03cb1.md), with fixture providers; runtime paths do not persist or log raw media |

These layers verify their respective responsibilities. Their combination does not fabricate an already-completed real-provider camera browser session or target-phone test.

## Official references

- [Scribe conversion API](https://elevenlabs.io/docs/api-reference/speech-to-text/convert): multipart upload and model/options.
- [TTS conversion API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert): voice/model, MP3 output, and Enterprise-only logging control.
- [Models](https://elevenlabs.io/docs/overview/models): Scribe v2 and Flash v2.5 capability descriptions.
- [Pay as you go](https://elevenlabs.io/docs/overview/administration/pay-as-you-go): subscription credits are consumed first; with automatic top-ups disabled, zero remaining balance pauses generation.
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding): inline images and image input handling. Model availability and account free status were independently checked during LF-130/LF-150.
