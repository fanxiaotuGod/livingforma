# Live formation and generated tool frontend

Implemented in LF-226, 2026-10-03 America/Vancouver. This extends the general website studio from LF-222; the 60 reusable modules, published records, URLs, image references, and session guard remain in place.

## Real checkpoints become visible structure

`GenerationStudio` consumes the host's actual `GenerationEvent.ui` through the accepted outline schema. `Formation` renders safe React wireframes for hero, collection, form, metrics, chart, media and content sections. Stable section IDs preserve element identity while Motion changes grid position, width and entrance/exit. Reduced motion updates immediately; phone sections use full width. These intermediate shapes are explicitly labeled placeholders, never displayed as saved data or executed as partial JavaScript.

No clock invents sections, percentages or stages. An absent outline shows honest waiting. Events are accepted only in increasing sequence/source revision; old revisions, cancelled/failed/published jobs, and older recovery snapshots cannot replace the current display. Source-revision changes clear the old candidate and reports. Validated complete source enters the existing isolated frame; browser checks and explicit publication still gate the live site.

## Owner evidence and exact tool bindings

The Tools tab displays original server JavaScript as escaped text, declared public fields/connectors, input/output contracts, and actual host test results. Pending source/tests are labeled honestly. New candidates come from the current job. Reused exact versions load source and saved test evidence from Owner-only `GET /api/spaces/:slug/code-tools`; no source, reports, credentials or endpoints enter the child frame.

The child calls `lf.runTool(toolId, toolVersion, input)`. The host validates bounded JSON and finds exactly one matching binding in the current authoritative component. The binding's trusted `kind` selects the generated or catalog endpoint. The host supplies current definition/component/action/version and a fresh request ID; ordinary protected requests preflight session/CSRF. The frame cannot supply an endpoint, action ID or registry operation. Server authorization and enabled-version validation remain authoritative.

Preview invocation is explicitly disabled. Anonymous calls open host login and require a new user action after login; there is no automatic replay. Current tools are Owner-only, so participants receive a permission error even when their public projection omits tool bindings. Pending, returned result and failure are visible in both the host feedback and child response. Identity/page/frame/source changes close the channel and discard old results. Only public bound values and permitted binding metadata are shared.

## Verification

```sh
pnpm typecheck
pnpm exec vitest run apps/web/src/generated/bridge.test.ts apps/web/src/generated/progress.test.ts apps/web/src/lib/session-client.test.ts apps/web/src/lib/media.test.ts
pnpm --filter @livingforma/web build
pnpm exec tsx docs/memory/handoffs/frontend/LF-226-browser.mts
pnpm exec tsx docs/memory/handoffs/frontend/LF-226-base-regression.mts
```

Use Node 22.19+ and installed workspace dependencies. Browser scripts launch and close their own Chrome/local API/PGlite on ports 4336 and 4337. They do not read production configuration or call external providers.

- 33 targeted tests passed: 11 bridge, 5 progress, 12 session guard, 5 media.
- [7 new Chrome scenarios](../memory/handoffs/frontend/LF-226-browser-results.json) passed with zero page errors. Generation jobs/progress, tool reports, registry and tool execution responses are explicitly supplied fixtures; Chrome, public API projection, local session guard, published storage, frame loader and MessageChannel are real. This does **not** prove QuickJS execution, Pi output quality, provider integration or production deployment.
- [9 baseline scenarios](../memory/handoffs/frontend/LF-226-base-regression-browser-results.json) passed with an offline generator through the real host pipeline. The single intentional startup error exercises repair. Source/preview/publish/CRUD, rotated CSRF, image persistence, login/delete confirmation, cancellation/new-space flow and 60-module gallery remain covered.
- Full TypeScript check and Vite build passed. Bundle `index-BrPTX2l6.js` is 788.13 kB (239.62 kB gzip), retaining Vite's size warning.
- [Desktop formation](../memory/handoffs/frontend/LF-226-formation-desktop.png), [phone formation](../memory/handoffs/frontend/LF-226-formation-mobile.png), and [tool evidence](../memory/handoffs/frontend/LF-226-tool-evidence.png) were visually inspected. No horizontal overflow at 390px. The phone modal scrolls vertically to retain all sections.

Initial integration exposed a non-Owner projection mismatch (tool actions removed but bindings retained); Backend fixed the projection consistently. Some immediate pointer clicks after cross-frame scrolling did not trigger the fixture handler in Chrome automation. Anonymous/image baseline checks use keyboard focus and Enter; ordinary published tool pointer calls also pass. This evidence is not an exhaustive pointer/browser compatibility claim. No frame-rate trace was captured. No advanced bypass tests, paid assets, dependency edits, provider requests, commits or deployment were performed in LF-226.
