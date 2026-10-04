# LF-202 · Study, discovery and local tools

2026-10-03 America/Vancouver. This is local module development. The deployed 12-component release and production database are separate.

## Implemented

`apps/web/src/modules/tools.tsx` exports 16 distinct modules through `toolModules`. They consume the shared module frame, scoped records and registered field bindings. CSS uses the existing skin tokens and a named `module` container query so narrow desktop tiles also collapse input rows. Touch targets are at least 40 px through the shared controls; independent custom buttons are 44 px. Breathing transitions respect reduced motion.

| Module | Interaction and binding |
| --- | --- |
| flashcards | Two ordered text fields, flip question/answer, previous/next |
| quiz | Two ordered text fields, typed answer checking, per-record score and restart |
| random-picker | Select a record from the visible collection; optional no-repeat pool |
| pomodoro | Explicit focus/break start, pause, reset; bounded focus duration |
| stopwatch | Explicit start, pause, reset, up to 50 lap splits |
| breathing-guide | Explicit three-phase breathing start/pause/reset; bounded cycle duration |
| calculator | Four explicit arithmetic operations, finite-number/divide-zero checks, local history |
| unit-converter | Length, mass and temperature with explicit conversion primitives |
| search-panel | Writes the renderer's shared browser-local search context |
| filter-panel | Enum/boolean controls write the same shared filter context |
| tag-cloud | Counts categories and selects their matching records |
| text-reader | Last bound text field, record selection and local text size |
| word-counter | Last bound text field/local draft, Unicode words and characters, paragraphs/read time |
| markdown-viewer | Last bound text or bounded configured text; headings/bold/code/lists/quotes/web links |
| link-directory | Bound record text fields, local search, safe web link navigation |
| recipe-scaler | Numeric valueField × local multiplier, original quantities preserved |

Timers measure timestamps; their intervals only refresh display and are cleared on pause/unmount. UI explicitly labels ephemeral tools and drafts. These controls do not persist scores, timer sessions, calculations, reader preferences or recipe previews, and never start external devices/services. Search/filter state affects the current browser's collection view, not business records or SSE.

Markdown is a React-rendered subset with no HTML execution, raw HTML insertion, arbitrary code interpreter or embedded media. External navigation accepts only complete HTTP/HTTPS URLs without embedded credentials. No remote link previews are requested. Calculator uses a fixed arithmetic branch, never `eval`/`Function`.

## Planner discovery

`planner.ts` provides all 60 manifests to Pi/Gemini and a bounded TypeBox size/config schema matching the authoritative contracts. The prompt describes local state, ordered field binding, manifest config keys, 24 instances/page, responsive desktop grid units and frontend-versus-tool gaps. Existing presentation is preserved during unrelated changes.

`module-composer.ts` is the explicitly labeled offline `local-rules` fallback. It matches individual manifest IDs (hyphens or spaces), selected Chinese/common labels, binds fields/actions by required primitive types, and composes modules into the existing app. It does not select whole-app templates for new modules. It adds safe optional fields when necessary, retains stable IDs/data, uses manifest action/config allowlists and runs the authoritative evolution validator. Missing capacity produces a capability gap. It does not claim broad natural-language understanding equal to Gemini.

## Verification

Offline planner tests cover each of 48 extended types, all 60 structured enum entries, valid ordered bindings, preservation of schema/IDs and configured modules, bounded sizes/configuration, unsafe/unsupported input rejection and the 24-module ceiling. No provider calls or quota changes are part of LF-202. Browser interaction/responsiveness results are recorded in the role handoff once run; integration and final all-60 coverage belong to coordinator/QA LF-203/204.

Verified final: 79/79 agent unit tests (56 module-composer, 12 existing planner/tool, 11 media), repository TypeScript check, and 49/49 actual Chrome checks passed. The Chrome run covers all 16 modules at 320px mobile and 1440px with narrow 3-column tiles, interactions, escaped HTML/unsafe markdown links, shared filter results, local draft boundaries, timestamp timer states, interval cleanup on pause/unmount and zero browser errors. The initial reader range input had 2px native-margin overflow; fixed with scoped margin reset and all responsive cases rerun. Desktop widths now use the accepted 3–12 column bound. Browser evidence: [JSON](../memory/handoffs/agent/LF-202-a903b374-browser.json), [mobile screenshot](../memory/handoffs/agent/LF-202-a903b374-reader-mobile.png). These are sample-data tests, not real provider or production acceptance.
