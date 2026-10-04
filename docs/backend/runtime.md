# Backend runtime

Implemented in LF-120 on 2026-10-03; real cloud PostgreSQL and Google browser roundtrip remain separate integration checks.

## Startup and storage

Use Node >=22.19 and the repository `pnpm dev` script. The API reads the root `.env` using its own module location, even when pnpm changes the working directory to `apps/api`. It serves port 3001 by default; Vite proxies `/api` and `/auth` on port 5173. Production `pnpm start` serves built web assets from the same API origin.

- `APP_ORIGIN`: exact browser origin (development `http://localhost:5173`; production HTTPS required).
- `DATABASE_URL`: selects the `pg` PostgreSQL adapter.
- Without it, `DATA_DIR` selects persistent PGlite; development defaults to ignored `.local/app-data/pglite`.
- Production requires explicit `DATABASE_URL` or `DATA_DIR`. A production PGlite directory must be backed by a durable volume and have only one process accessing it.
- `ENABLE_LOCAL_DEMO=true`, nonproduction, explicit localDemo option, loopback origin and loopback socket are all required for test personas. Demo records seed only when these environment/origin gates hold. Production never creates these identities automatically.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: read by the DevOps-owned auth provider. API logs disable request logging to keep OAuth authorization-code URLs out of logs.
- `AGENT_MODE=gemini` selects the real planner adapter; the default is explicitly `local-rules`. A missing planner returns 503 and preserves the current app.

`buildApp({db, origin, planner, tools, ...})` is the testable application factory. `server.ts` mounts `planProposal` and the Agent module's `toolAdapter` or synchronous `createToolAdapter()` export when provided. The coordinator must confirm that final Agent exports match this adapter.

## Persistence and transactions

`packages/db/src/index.ts` contains four idempotent, transactional SQL migrations used by both adapters. It stores identities, hashed sessions, one-time OAuth transactions, spaces, event logs, idempotency fingerprints/results, registered tools, sanitized invocation audits and provider budgets. Schema versions are recorded in `lf_migrations`.

A space is one JSONB aggregate containing its definition, records, permission configuration and versions. Snapshot reads cannot mix definition and state versions. Mutations lock that aggregate with `FOR UPDATE`; record changes, definition publication, default-value backfill, event cursor and idempotency entry commit in the same transaction. Records are bounded at 2000 per space for this MVP. Google identities use unique provider subjects, never email equality.

Public projection removes private fields/values, semantic bindings referencing those fields, private-only components and all tool bindings. The server rechecks session, Origin, CSRF, space membership, allowed action and requested versions on every mutation. Participants cannot publish, register/invoke tools, change private fields or access a private space without membership. Definitions cannot publish references to missing/disabled tool versions.

## Events and tools

SSE uses persisted, per-space monotonically increasing cursors. Every 750 ms the server revalidates access and drains events; this works across separate PostgreSQL API processes without requiring NOTIFY. Notifications contain only version metadata. Future, expired and interior-gap cursors receive `reset.required` and close. Clients refetch an atomic snapshot, then subscribe using its cursor. Heartbeats are comments and do not consume event IDs.

Owner tool registration validates and tests the exact ToolSpec before persisting its explicit enabled flag. Existing versions cannot silently change their spec. Calls require enabled versions; a per-user request ID returns the stored result instead of running again. Successful invocation counts and sanitized status/duration audits persist. External execution is delegated exclusively to the injected trusted Agent adapter; this backend does not permit arbitrary URLs or executable code.

## Verified scope

`pnpm exec vitest run apps/api/src/api.test.ts` exercises a real PGlite engine and Fastify HTTP routes, including a real temporary-disk database restart. It covers auth/CSRF, Google subject mapping, one-time OAuth state storage, public projection, private-space isolation, concurrent conflicts, idempotency, non-destructive evolution, day toggles, SSE replay/gaps, tool enablement and reuse. The trusted tool adapter in these tests is explicitly a fixture. These tests do not prove Tiger Data provisioning, real Google OAuth, Gemini, OpenLibrary or deployment.

## LF-122: proposed tools and durable budgets

`planProposal` now receives enabled `registeredTools`. A validated proposal with missing or disabled tools returns the existing snapshot and `requiresToolApproval: true`, without publishing, testing/executing tools, writing an event or consuming the original request ID. Owner must explicitly POST `/tools` with `enable: true`; an ordinary prompt retry can then bind that enabled version. Both the same request ID and a new request ID are safe after approval. A no-op proposal containing only unsupported capability gaps returns 422 `CAPABILITY_UNAVAILABLE`.

Owner-only POST `/api/spaces/:slug/tool-proposals` accepts `{prompt}` and delegates to Agent `proposeTool`; it requires a session and CSRF because real planning may consume the limited free budget. It returns a validated proposal, never tool permissions. A POST `/api/spaces` initial prompt requiring tool approval returns 422 `TOOL_APPROVAL_REQUIRED`; create the empty space and submit the prompt to its ordinary proposal endpoint to use the approval workflow.

