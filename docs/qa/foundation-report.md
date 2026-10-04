# LF-146 independent local foundation regression

Updated 2026-10-03 16:15 America/Vancouver after LF-147. This early review is complete; it does **not** approve final MVP or production release. Latest independent run: **18 passed, 0 failed**, command exit 0. Both LF-146 findings are fixed and independently retested. The historical 15/16 result remains in `foundation-lf146-final-results.json`.

## Reproduce

Use Node 24 and the repository's pinned pnpm. Build current frontend assets, then run:

```sh
pnpm --filter @livingforma/web build
pnpm exec tsx tests/e2e/foundation.ts
```

The script starts its own Fastify server at `http://localhost:4317`, an isolated in-memory PGlite database, the real Agent **local-rules** planner, and three independent headless Google Chrome browser contexts. It serves `apps/web/dist`; rebuild that directory after frontend changes. It closes its own browser/server/database and does not write the regular development database. Port 4317 must be free. No `.env` file, provider credentials, cloud database, Google roundtrip, Gemini or paid API calls are used.

## Verified

- English reading UI; anonymous has no Owner orb and API mutation is 401.
- Explicit local test identity; Owner orb focus and draft survive reopening.
- Actual form create, refresh, update and delete; independent anonymous browser receives real SSE changes.
- Participant writes records but server denies definition changes, tool proposals and registration; login does not make this identity Owner of seed spaces.
- Wrong Origin and CSRF fail without changing records; logout invalidates the prior session cookie.
- Real local-rules proposal adds rating, switches cards to list, applies rose skin, increments definition, preserves existing record IDs/values, unsaved add-form text and URL. Two other browsers receive the new view through actual SSE; no request interception or proposal fixture is used for this check.
- Unsupported external capability preserves the prior definition/records. Offline viewer keeps the last view and reconnects to actual snapshots/SSE.
- Habit check-in changes persisted dates, survives refresh, restores original values, and keeps URL.
- Participant creates a new habit application through UI and becomes that new space's Owner. Same renderer supports its calendar/dates, while pre-existing reading ownership stays separate.
- Creating a new space with an external-tool prompt safely returns `TOOL_APPROVAL_REQUIRED` with a create-first instruction and leaves no partially created space. This is a safe, less direct workflow; full new-space approval UX is not claimed.
- No browser JavaScript errors in the rendered flows.

## Findings

### QA-146-01 — Public projection may become invalid (fixed and independently retested)

A valid owner definition whose fields were all private produced a public definition with zero fields. Client `validateDefinition` requires at least one field; anonymous Chrome showed “A little pause.” plus the raw Zod error. A public schema can also retain a public field while losing every private-bound component.

Backend fixed both cases: non-Owner snapshots return `definition:null`, no records, no executable actions, and no write/login affordance. The Owner retains the complete definition. Latest independent API and Chrome checks pass for anonymous, Participant and Owner. Before/after screenshots are retained. These adversarial states are explicitly inserted fixtures; their projection and rendering run through real HTTP and Chrome.

### QA-146-02 — Rating field makes mobile page wider than viewport (fixed and independently retested in LF-147)

Reproduction: sign in as local Participant on a 390 × 844 reduced-motion browser; Owner publishes “Show books as a list, add rating and sort by rating with rose skin.” The rating field appears in the add form. Document width becomes **411px** for a **390px** viewport. The only overflowing element is the rating `<input class="sr-only">`, whose right edge is 411px.

`apps/web/src/components/Fields.tsx` placed this absolute input in a flex row. In `styles.css`, `.field input` had greater specificity than `.sr-only`, overriding the hidden input's width/padding. Coordinator fixed the rating container positioning and explicitly set `.field input.sr-only` to 1 × 1px with 0 padding, and allowed a 320px body. QA rebuilt no application code; it independently exercised the already rebuilt current assets.

The LF-147 run now checks **320, 390 and 430px** reduced-motion layouts after a real SSE morph. Document widths equal each viewport exactly; no element overflows. Each hidden input measures **1 × 1px, padding 0px**, so the fix removes the cause rather than masking page overflow. Actual screenshot `mobile-rating-320.png` was visually inspected; `mobile-rating-390.png`, `mobile-rating-430.png` and `mobile-dimensions.json` retain the other evidence. Historical defect evidence is in `mobile-before-fix.png` and `mobile-before-fix-dimensions.json`.

## Evidence and boundaries

Current machine-readable results: [foundation-results.json](foundation-results.json). The first run's list-view selector error was a QA harness issue and corrected; it is not a product bug. Historical reports distinguish that run from the subsequent reproducible findings. Screenshots show the actual isolated local application.

Not independently verified here: real Google OAuth, Gemini planning, actual Open Library tool invocation, voice/camera, production database durability, DNS/HTTPS, hosting or real-provider quota exhaustion. These belong to integration and LF-160/LF-170. Reduced-motion preference and functional continuity were verified, but this is not a frame-time/compositor benchmark.
