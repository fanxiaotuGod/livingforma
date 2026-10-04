---
title: Backend Role Memory
type: role-memory
role: backend
updated: 2026-10-03
timezone: America/Vancouver
permalink: livingforma/roles/backend/memory
---

# Backend role memory

## Implemented — LF-120

- Fastify application factory, API routes and same-origin production static hosting are in `apps/api/src/`; entrypoint loads root `.env` reliably.
- `packages/db/src/index.ts`: PGlite disk persistence, PostgreSQL `pg` adapter, two transactional/idempotent migrations, identities/sessions/OAuth state, space aggregates, stream events, idempotency results, registry and tool invocation audit.
- DevOps auth is mounted through a persistent AuthStore. Verified Google subjects map to stable internal users; local personas use `user-local-owner` and `user-local-participant`, only under explicit nonproduction loopback gates.
- Server enforces sessions, Origin, CSRF, owner/participant/private-space permissions; public snapshots strip private schema, records and bindings. Only Owner publishes definitions or manages/invokes tools.
- Atomic schema publication and records/default backfill preserve stable IDs and the same URL; write/version conflicts return 409. Mutations and tool calls use request fingerprints to reject mismatched ID reuse.
- SSE replays persistent per-space cursors, checks access each poll, and resets on expired/future/interior-gap cursors. No business data, profile, prompt or media payload is sent in events.
- Explicit local demo seeds reading/habits; production does not seed. Development data directory is ignored `.local/app-data/pglite`.

## Verification

- `apps/api/src/api.test.ts`: real embedded PostgreSQL/PGlite and Fastify integration suite, including a disk database close/reopen, sessions and tool registry recovery.
- API tsup build passed. Repository typecheck passed after frontend's concurrent edit completed.
- No Tiger Data cloud connection, real browser Google roundtrip, Gemini/ElevenLabs, real tool endpoint or production deployment was verified by LF-120. Fixture tool runs are labeled tests.

## Handoff / next integration work

- See `docs/backend/runtime.md` and `docs/memory/handoffs/backend/LF-120-45efaaa2-28c0-4fdc-bc93-195ef15abf1b.md`.
- Agent must export `planProposal` plus `toolAdapter` or synchronous `createToolAdapter()` matching shared ToolAdapter. Missing adapters return 503; no fabricated execution.
- DevOps supplies actual `DATABASE_URL` or durable production `DATA_DIR`, HTTPS APP_ORIGIN and Google credentials through the environment. PGlite requires one process per directory; PostgreSQL adapter is intended for multiple instances.
- Public projection intentionally omits tools; first tool loop is Owner-only. No arbitrary URL/code execution is implemented.
- Provider/network calls must enforce verified free budgets before activation. No paid resource was created and no secrets were written to memory.
- Reclaim the next backend task via coordination; do not assume this completed session owns new writes.

## Implemented and verified — LF-122

- Pending ToolSpec bridge: enabled registry context reaches the planner; `requiresToolApproval` preserves definition/data/cursor and does not consume request IDs. Owner-only/CSRF-protected tool proposals, explicit tested enablement, then ordinary retry bind the registered tool.
- Capability-gap-only no-op changes return an error instead of being presented as publication success. Create-space prompts needing approval require creating the empty space first.
- Migration 3 and `createProviderBudgetStore` persist provider reservations in `lf_provider_budgets` (`provider`, JSONB `data={day,requests,recent}`), atomic across adapters/replicas and retained across restart. UTC daily limit <=30 and rolling minute <=5; no automatic refunds. Server injects Agent `configureBudgetStore`.
- Same-key CLI/file usage must be carried forward before real DB-backed Gemini activation. Coordinator is handling the previously consumed real requests; this task made no Gemini/cloud calls.
- QA zero-public-fields defect fixed, including zero-visible-components: non-Owner gets null definition/empty records/no writable actions or login-to-write prompt. Owner data remains intact; full definition validation is not weakened.
- Expired session rows are pruned at session creation.
- Verified 20 tests (API16 + budget4), root typecheck, API build and diff check. Unique handoff: `docs/memory/handoffs/backend/LF-122-aa8173d6-00ec-400b-be8b-4d466d1ca1d4.md`.


## Implemented and verified — LF-182

- Owner-only ephemeral voice/scene endpoints are in `apps/api/src/media.ts`; server injects Agent MediaAdapter with durable media budget store. Bindings derive from existing auth user+random per-login CSRF token, staying server-only in memory; no second authentication provider.
- Session limits: five minutes, one voice + one scene per current browser auth, 100 process-wide; same-kind/new-space replacement and shutdown cleanup. DELETE 204. Positive increasing sequence, one in flight, scene 15s spacing and 8 frames; canonical base64/WAV/JPEG bounds and capture freshness.
- Logout callback, periodic and final auth/space checks, expiry, Stop and HTTP disconnect abort work. Cancellation races provider work and discards late results. Observation speech failure preserves safe text. No raw media, transcript, returned audio or media event enters business persistence/SSE/logs.
- Migration 4 `lf_media_budgets` and createMediaBudgetStore reserve non-resetting verified allowance units atomically: period verified-2026-10-03, STT60s/TTS1000chars, 3 starts/minute per bucket, no refunds. Server keeps the existing Gemini DB ledger.
- Verified backend suite37 tests: media13 + media budget4 + existing API16/provider budget4; root typecheck/API build/diff check passed. Fixtures exercise HTTP disconnect and physical budget database restart; no real device/cloud calls by this backend task.
- Agent reported separate real STT/vision/TTS against the same Neon ledger (Gemini28/30,STT2,TTS153 at handoff; evidence docs/agent/evidence/LF-181-live-media.json). Do not reset ledgers or assume those counts remain current.
- Handoff: docs/memory/handoffs/backend/LF-182-b797f471-6756-4e85-8242-722e8ac03cb1.md. Final browser/provider/deployment acceptance belongs to coordinator/QA/DevOps.
