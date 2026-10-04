# LF-223 independent ordinary generation acceptance

Verified local implementation gate, 2026-10-04 America/Vancouver. Session `78389b52-ff39-48a0-9ffc-2ade937f3f37`. No confirmed product defect remains in the tested scope. Real Gemini generation and the new public release remain coordinator/DevOps gates; this report does not complete them.

## Independent execution

| Evidence | Actual result | Boundary |
| --- | --- | --- |
| [Generated website script](../../../tests/e2e/generated-sites.ts) / [results](results.json) | 8/8 Chrome scenarios; zero page errors | Real host HTTP, SSE, PGlite, frame/CSP/MessageChannel, assets and QuickJS. The SiteGenerator source, tools and outline are explicit offline fixtures. |
| [Generated tool script](../../../tests/e2e/generated-tools.ts) / [results](../generated-tools/results.json) | 11/11 HTTP scenarios | Real QuickJS and physical PGlite/server restart. Tool authoring and the inserted pending crash-state reservation are explicit fixtures. |
| Existing ordinary generated/bridge/progress regressions | 28/28: generated12, bridge11, progress5 | Independently executed with local fixtures; no advanced browser probes. |
| QA script TypeScript and whitespace | Passed | Scoped strict TypeScript for both new scripts; `git diff --check` passed. |

The same browser pipeline published photo discovery with an actual mouse drag, then a searchable reading desk with create/update, then a server calculator. All three rendered and interacted at 1440px desktop and 390px phone without horizontal overflow: phone photo selection through keyboard, phone search filtering, and an actual Owner phone calculator invocation. This is viewport/Chrome interaction evidence, not physical touch-device verification. Records, private fields/defaults, photo IDs and the space URL survived the changes. The anonymous browser received definition and record changes through actual SSE without reloading its parent document.

Actual outline checkpoints first displayed a hero, then kept the same DOM section while changing its width and adding metrics/content. Partial source appeared as escaped text, with no iframe before a completed validated candidate. Phone/reduced-motion formation remained readable. The output is clearly labeled a placeholder sketch; no saved values or fabricated progress are implied. A complete candidate entered the opaque frame, called readiness and passed the actual host/browser check before Owner publication.

The reading-time tool performed actual original JavaScript aggregation through scoped public `progress` reads. Its two guest fixtures passed before atomic publication registered the exact source/version. The browser invoked it for an independently computed **969 minutes across five books**. A subsequent page reused the same digest, source and saved evidence without another tool candidate. Registry invocation counts advanced only on real deliberate executions.

Anonymous tool interaction opened host login with zero invocation POSTs. Participant has no usable tool binding or Owner orb. Private literals, backend source, digests, cookie and CSRF data were absent from generated frame state. The stable frame protocol may include `toolBindings: []`; an empty list does not disclose a binding. Preview could neither write records nor run tools.

A same-owner login rotated CSRF before a generated-page save. Protected preflight sent exactly one action POST, stored the record and updated the anonymous browser. Rotation rekeys the child frame, so the test verifies the new frame's saved list rather than an obsolete frame's status message. Another scenario let the real server complete a fourth tool execution, deliberately delayed only the local browser response, changed to Participant, and confirmed that old result could not appear in the new account's UI. Participant's subsequent attempt sent zero new invocation POSTs.

Ordinary invalid JavaScript received one concrete repair. A second invalid result left the published definition, records and tool registry untouched, with publication disabled. Existing ordinary regressions also independently covered stale definition/source/session, cancelled late generation, retained private defaults, scoped draft/history/assets, revoked SSE and restart recovery.

## Visual evidence

[Desktop formation](formation-desktop.png), [phone formation](formation-mobile.png), [desktop photo interaction](photo-desktop.png), [phone photo](photo-mobile.png), [desktop search](search-desktop.png), [phone search](search-mobile.png), [actual tested source](tested-tool.png), [desktop calculator](calculator-desktop.png), [phone calculator](calculator-mobile.png), [actual Owner phone calculation](calculator-owner-mobile.png). Representative phone formation/photo/calculator and desktop search were opened and visually inspected. Phone content scrolls vertically; screenshots capture the current viewport, not the entire child document. The raster is explicitly a one-pixel PNG fixture used to verify storage/bridge behavior, not generated photographic media.

## Existing isolation evidence and limits

Reviewed [LF-220 defensive handoff](../../memory/handoffs/backend/LF-220-951d4f9f-2f20-4f1e-95a9-32710a5580c8.md), the served loader and its existing four-browser-test source. Opaque sandbox, host-bound frame path, restrictive CSP, Trusted Types private parser/sanitizer, unsupported-browser fail-closed behavior and existing receiver evidence are Backend's prior defensive verification. QA ran normal functionality against that actual loader; it did **not** add or rerun advanced bypass/exploit probes. No universal browser network, CPU or process-RSS isolation claim is made. Current Chrome is the browser actually tested.

QuickJS heap/stack/deadline bounds are guest/runtime controls. The root reduced runtime concurrency from two to one for the free deployment resource; final browser scenarios passed with the one-worker contract. Free Docker behavior and any subsequent LF-229 runtime repair remain their own evidence. Durable reservations and restart recovery assume one API process per database; no distributed external exactly-once claim.

At handoff, Backend reports LF-229 ordinary runtime6/API10 passing, but the actual constrained free Docker adapter still has cold initialization/fixture or invocation timeouts. The smaller worker bundle alone did not clear that resource gate. **This is an unresolved deployment blocker**, recorded in [its actual performance report](../../memory/handoffs/backend/LF-229-88cc9a2e-8c04-4596-9301-c23057a822ef-performance.json). Local Chrome/QuickJS success cannot substitute for the free hosting check. Coordinator/Backend must resolve and verify it before the new public release.

Earlier QA failure files are retained as historical harness diagnostics. Initial drag coordinates landed on the native-draggable image; dragging the card's text region verified the intended pointer handler. A privacy assertion incorrectly rejected the empty `toolBindings` key, and a rotated-session assertion expected an obsolete frame's status. Both were corrected to the accepted protocol and actual saved-state behavior. No application change was made to conceal a failed assertion.

No `.env` read, Gemini/ElevenLabs/Neon/production call, allowance reset, paid resource, deployment, commit or push occurred in this QA task. Existing module/source changes were preserved. Model creativity/compatibility, real provider budgets and actual hosted generation belong to LF-227 and the new release task; prior production eedd1d4 remains separate evidence.

## Replay

Use the configured Node24/pnpm11 runtime and an existing web production build:

```sh
pnpm exec tsx tests/e2e/generated-tools.ts
pnpm exec tsx tests/e2e/generated-sites.ts
pnpm exec vitest run apps/api/src/generated.test.ts apps/web/src/generated/bridge.test.ts apps/web/src/generated/progress.test.ts
pnpm exec tsc --noEmit --target ES2023 --module ESNext --moduleResolution Bundler --strict --skipLibCheck --esModuleInterop --jsx react-jsx tests/e2e/generated-tools.ts tests/e2e/generated-sites.ts
```

Scripts start/stop only their own services on 4348/4349, contexts and temporary databases. They never import server.ts or load production environment. Both reports state which injected values are fixtures.
