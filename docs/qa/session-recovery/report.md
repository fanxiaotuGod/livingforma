# LF-211 independent session recovery regression

**Verified: 16/16 browser scenarios passed, zero browser JavaScript errors, no open blocker found in the reviewed LF-210 hotfix.** Final run completed at 2026-10-04 00:54:55 UTC (2026-10-03 17:54 America/Vancouver), exit 0. This is local release-candidate verification; production redeployment and the hosted Google session-rotation check remain with the coordinator/DevOps.

The isolated `fix/session-recovery` worktree is based on `3325718596cca11e794b4525eb98c3ea5efc8405`, with frozen runtime base `7efaa919361be0165f8bc0bf20852f0c0e2b37b6`. The browser loaded the final `index-Bt_tUXM1.js` production bundle. [Source manifest](source-manifest.json) fingerprints the reviewed application and test files. Unverified module work in the primary checkout is excluded.

## Method and results

[Runnable regression](../../../tests/e2e/session-recovery.ts) starts an actual Fastify HTTP server on localhost:4327, an in-memory PGlite database, and actual Chrome contexts. Each scenario uses a fresh API instance/rate limiter and a separate browser context. Google is replaced by the explicit local Owner/Participant personas. The planner runs local rules; tool and media provider adapters are local fixtures. Camera hardware is Chrome's virtual device. Selected successful **real HTTP responses** are delayed to expose races; the server decides authentication, CSRF, status, persistence, and publication. The CSRF race forwards an old header with a newly rotated actual cookie and receives the server's real 403.

| Independent scenario | Observed result |
| --- | --- |
| Same Owner, rotated cookie/CSRF | Exactly one proposal POST 200 and one planner call; sage publication, records and URL preserved; successful draft cleared |
| Stale Owner action after Participant login | Zero proposal POSTs; Owner draft hidden and restored only when original Owner returns |
| Stale Owner action after logout | Zero proposal POSTs; draft preserved across anonymous browsing and original Owner recovery |
| Rotation between preflight GET and POST | One real 403, zero planner calls, no automatic retry, draft retained; explicit second click yields one 200 and one planner call |
| Late proposal response after navigation | Current URL unchanged; original space draft still present on return |
| Late tool approval after account change | No old ToolSpec or approval UI exposed; Owner draft retained |
| Late create response after account change | No navigation or cross-account draft leak; original Owner creation title retained |
| Out-of-order identity reads | Earlier Owner response cannot restore Owner after newer Participant evidence; zero proposal POSTs |
| Private space becomes inaccessible | Owner controls and private record disappear even though Participant snapshot returns 404 |
| Tool invocation with rotation and late response | Exactly one authorized POST 200; late private tool result not rendered under Participant |
| Media response arrives after same-user rotation | Camera tracks end; no late description or audio playback; one device acquisition, zero playback events |
| Participant writes after rotation | Book creation and habit check-in succeed; book action sends one POST |
| Same-user logout after rotation | Exactly one logout POST; anonymous public view remains usable |
| Stale Owner logout after Participant login | Zero logout POSTs; Participant session stays active |
| Parallel same-user form and tool intents | Reversed session-read completion still yields exactly one successful POST for each intent |
| Private membership revoked without session/token change | Real 404 removes private data and finishes loading with an English error and Reconnect control |

[Machine results](results.json) record all 16 passes and fixture invocation counts. [Media lifecycle evidence](media-stop.json) records one camera acquisition, one ended track, zero playback events and no retained audio. All created browser contexts, local API instances and the in-memory database were closed. Existing development and cloud services were not used or stopped.

## Final source review

The request boundary preflights every protected write with an uncached session read, compares the originating account, and performs at most one write. The only raw cleanup exception is best-effort media-session DELETE with its original token; it cannot start media or replay work. Backend CSRF, Origin and authorization checks are unchanged.

Reviewed identity/page revisions reject stale reads and writes; explicit invalidation also fences pending preflights and pre-logout session reads. Out-of-order same-user reads reuse the latest accepted session. Token-only rotation preserves business forms while stopping media; an account transition or 401/403 clears privileged view state. Drafts are stored by account and component/space; legacy command migration requires a confirmed Owner and tolerates unavailable storage. Source search found the sole application `fetch` boundary in `session-client.ts`. Current 401/403/404 snapshot failures also verify identity/page/slug before clearing old content and finishing with a recoverable error state; stale failures cannot affect a newer view.

Frontend separately reports 12 request-boundary unit tests plus 5 media tests, typecheck and production build passing. QA reviewed those tests, including explicit invalidation during preflight and delayed pre-logout reads. Those unit results are supporting evidence, distinct from the 16 independently executed HTTP/browser scenarios. The coordinator owns the final whole-repository check and publication.

## Historical attempts and limits

- [First run](first-run-rate-limit.json): seven passes, then a setup timeout and local persona endpoint 429s. The harness had accumulated scenarios in one API rate limiter. It now creates a fresh real API instance per case; the product limiter was not weakened.
- [Second run](second-run-pre-refinement.json): thirteen passes; the final stale-logout case timed out waiting for the initial Owner orb before entering its test body. The final frontend refinement, a bounded 9-second setup wait and diagnostic setup capture were applied before the complete 15-pass run. The old setup timeout was not independently attributed to a product defect. That intermediate 15-pass run is preserved in [its own evidence](fifteen-pass-before-membership-fix.json).
- A final additional membership-revocation test found that the first 404-clear patch hid private content but left an indefinite loading skeleton. [Failure JSON](membership-first-run-404-loading.json) and [screenshot](membership-first-run-404-loading.png) preserve the actual failure. Frontend now ends the current failed refresh with the error and Reconnect control. All 16 scenarios passed on the final bundle; [the final screenshot](membership-revocation.png) was visually reviewed.
- An initial harness-only attempt tried to install a Fastify hook after startup and failed before scenarios ran. Observation now uses the Node HTTP server's completed-response event.
- QA's scoped strict TypeScript check covers this standalone script, which is outside the root tsconfig include. Its compile-time cleanup after the browser run changes no runtime behavior. Scoped whitespace and report-link checks passed before handoff.
- No `.env`, real Google roundtrip, production/provider request, physical camera/microphone, quota reset, paid resource, or deployment was used. Local fixture results do not prove those integrations.
- A request already committed by the server before navigation can remain committed. The client suppresses its obsolete response and preserves the draft; this fix does not promise rollback of an already accepted write.

## Run

```sh
pnpm --filter @livingforma/web build
pnpm exec tsx tests/e2e/session-recovery.ts
```

The script requires the repository dependencies and installed Chrome. It exits nonzero for a failed scenario or browser JavaScript error. LF-211 evidence covers the session hotfix only; the coordinator should use it alongside the final repository checks and hosted acceptance.
