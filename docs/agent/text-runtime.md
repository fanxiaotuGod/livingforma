# Text planner and controlled tools

Implemented and live-verified on 2026-10-03 (America/Vancouver), LF-130.

The English product uses `planProposal({prompt,current,registeredTools,mode,signal})`. Gemini runs through `@earendil-works/pi-agent-core@1.0.1` with the matching Pi AI provider. The model calls `submit_proposal` with structured fields, components, actions and capability gaps. Shared Zod, manifest bindings and `validateEvolution` remain the authority; Pi cannot publish or modify records. The host fills an omitted check-in/date binding only when exactly one compatible field exists. Ambiguous or incorrect bindings are rejected.

`local` is an explicitly labeled `local-rules` fallback. It assembles catalog components for reading, habits, tasks, expenses and collections and supports rating, sorting, layouts, density, skins and safe evolution. It is not general AI and reports unsupported changes. `gemini` composes directly from the registered manifest and current definition. Both preserve stable field IDs. No untrusted code, CSS, shell commands or URLs are executed.

## Actual provider and budget

The explicitly selected and verified model is `gemini-3.5-flash-lite`. The official [model catalog](https://ai.google.dev/gemini-api/docs/models) restricts 2.5 models for new projects; a real 2.5 request returned 404. The [pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists free standard input/output for both 3.5 Flash-Lite and 3.8 Flash. 3.8 returned temporary 503 during validation; the product does not auto-fallback between models or to paid service.

Gemini requires `GEMINI_API_KEY` and `GEMINI_FREE_TIER_VERIFIED=true`. A maximum of 30 reservations/day and 5/minute applies, optionally reduced with `GEMINI_DAILY_REQUEST_LIMIT`; provider failures also consume reservations. Each run is limited to 3 model requests, 6,000 output tokens/request, 60 seconds and one concurrent run/process. Provider automatic retries are disabled. Cancellation aborts Pi. The API may apply a shorter 30-second limit.

Production requires the host to call `configureBudgetStore(ProviderBudgetStore)` with a durable database adapter. Missing or failed durable storage stops calls. Development defaults to `.local/agent-budget.json`, protected by an atomic lock and mode 0600. A stale lock fails closed and needs operator review; do not remove/reset it to bypass quota. When switching budget stores, carry forward existing day reservations and recent timestamps. LF-130 ended at **22/30** reservations; the coordinator carried those reservations into the Neon database before integration. LF-150 advanced the count to 27; LF-181 vision advanced it to 28. Future calls must use that same database ledger, never the stale development file. The hard caps reduce usage; verified free-project billing status remains a deployment prerequisite.

## Tool lifecycle

A request for external book lookup produces `toolProposals` and keeps the existing app unchanged. The host returns `requiresToolApproval`. Only an explicit Owner enable action can test and persist an enabled recipe. Resubmitting the original request with the enabled registry binds a `tool-result` component. The same tool ID/version is reused.

`proposeTool` uses Pi/Gemini `propose_capability` to select from trusted endpoints. The sole implemented external recipe is `openlibrary_search` v1, GET-only and side-effect-free. It accepts one `q` string of 1–200 characters. Fixed host/path and output mapping are enforced; arbitrary URLs, endpoints, verbs, response traversal and unknown parameters are rejected. DNS must resolve entirely to public IPv4, the selected address is pinned into the HTTPS connection, redirects are rejected, execution is bounded by the spec timeout (8 seconds by default), raw body by 64 KiB, projected result by 16 KiB, and output by five books with bounded plain strings and validated Open Library links. Cache is 10 minutes/100 entries; network requests are limited to one per 1.1 seconds. The [Open Library API policy](https://openlibrary.org/developers/api) asks for human-initiated lookups, caching and identification; its unidentified limit is one request/second. This app uses that conservative rate, not the higher identified limit. Search fields are based on the [official search API](https://openlibrary.org/dev/docs/api/search).

The backend reconstructs handlers from persisted, enabled specs, then the adapter registers them with `agent.state.tools` and `prepareRequest`. Explicit UI invocation uses a deterministic Pi stream to avoid spending model tokens on an already-authorized query. It still executes a real Pi tool, but is not described as an LLM decision. The separate live evidence also proves a real Gemini-selected invocation of that registered Pi tool.

## Verification

- `pnpm typecheck` passes.
- `pnpm exec vitest run packages/agent/src/agent.test.ts`: 10 tests pass (four category compositions, stable evolution, unsafe output, missing-tool enable/reuse, unambiguous binding, endpoint/input/network/output boundaries, dynamic Pi execution/cache/abort, durable local quota).
- [Reading](evidence/LF-130-live-reading.json), [habits](evidence/LF-130-live-habits.json), [rating/sort patch](evidence/LF-130-live-patch.json): actual Gemini structured proposals, model and token evidence.
- [Live tool](evidence/LF-130-live-tool.json): Gemini capability proposal, real Open Library test, explicit Pi execution, Gemini call of registered `openlibrary_search`, five returned books.
- [Host lifecycle](evidence/LF-130-host-tool-cycle.json): real Fastify/PGlite/persistent registry with local test identity (not Google OAuth), pending approval, pre-enable 403, v1→v2 publication, retained record, false→true reuse, two successful audit rows, real HTTPS and Pi events.

Historical LF-130 reproduction commands (do not run against the obsolete development ledger after Neon migration; use the configured host and durable budget): `node --env-file=.env --import tsx packages/agent/scripts/live-smoke.ts reading` (also `habits`, `patch`, `tool`). Host lifecycle: `node --import tsx packages/agent/scripts/host-tool-smoke.ts`. These are explicit opt-in smoke scripts; ordinary tests do not call providers. Do not print environment files or credentials.

Voice/vision/TTS were outside LF-130 and are now implemented and provider-verified in [LF-181 media runtime](media-runtime.md); browser integration is tracked separately. Backend owns durable authorization/registry/audit, frontend owns Owner approval and component rendering, DevOps owns actual deployment and provider configuration.