`server.ts` injects `createProviderBudgetStore(db)` through `configureBudgetStore`. Migration 3 adds `lf_provider_budgets`, keyed by provider, with JSONB `{day, requests, recent}`. `day` is UTC; `recent` is epoch milliseconds. Reservations lock the provider row, enforce at most 30/day and 5/rolling minute, preserve the minute window across midnight, and persist through process/database restarts. There is no automatic refund after a failed/cancelled provider request. Missing/unavailable budgets fail closed. The API preserves safe quota error codes.

When transitioning the same provider key from the previous local file ledger to the database, carry its already-consumed requests forward before enabling real calls. Creating a fresh database is not evidence that the provider has a fresh quota. Coordinator owns that integration carryforward; LF-122's tests use isolated fixture databases and make no Gemini calls.

A public projection with zero public fields **or** zero renderable components returns `definition: null`, `phase: unconfigured`, `records: []`, disabled business write permissions and no login-to-write invitation. Owner still receives the full valid definition/data. This avoids both invalid empty schemas and disclosure of private record counts. Frontend can label the non-Owner empty view “No public content”.

LF-122 validation: 16 API tests plus 4 durable-budget tests passed, including concurrent reservation caps, UTC midnight behavior, disk reopen, pending approval retries and the QA-reported empty projection. Root typecheck, API build and whitespace check passed. Expired sessions are pruned when a new session is created.


## LF-182: ephemeral owner media

`apps/api/src/media.ts` registers the accepted media endpoints. GET capabilities is Owner-only; all POST/DELETE operations also require exact Origin and CSRF. `buildApp` accepts a `MediaAdapter`, and server.ts injects Agent `createMediaAdapter({budgetStore:createMediaBudgetStore(db)})` alongside the existing durable Gemini request store.

Media sessions use random 192-bit IDs and an in-memory binding derived from the current user's ID and their existing per-login random CSRF token. This binding is never public, logged or persisted. A second browser login for the same Google user cannot reuse an existing device session. The existing AuthStore has an optional deletion callback; logout or sign-in rotation immediately aborts matching media in this process. Active work rechecks auth/space ownership every second and again before returning to cover revocation elsewhere.

A browser can hold one voice and one scene session in its current space (at most two). Creating another same-kind session replaces the old one; starting in another space ends its old-space sessions. Process capacity is 100, with five-minute expiry and cleanup on shutdown. Sessions disappear on process restart; clients receive 404 and must stop devices and explicitly restart. Session payloads contain control metadata only, never recorded media or results.

- POST session returns 201; DELETE returns 204 with no body and is idempotent for already stopped IDs after normal Owner/CSRF checks.
- Sequence numbers are positive and strictly increasing. Repeated/old sequence returns 409; one request may be in flight at a time (429 otherwise).
- Voice accepts canonical base64 of `audio/wav` only, within the 2 MB transport bound. Agent's strict RIFF parser then requires PCM16 mono 16 kHz, derives actual PCM duration and rejects recordings over 20 seconds before any provider call.
- Scene accepts bounded JPEG (400 kB), checks capture timestamps (not older than 30 seconds or more than five seconds into the future), and delegates full JPEG structure/dimension checks to Agent. It allows one frame every 15 seconds, eight frames per session. Failed/aborted starts still consume this session allowance.
- DELETE, expiry, logout, replacement, lost ownership and HTTP disconnect abort current provider work. The host races work against cancellation, so even an adapter that returns late cannot expose a stale result. The combined observation deadline is 60 seconds.
- Scene description is plain text. TTS failure keeps it with a safe `speechError`; provider errors and raw payloads are not logged or forwarded. Transcription only returns a draft, never mutates an app. Media code writes no definitions, records, business events, request results, recordings, images, transcripts or audio to database storage.

Migration 4 adds `lf_media_budgets(bucket,period,data)` with JSONB `{units,recent}`. `createMediaBudgetStore` uses the explicitly verified, non-resetting period `verified-2026-10-03`. It atomically caps STT at 60 seconds, TTS at 1000 UTF-16 characters, and each bucket at three provider starts per minute. Failed/aborted provider calls retain reservations. A new date or host restart cannot create new included allowance; changing the verified period requires an explicit server configuration change after allowance verification.

Verification: 13 media-host tests plus 4 media-budget tests; the complete backend suite is 37 passing tests. Tests cover cross-browser/session/space isolation, anonymous/Participant rejection, CSRF, strict WAV integration, stale frames/sequences, 15s/eight-frame gates, cancellation, disconnect, logout, cross-process-style revocation, expiry, late result suppression, text fallback and absence from persistent business state/events. Budget tests use concurrent adapters and physically reopen an on-disk database. They call fixtures, not cloud providers or real devices.

Agent separately reported actual provider validation in `docs/agent/evidence/LF-181-live-media.json`: one STT, one Gemini observation and one TTS using the same Neon ledgers. At that handoff Gemini was 28/30, STT 2 seconds and TTS 153 characters. Treat these as point-in-time Agent evidence; query existing durable ledgers before subsequent real calls and never reset them. End-to-end current-device browser and deployed-domain acceptance remain LF-185/LF-160/LF-170 work.
