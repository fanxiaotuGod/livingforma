---
title: Backend Role Memory
type: role-memory
role: backend
updated: 2026-10-04
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

## Implemented and verified — LF-203

- Owner-only `POST /api/spaces/:slug/presentation` persists the full components array and optional layout using shared bounded contracts. Session/Origin/CSRF, row lock, namespaced durable replay, optimistic definition version and enabled tool/version checks apply; no planner/provider call occurs.
- Presentation saves preserve entity schema/schemaVersion, actions, records/versions/timestamps, space metadata and stateVersion; increment definitionVersion and emit one durable definition.published event. They do not run defaults/backfills. Replay returns current snapshot and cannot roll layout backward.
- Public projection now follows registered manifests for all 60 types. It trims private field/action/sort/emphasis references, hides Owner tool components and modules bound to private scalar fields, retains bounded presentation config/size, and preserves the existing empty-public-view rule.
- Verified presentation10 + existing API16 + revocation9 =35 tests on isolated PGlite; final presentation rerun10/10. Scoped API TypeScript, API build and diff whitespace check passed. Full-root typecheck hit an in-progress frontend analytics syntax error; coordinator owns final integration recheck.
- Docs: [module expansion](../../../backend/module-expansion.md); handoff [LF-203-b17b0e81](../../handoffs/backend/LF-203-b17b0e81-875f-4142-9326-233addae4649.md). No cloud/provider calls, deployment, commits or pushes.

## Implemented and verified — LF-220

- User's dated product revision permits general generated browser HTML/CSS/JS; catalog-only generation is superseded. The backend never executes that source on the server. AppOptions.siteGenerator is injectable; actual Agent/server wiring is a later integration step.
- Added durable Owner/original-session-scoped generation jobs, bounded sanitized source events/SSE replay, 90-second worker leases, truthful interrupted-restart failure, cancellation and late-result suppression. Static and browser checks share one repair allowance. Checked source publishes atomically with evolution/records/tool/assets validation and exact current base version. Replays do not call the generator again.
- Migration5 stores jobs, immutable definition history and raster images. Every future definition.published event saves complete immutable history; existing current definitions are backfilled. Raster PNG/JPEG/static WebP limits: 512 KiB, 4096 px, 20 MiB/space; uploader/Owner drafts, public references only, no URL fetcher or paid storage.
- Generated frames use served opaque sandbox/CSP, exact parent frame-src, bounded MessageChannel lf bridge and native Trusted Types gating. Private parser/initial source policies plus a default HTML/SVG sanitizer support normal dynamic DOM. Unsupported browsers do not parse or execute artifacts. Private records/default literals never enter model input or frame response; private schema metadata is restored by the host.
- A coordinator browser review found the initial srcdoc fresh-realm weakness. The implemented Trusted Types correction passed four real Chrome tests (including normal UI, 19 sink/capability probes, blocked receiver requests, unsupported-browser fail-closed). No complete CPU/network sandbox claim. Coordinator subsequently instructed stopping further advanced security investigation because the app displayed a platform restriction; no further probes were added after that instruction.
- Verified 73/73 combined backend/browser/API/presentation/revocation/media/budget tests; final 12/12 normal generation tests additionally verify a stored asset survives physical disk restart. TypeScript/API build/diff checks passed. Docs: [generated backend](../../../backend/generated-sites.md); handoff LF-220-951d4f9f-2f20-4f1e-95a9-32710a5580c8.md. No .env, real provider/Neon, allowance reset, commit, push or deployment.

## Implemented and verified — LF-224

