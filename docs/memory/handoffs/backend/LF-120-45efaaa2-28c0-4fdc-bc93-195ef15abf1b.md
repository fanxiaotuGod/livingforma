# LF-120 backend handoff

2026-10-03, America/Vancouver. Session `45efaaa2-28c0-4fdc-bc93-195ef15abf1b`.

**Implemented:** real PGlite disk persistence with compatible pg adapter and two migrations; Fastify/DevOps AuthStore mount; Google subject/user mapping; atomic snapshots, definitions, records, defaults and SSE events; CSRF and owner/participant permissions; public/private projection; versions, request fingerprint idempotency, habit date toggles; durable tool registry/enablement/invocation counts/audits; API same-origin production static hosting. Source ownership stayed in apps/api/src and packages/db; coordinator added the required zod dependency/lock update.

**Verified:** 12 real PGlite/Fastify integration tests (including physical disk close/reopen and live HTTP SSE), API tsup build, repository typecheck, diff whitespace check. The test adapter is a fixture, explicitly not a supplier integration. No cloud database or real Google browser roundtrip was verified here.

**Entry points:** `buildApp` in apps/api/src/app.ts accepts `db`, `origin`, `planner`, `tools`, and auth configuration. server.ts loads root `.env`, defaults development storage to `.local/app-data/pglite`, and dynamically mounts Agent `planProposal` and `toolAdapter` or synchronous `createToolAdapter()`. The coordinator must check final Agent exports. Production requires `DATABASE_URL` or durable `DATA_DIR`, plus HTTPS `APP_ORIGIN`. Local identities and reading/habit seed require explicit development loopback gates; they do not exist in production.

**Integration details:** errors are English structured `{error:{code,message,requestId}}`. Tool routes match accepted GET `/tools`, POST `/tools` `{spec,enable}`, POST `/tools/:id/invoke` `{toolVersion,input,requestId}`. Missing/disabled tool references cannot publish, including on create-space. SSE sends version-only events, polls durable state every 750 ms, and sends reset.required for missing/future cursors. Database records, schema, versions and cursor are read together as one aggregate.

**Remaining beyond LF-120:** real PostgreSQL provider connection, Google roundtrip, Gemini and real tool adapter, frontend/browser independent acceptance, production domain/deployment and media lifecycle. Costs remain gated; no paid resources, commits or pushes were created.
