# General website studio and runtime

Implemented locally in LF-222, 2026-10-03 America/Vancouver. This supersedes the old catalog-only frontend boundary. The 60 reusable modules remain available as optional materials. `generated-site` is a separate runtime surface, excluded from the Add module gallery.

The Owner orb opens the website studio by default. A normal prompt starts the general generation API and displays its real stages, source checkpoints, escaped HTML/CSS/JS, and isolated preview. Source is never evaluated in the host page. New-space creation first creates an unconfigured space and then uses the same generation flow; a generation failure leaves that blank space and its account-scoped prompt available for retry. The classic module composer remains an explicit secondary option.

A candidate stays read-only until its exact revision reports browser startup and the Owner explicitly selects **Publish website**. Runtime errors are bounded and sent to the existing one-repair API. A startup check is not a claim that every generated interaction has been exhaustively tested. Cancelling a job suppresses late previews; navigation and identity changes invalidate ports and results. The Studio shows actual errors and never advances a fabricated progress bar.

## Frame and bridge

`GeneratedSite.tsx` embeds the server frame endpoint with `sandbox="allow-scripts"`, without same-origin privileges, and disables device permissions. The server bootstrap owns CSP, Trusted Types and source loading. Unsupported Trusted Types browsers fail closed with a compatibility message; this iteration's real browser checks use Chrome. No complete CPU-isolation claim is made.

The host accepts one transferred MessagePort only from the current iframe, opaque `null` origin, exact random channel and bridge version. Requests have strict method/parameter/size checks, unique IDs, bounded rate, and a single write/selection in flight. Source, space, account/session revision and page changes close old ports. Host state is reprojected on every update; even Owner frames see only public bound fields and actions, never auth/CSRF data, private values or admin permissions. LF-226 adds narrowly bound Owner-only tool invocation metadata as described below.

- `ready` / subscription: public schema, records, bound actions and effective permissions.
- `create`, `update`, `remove`, `checkIn`: host chooses the matching bound action and record version; server reauthorizes each protected write. Delete needs a host confirmation. Anonymous requests open host sign-in and are not replayed automatically.
- `pickImage`: host file chooser explicitly selects one PNG/JPEG/WebP. The client scales/compresses a raster, then the server independently validates it. Store the returned asset reference in a text field or artifact asset list.
- `image`: resolves only references exposed by the current artifact/public record projection or a current upload. The API independently checks access. Refresh and new published versions preserve referenced images.
- `reportReady` / `reportError`: bounded browser diagnostics for the current candidate revision.

The reviewed LF-210 session guard was manually integrated into the primary checkout without replacing the 60-module renderer or role history. Every ordinary protected write preflights `/api/session`, uses fresh same-account CSRF, rejects changed identities before POST, and never silently replays a rejection. A same-account refresh can revoke the old generated frame while the one intended business write completes; the new frame receives authoritative saved state. Account-scoped drafts, original Owner command migration, private snapshot 401/403/404 clearing, and old-device cleanup semantics remain intact. Presentation writes also use this guard.

## Verification and replay

Run from the repository with Node 22.19+ and installed workspace dependencies:

```sh
pnpm exec tsc --noEmit
pnpm exec vitest run apps/web/src/lib/session-client.test.ts apps/web/src/generated/bridge.test.ts apps/web/src/lib/media.test.ts
pnpm --filter @livingforma/web build
pnpm exec tsx docs/memory/handoffs/frontend/LF-222-browser.mts
```

The browser script launches a temporary local API on `localhost:4328`, in-memory PGlite, real Chrome, and an explicitly offline source generator. It calls no Gemini/ElevenLabs/Neon service and closes its server/browser. Evidence: [results](../memory/handoffs/frontend/LF-222-browser-results.json), [desktop](../memory/handoffs/frontend/LF-222-studio-desktop.png), [mobile](../memory/handoffs/frontend/LF-222-studio-mobile.png).

The 9 browser scenarios cover general Owner/new-space entry, source escaping, custom JavaScript and read-only preview, publication/CRUD, same-account rotated CSRF, image upload/refresh/evolution, visitor login and host delete confirmation, one actual runtime-error repair, cancellation, account/space-scoped launch consumption, desktop/mobile layout, keyboard tabs/focus return, reduced motion, and the separate 60-module gallery. The one expected page error is deliberately injected by the repair fixture. Independent adversarial QA and actual provider integration belong to LF-223/coordinator, not this fixture evidence.

Visual inspection caught and fixed inherited narrow modal sizing. The desktop studio is 1320px wide at the tested 1440px viewport, and the 390px preview has no document overflow. Dynamic motion uses Motion/reduced-motion guidance; the paid MiniMax asset flow and unavailable recording/analysis skills were skipped. Build succeeds with a 771.53kB JavaScript chunk warning; no performance trace or frame-rate claim is made.

## LF-226 extension

The Studio now visually forms a safe wireframe from actual `Progress.ui` checkpoints, with stable section transitions, reduced motion and phone layouts. Its Tools tab shows escaped generated tool source and actual host test evidence, including exact-version reuse. `lf.runTool` is a protected, current-definition-bound bridge operation; preview is disabled and anonymous calls never replay after login. See [generated tool frontend](generated-tools.md) for the protocol, new tests and evidence boundaries. The latest baseline replay preserves the original LF-222 evidence and is saved separately under LF-226.

## LF-232 · Report an interaction issue

An Owner can use **Report an issue** beneath a preview or checked candidate, describe what failed in 1–500 characters, and explicitly select **Request repair**. This sends the current source revision to the existing protected preview-report endpoint with `ok: false`. It uses the same single host repair allowance as validation/startup failures; no new model loop or automatic retry was added. Once used, the UI explains how to include further feedback in the description and create another revision.

The original prompt and published app remain intact. Feedback is account/job/revision-scoped and survives closing its form. A rejected report retains its text and error, keeps publication blocked for that reported candidate, and requires another explicit action. Pending requests prevent duplicate submissions and publication. Identity/page/job changes discard late UI; monotonic job merging prevents an older report acknowledgment from replacing a newer source revision. Only the reported source revision suppresses duplicate startup diagnostics, so a repaired candidate can still finish its check if the earlier response arrives late.

Verification: full TypeScript and Vite build passed (`index-DIgLXu9Q.js`, 791.91 kB / 240.58 kB gzip, existing size warning). Three feedback-boundary tests, five progress tests and twelve session tests passed. [Five real Chrome/local host scenarios](../memory/handoffs/frontend/LF-232-browser-results.json) use PGlite and an explicitly offline generator, proving actual host repair stage/sourceRevision progression, one-attempt guidance, preserved prompt/data/URL, rejected-report recovery, reordered responses, changed-account zero POST and late navigation discard. Rejection/delayed-delivery routes are labeled transport fixtures. No provider, cloud or actual PhotoDrift repair claim is made here.

Replay with `pnpm exec tsx docs/memory/handoffs/frontend/LF-232-browser.mts` after web build; it owns temporary port 4348 and closes its resources. [Desktop feedback](../memory/handoffs/frontend/LF-232-feedback-desktop.png) and [phone guidance](../memory/handoffs/frontend/LF-232-feedback-mobile.png) were visually inspected; 390px has no horizontal overflow. The UI uses existing English typography, keyboard controls and reduced-motion feedback, without paid assets.