- General generated `code-js-v1` computation is now supported, superseding the earlier catalog-only/no-source tool boundary. `createGeneratedToolAdapter` runs async `run(input,api)` only in fresh QuickJS 0.32.0 workers with shared heap/stack/deadline/concurrency/broker/JSON bounds. It exposes declared public records and existing enabled exact catalog GET connectors, no arbitrary URL, Node/shell/import or credentials. The heap limit is not a hard process RSS limit.
- Migration6 persists immutable tool versions/source digests/fixture reports and durable invocation reservations/results. Owner-only proposals/tested enablement/invocation reuse existing auth session/Origin/CSRF. Original-session/current binding/dependency checks surround async work. Logout and HTTP disconnect abort; late results do not commit. Duplicate pending requests return409; failed/interrupted work is not automatically re-executed; startup recovery assumes one API worker process per database.
- Website jobs receive source-free enabled manifests, test candidates outside DB transactions, persist actual outline/tool progress and reports, and share the existing one repair across source/tool/browser checks. Owner publish atomically enables tested versions with exact bindings, definition/history/events/replay. `lf.runTool` is in the trusted frame bootstrap; public projections remove tool actions/bindings consistently.
- Verified runtime5 + code-toolAPI9 + prior API16/presentation10/revocation9/generated12 =61 distinct ordinary checks across targeted runs. Last API9/9 includes real HTTP disconnect and disk restart; final root TypeScript/API two-entry build/diff check passed. Compiled worker arithmetic smoke passed with no tsx loader. Fixtures are explicit; no real provider/cloud/.env call, charge, deployment, commit or push.
- Docs: [generated tool backend](../../../backend/generated-tools.md); handoff [LF-224-31e3e17d](../../handoffs/backend/LF-224-31e3e17d-a652-4c73-92c7-153532e94328.md). Coordinator wires `toolCodeGenerator: generateTool` and existing catalog `tools` in server.ts; QA independently checks complete browser/host/QuickJS flow. No advanced exploit/bypass investigation was performed.

## Implemented and locally verified — LF-229

- Global concurrency1 is shared across adapter factories/spaces. Runtime busy responses are explicit; durable busy429 → sameID409/no execution → newID success/replay once is tested. No automatic queuing or retries occur.
- Trusted host sends immutable shared limits through workerData; worker imports only their type, avoiding unrelated contract initialization. Catalog21 explicitly superseded the prior4-second combined deadline with startup8s, guest execution4s after trusted readiness, total12s. No generated code runs before parent acknowledgment. Parent timers plus monotonic absolute message guards terminate late work. Fresh worker/context and32MiBheap/256KiBstack remain; compiled worker3.27KiB instead of229.83KiB.
- Invoke route14s/registration65s permit surrounding checks and up to five fixtures. Existing standalone proposal30s and generation90s caps remain and may stop a long batch. Startup503 and busy429 propagate as infrastructure errors without fabricated fixture failures/source repairs.
- Two failed actual Docker0.1CPU/512MiB adapter runs under the old combined4s deadline remain in [LF229 performance evidence](../../handoffs/backend/LF-229-88cc9a2e-8c04-4596-9301-c23057a822ef-performance.json). No OOM occurred. The coordinator accepted separate bounded phases after those failures; no hidden prewarming/precompiled-module reuse was added.
- Local runtime10/API10 checks pass20/20, comprising six real QuickJS cases, four explicit trusted-protocol clock fixtures, and ten Fastify/PGlite/QuickJS cases. Final startup fixture specifically confirms adapter.test propagates503 instead of inventing a failed source report. Whole TypeScript/API build/diff check pass.
- DevOps independently rebuilt once and passed the complete actual-adapter free-Docker6/6checks: two fixtures10.798s total, different invoke2.798s, busy4290.495s without secondworker, admitted invoke6.606s, fresh3.190s, all five workerphase bounds. Observed startup1.297–4.798s/guest0.594–1.106s, maxresult5.506s, RSS90.7MiB/HWM90.9; process exited0. Whole source snapshot hashes verified unchanged. Evidence appended with both failed baselines retained. Linuxarm64/resource-profile success is not actual hosted Render/combinedtraffic acceptance; coordinator/DevOps own LF227/228. No provider/cloud/.env/charge/deployment/commit/push.

## Implemented and locally verified — LF-235

- Generated-frame child RPC consumes shared GENERATED_BRIDGE_LIMITS: only pickImage/remove allow180s, all ordinary methods remain30s. Parent frontend LF234 owns separate120s human choice deadline and cancellation/late-write prevention. Source/privacy/pending32/payload64KiB limits and existing cleanup remain unchanged.
- Added three ordinary actualChrome/MessageChannel tests using delayed host responses and Playwright's virtual clock:60s selection/cancellation,180s strict expiry/late responses, and pagehide cancellation. All three plus existing normalDOM test passed4/4 in4.44s. Historical boundary tests preserved, not expanded or rerun. Whole TypeScript/APIbuild/diff passed.
- Handoff: [LF-235-eebd8944](../../handoffs/backend/LF-235-eebd8944-ef25-457a-9dcd-cf4364c0731f.md). Fixtures do not upload/delete real data or contact providers. Root4347 server/businessDB/merged84e90bf source preserved; no .env, charge, cloud, deployment, commit or push.
