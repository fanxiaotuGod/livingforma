# LF-204 module expansion acceptance

Verified on 2026-10-03 17:40 America/Vancouver. QA session `440496ff-3b82-495f-8bf4-641aee81b0f5`. No confirmed open defects remain in the tested scope.

| Check | Result | Evidence |
| --- | --- | --- |
| All 60 catalog entries at 320, 390, 768, 1440 and narrow desktop | 300/300 passed; no page errors, global overflow, escaped content or hidden clipped controls | [matrix.json](matrix.json) |
| Changed modules after coordinator fixes, mobile320 and narrow desktop | 20/20 passed | [matrix-retest.json](matrix-retest.json) |
| Eight analytics + eight input module behaviors and actual local persistence/SSE/authorization | 22/22 passed | [interactions.json](interactions.json) |
| Invalid settings, retained/stale drafts, delayed save, ranking and card variants | 11/11 passed | [regressions.json](regressions.json) |
| Form/calendar/kanban compact and detail hero variants, mobile + narrow PC | 8/8 passed | [variants.json](variants.json) |
| Actual idle CameraScene and enabled ToolResult controls at320 and1440 narrow PC | 4/4 passed; zero device starts, provider/tool invokes or page errors | [capability-shells.json](capability-shells.json) |

The five matrix conditions were real Chromium viewports, not only CSS preview controls. Measured module widths were 288px at viewport320, 358px at390, 324px at768, 660px at1440, and 318px at1440 with three desktop columns. Document widths matched each viewport exactly after layout settled. The matrix uses six clearly labeled sample records; camera/tool-result deliberately show safe device/service placeholders. Thus the matrix certifies their gallery scaffolds, not a new camera/AI/tool provider invocation.

Supplemental capability checks render the actual CameraScene and ToolResult in a separate temporary PGlite server on4319. Explicit local fixture adapters expose capability/tool metadata, while provider and invoke methods throw if requested. No camera button or tool button is activated. At320 and1440 with three columns, real enabled controls are contained and document widths match the viewport. The camera preview measures234×240 and260×240 respectively; its icon remains34px with text visible. All media-session requests and provider/tool call counters remain zero. This verifies real idle shells, not device/provider execution.

## Behaviors and real persistence

Analytics checks independently calculate expected totals/shares/counts, ranking and chart source-record access. Inputs cover actual sample create/update operations, selected-record isolation, range submission and text saving. These are explicitly in-browser sample mutations.

Persistence checks use the actual local HTTP API, PGlite and local planner, without response mocks. The Owner signs in through the explicit local test-identity UI, creates a separate QA space, adds/configures/resizes a number-stepper and saves. Reload preserves its title, columns, minimum height and density. The save preserves entity schema, actions, business values and stateVersion. A separate anonymous browser receives the new module by SSE; a real numeric update subsequently persists and reaches that browser. Anonymous write attempts show sign-in and leave data unchanged. A concurrent remote layout publication preserves the local draft and disables stale Save until the editor is reopened. See [persistence.json](persistence.json).

The review regressions independently verify coordinator fixes: bins=0 and precision=-1 cannot crash the app or be saved; leaderboard limit selects the true highest values; unsaved text/range drafts survive record switching; concurrent real updates keep the draft and block stale overwrites; all layout controls lock while a presentation request is held and then continued to the real API. The temporary request delay is a transport fixture, not a mocked response. Legacy variant tests compare computed styles and geometry, verifying that variant controls change presentation rather than only changing a class name.

## Visual evidence

- [Analytics desktop viewport](gallery-desktop.png), [planning mobile viewport](gallery-mobile.png).
- [Saved Owner desktop](owner-persisted-desktop.png), [anonymous mobile after SSE](anonymous-persisted-mobile.png).
- [Detail hero at320](variant-detail-320.png), [calendar compact in318px desktop container](variant-calendar-grid-1440.png).
- [Actual idle camera at320](actual-camera-320.png), [actual enabled tool controls at320](actual-tool-320.png).

QA visually inspected the detail, calendar, anonymous saved page, gallery and actual idle camera screenshots. Text and controls remain contained and readable. Long field content wraps; inherent data tables use local scrolling. Root performs its own CUA visual review separately.

## Harness history and scope

Early attempts were corrected for tsx's serialized-function helper and exact accessible-name selectors, including labels that changed during parallel implementation. A suspected hero overflow immediately after switching viewport1440→320 was independently reproduced as transient document geometry: no element escaped, a fresh320 load fit, and settled width returned320 within500ms. The final assertion waits boundedly for layout to settle; the final card test passes. These were harness/viewport-settle findings, not unresolved product defects.

Supplemental shell testing found the real camera icon collapsed to zero height in a narrow preview. Coordinator's initial minimum-height fix then exposed aspect-ratio-driven horizontal expansion at320. The final scoped rule removes that aspect constraint, sets width100% and height240px, and prevents icon shrinking. QA independently reran all four shell checks successfully with explicit preview/control containment assertions; no defect remains open.

All five QA scripts pass scoped TypeScript checking and `git diff --check` passes. Reproducible scripts: [matrix](../../../tests/e2e/module-expansion.ts), [interactions](../../../tests/e2e/module-interactions.ts), [review regressions](../../../tests/e2e/module-regressions.ts), [legacy variants](../../../tests/e2e/module-variants.ts), [actual capability shells](../../../tests/e2e/module-capability-shells.ts). Run them with the repository's Node22.19+ environment; the first four use the isolated local server on5173 and the last starts its own local4319 server against the built web output. Real fixture setup on5173 is guarded by health database=pglite and planner=local. Fixture spaces use `qa-modules-*` or `qa-drafts-*` and live only in this temporary local database.

No real Google/provider/cloud database call, paid resource, publication, commit or push occurred. Existing camera/provider evidence is unchanged; this suite does not claim physical-device, Safari/Firefox or production verification. Browser processes and the supplemental4319 server were closed; the coordinator's local server remains running.
