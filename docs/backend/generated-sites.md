# Generated websites backend

Implemented for LF-220 in the primary checkout, 2026-10-03 America/Vancouver. This is local development evidence, not a production deployment or a real model-generation acceptance claim. Existing component, media, identity and business-data flows remain in place.

## Jobs and publication

`buildApp({siteGenerator})` accepts the shared `SiteGenerator`. The adapter receives the prompt and current definition, never record values. Private field default values are removed from both current-definition and repair inputs; the host restores every existing private field's complete authoritative metadata before validation. Provider progress messages are replaced with fixed English descriptions of actual emitted stages. Bounded source checkpoints are retained as source data only; obvious credential-shaped checkpoints are withheld. Errors do not print provider payloads, source, cookies or credentials.

All generation operations use the existing Google/local AuthApi and AuthStore. The existing token hash resolves the original session; it is internal database metadata and never appears in a job response, frame, bridge or event. Mutations require exact Origin and CSRF. Short generation/publication transactions check and lock the original live session row and verify Owner access, using the current transaction connection. This avoids PGlite self-deadlock from an unrelated auth query inside a transaction.

| Endpoint | Behavior |
| --- | --- |
| POST `/api/spaces/:slug/generations` | Returns 202 and a queued job, or 200 for an identical durable retry. Payload fingerprint conflicts return 409. |
| GET `.../generations/:id` | Returns the original-session Owner's durable job and bounded events. |
| GET `.../:id/events?after=N` | Replays SSE `generation` events with increasing sequence IDs; checks session/Owner every 500 ms and closes on revocation or terminal status. Last-Event-ID is supported when after is absent. |
| POST `.../:id/preview` | Accepts only the current validated source revision. A successful Owner browser report marks it checked. A failure can start one repair, shared with automatic static-source repair. |
| POST `.../:id/publish` | Requires checked source, original live session, current Owner and unchanged base definition version. Revalidates source, schema evolution, retained records, enabled tools and asset ownership, then commits definition, business event, immutable history and request replay together. |
| POST `.../:id/cancel` | Aborts work, discards late success and preserves the published website. An already published job stays published. |
| GET `/api/spaces/:slug/versions` | Owner-only immutable version summaries. Restore is intentionally not implemented. |

One process runs at most four scheduled/active workers, with one active generation per space and a 90-second attempt lease/deadline. Original-session logout aborts locally; periodic checks catch external session deletion or lost ownership. A server restart marks interrupted jobs failed without another provider call. Expired leases become failed on access. Reconnecting never calls the generator. Progress is capped at 60 callbacks per attempt, 96 retained events per job and 180,000 source characters per attempt. There is no model fallback or allowance reset in this module.

The deployment contract is one worker process per database. Startup recovery deliberately interrupts unfinished work from the prior process; horizontal workers need a distributed lease-owner protocol before enabling multiple instances. A checked browser report means that specific Owner preview reported ready, not that every possible interaction has been exhaustively verified.

The legacy immediate proposal/create flow refuses generated source with `GENERATION_PREVIEW_REQUIRED`, ensuring it cannot bypass the studio's preview gate. Trusted module presentation edits continue to work. All definition publications now retain immutable history, including ordinary trusted definitions; migration 5 backfills each existing space's current version, not unknowable earlier history.

## Served browser boundary and bridge

`GET /api/generated-frame?space=SLUG&generation=ID&revision=N&channel=RANDOM` serves validated preview/checked candidates for the original Owner session. It does not require checked status to load, because the browser must first run the candidate to report ready. Published `?space=SLUG&version=N&channel=RANDOM` uses current space read authorization. The channel correlates a bridge; it grants no access.

The parent CSP pins `frame-src` to the exact configured origin's `/api/generated-frame` path. The child response replaces X-Frame-Options and the normal app CSP with opaque `sandbox allow-scripts`, `frame-ancestors 'self'`, inline-only scripts/styles, raster data/blob images, and no connections, external frames, objects, base URLs or form submissions. The frontend also sets `sandbox="allow-scripts"`; no allow-same-origin is used. Device Permissions-Policy is disabled and Referrer-Policy is no-referrer.

A real Chrome audit demonstrated that `frame-src 'none'` plus createElement stubs alone did not prevent a fresh `srcdoc` realm from recovering WebRTC. The implemented correction adds:

```text
require-trusted-types-for 'script'; trusted-types lf-parser lf-source default
```

Artifact strings are serialized as JSON with `<` escaped and are never parsed as document markup before the trusted bootstrap checks native Trusted Types support. Unsupported browsers show an English error and execute none of the artifact. A private parser policy supports an inert DOM sanitizer; a private source policy loads the initial validated script exactly once. Generated code cannot retrieve those policies, create an unlisted policy or duplicate their names. The default policy permits safe dynamic innerHTML updates while enforcing a strict HTML and limited SVG tag/attribute allowlist, removing active elements, event attributes, srcdoc, external URLs and nested foreign namespaces, including template contents. Native DOM accessors/methods are captured before generated code to resist prototype tampering. Dynamic script/ScriptURL policies are unavailable.

