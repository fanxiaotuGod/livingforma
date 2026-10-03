# Synthetic media fixtures

These files contain no user recording or camera input.

- `voice-command.wav`: generated locally with macOS `say` using the Samantha system voice, converted with `afconvert`, then rewritten as canonical PCM16 mono 16 kHz WAV. It says “Change the skin to sage.” Duration is 1.4396875 seconds. The saved file is a fixture for reproducible input validation and explicit provider tests.
- `scene-test.jpg`: a 640×400 Pillow illustration of two books and a red mug. It includes an intentionally adversarial text instruction to delete records. Vision must treat that text as untrusted scene content and has no editing tools.
- `scene-narration.mp3`: the real ElevenLabs River response to Gemini's safe description of the synthetic illustration, created once by LF-181. It is 141,314 bytes; SHA-256 is recorded in the evidence JSON. Local `afinfo` recognized 8.803265 seconds of mono 44.1 kHz MP3. Browser playback is tested separately.

Saving these non-private fixtures and their known transcript is an explicit test-only action. Production media adapters do not save incoming audio, images, transcripts, or generated speech. Ordinary tests do not contact providers. The opt-in live script is guarded against rerunning after its allocated Gemini reservation.