The bootstrap also blocks direct networking/worker/WebRTC constructors and customized built-in registration. These are defense layers, not a claim of complete CPU isolation or a proof against every future browser networking API. Generated code can still consume its document's CPU. Chromium is currently required; independent browser security review remains part of release acceptance.

The bootstrap exposes immutable `window.lf` and sends `{type:'lf:connect',channel,version:1}` with a MessagePort. Requests are `{id,method,params}`; responses are `{id,ok,result}` or `{id,ok:false,error:{code,message}}`; state pushes are `{type:'state',state}`. Methods are ready, create, update, remove, checkIn, pickImage, image, runTool, reportReady and reportError. `lf.ready` is a Promise and `lf.subscribe` returns an unsubscribe function. Request payloads are capped at 64 KiB and 32 simultaneous requests. Shared `GENERATED_BRIDGE_LIMITS` gives ordinary requests a 30-second reply timeout; only `pickImage` and `remove` use 180 seconds because their host workflow waits for a person. The frontend's separate human-choice deadline is 120 seconds, leaving time for a response or a chosen upload/mutation before child expiry. Parent cancellation/choice expiry must prevent late selection from starting a write; LF-234 owns that behavior. Replies, including cancellation, clear their pending timer; expiry removes the pending request, and pagehide closes the port and rejects/clears all pending work. Late replies do not settle an expired or cancelled promise again. Runtime diagnostics are capped at eight messages of 500 characters. The trusted frontend owns exact-frame/channel/session validation, public-field projection even for Owner, action selection, login handling, read-only previews and destructive-action confirmation. No credentials or business values are embedded in the frame response itself.

## Raster storage

POST `/api/spaces/:slug/assets` requires a current writer, Origin and CSRF, and accepts `{mimeType,dataBase64}`. The Owner can upload to an empty space before its first definition. PNG, JPEG and static WebP signatures/chunk or frame dimensions are checked; SVG, HTML, mismatched types, malformed structural headers, dimensions above 4096 pixels or decoded data above 512 KiB are rejected. This is a bounded header/structure check, not server-side raster decoding. The current implementation rejects animated WebP. A row-locked 20 MiB per-space quota prevents concurrent over-allocation; the upload endpoint is limited to 12 requests/minute. There is no URL fetcher, cloud-storage fallback or new paid storage.

GET assets is scoped to the same space. Draft images are visible only to uploader/Owner; other authorized readers can resolve references in public record fields or published source artifact.assetIds. Private-field references do not make an image public. Artifact publication rejects asset IDs belonging to another space. Only asset_ID strings belong in ordinary records; returned data URLs use the verified raster MIME.

Migration 5 adds `lf_generations`, `lf_definition_versions` and `lf_assets` to the existing Postgres/PGlite adapter. They persist in the selected database and participate in the same space publication transaction. The test suite closes and reopens a physical PGlite directory to verify jobs, history, images and existing sessions survive.

## Verification and integration

- `apps/api/src/generated.test.ts`: 12 offline Fastify/PGlite tests cover durable/concurrent request replay, private record/default exclusion, exact original session, Origin/CSRF/roles, candidate frame headers/access, preview and shared one-repair limit, cancellation, late results, stale versions, data-preserving evolution, immutable old source, SSE replay/revocation, raster permissions/quota and physical restart recovery.
- `apps/api/src/generated-browser.test.ts`: four real installed-Chrome tests cover ordinary DOM/button/SVG/MessageChannel functionality, 19 sink/capability probes, zero receiver requests from blocked outbound attempts/self-navigation, and an unsupported-Trusted-Types simulation that never parses or executes artifact source. These tests intentionally bypass static source validation to test the actual response boundary.
- LF-235 adds three ordinary installed-Chrome/MessageChannel cases with a deliberately delayed fixture host and accelerated Playwright clock: human choices still resolve/cancel after 60 seconds while ordinary requests expire; unanswered human requests expire at 180 seconds and discard late replies; pagehide cancels both classes. No asset/API write or provider is involved. The three new cases plus existing normal DOM test passed 4/4 in 4.44 seconds; the three historical boundary cases remain unchanged and were not rerun for this task. Whole TypeScript, API build and diff checks passed.
- Backend/browser/previous API/presentation/revocation/media/provider-budget/media-budget suite: 73/73 passed. TypeScript checking and API production bundling passed during this task; coordinator owns final cross-role integration verification.

Run the offline checks from the repository with bundled Node 24 and `pnpm exec vitest run apps/api/src/generated.test.ts apps/api/src/generated-browser.test.ts`. The ordinary API factory mounts these routes without a generator; starting a job then returns `GENERATOR_UNAVAILABLE`. LF-221 supplies the actual SiteGenerator and coordinator wires it in server.ts after its acceptance. This task did not load .env, contact Neon or a model, change an allowance, purchase, deploy, commit or push anything.
