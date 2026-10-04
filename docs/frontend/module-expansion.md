# Collection, planning and management modules

LF-201 · 2026-10-03 · Local implementation. These 16 modules extend the shared 60-type catalog accepted in LF-199; they are reusable record views, not whole-app templates. Registration, generic resizing/configuration and persistence are integrated by LF-200/LF-203.

| Module | Useful scenarios | Behavior and binding |
| --- | --- | --- |
| `data-table` | Research inventory, contacts, reading log | Search visible field values, toggle column sorting, open a record |
| `record-accordion` | Journal, support notes, project briefs | Keyboard-operable native disclosure for each record and its bound fields |
| `comparison-table` | Product shortlist, trip options, proposals | Select up to four records and compare fields side by side |
| `timeline` | Project history, travel route, release milestones | Valid dated records in chronological order |
| `agenda` | Deadlines, appointments, maintenance schedule | Today/upcoming/past groups in the space timezone |
| `week-board` | Weekly work, study plan, meal preparation | Monday–Sunday schedule with previous/next/current-week navigation |
| `milestone-stepper` | Course steps, onboarding, delivery stages | Ordered records; completion from the first bound boolean or a `done`/`complete`/`completed`/`finished` enum value |
| `priority-matrix` | Task triage, risk review, opportunity scoring | First two bound numeric fields are X/Y; `target` is the high/low threshold; incomplete pairs remain explicitly unclassified |
| `goal-meter` | Savings, reading pages, fundraising | Sum of `valueField` against positive `target`; progress and remaining amount |
| `budget-breakdown` | Travel budget, department spend, project cost | First numeric field is actual, second is budget; optional enum `groupBy`; balance per category |
| `balance-sheet` | Cash flow, effort comparison, resource allocation | First numeric total minus second numeric total with original field labels |
| `habit-matrix` | Exercise, study, practice routines | Last seven days from a `dates` field; today toggles only through matching authorized `record.checkin` |
| `date-countdown` | Launches, renewals, upcoming trips | Days until/since each bound date, calculated at UTC noon to avoid daylight-saving drift |
| `inventory-levels` | Pantry, supplies, equipment quantities | Numeric stock and low-threshold indicator; missing quantity is visibly unknown |
| `expense-calendar` | Daily spending, daily output, tracked effort | Month navigation, daily numeric totals, selected-day record details |
| `export-panel` | Reports, personal backup, offline review | Field-selectable CSV/JSON of only the current projected view; CSV formula neutralization |

All numerical modules accept empty data without exceptions. Dates are validated before formatting. No module mutates records merely by sorting, navigating or selecting. Record opening delegates to the existing renderer so its action IDs and server authorization remain in force. Check-in uses the shared `useWrite`; no local storage pretends to persist business changes.

Sizing uses the accepted common `size.columns`/`minHeight` contract and the surrounding named `module` container. `collections.css` adapts to **container width**, including a narrow module on a wide screen. Weekly columns reduce from seven to four, two, then one; priority and detail layouts stack; only genuine tables/calendars retain internal horizontal scrolling. Buttons/disclosure rows/touch labels have at least 40px activation height. Native table headings, checkbox labels, dates, progress semantics, focus outlines and reduced-motion feedback are retained. Themes inherit existing skin variables.

Export limits itself to `records(p)` (all current projected/filter-visible records, unless an explicit allowed limit is configured) and `fields(p)` (bound fields in the server-projected schema). JSON does not spread the raw record or its metadata. CSV quotes every cell and prefixes formula-like text, including leading whitespace/control characters, with an apostrophe. Export is local to the browser and creates no external request.

Verification: scoped and full-repository strict TypeScript checks passed. [Offline evidence](../memory/handoffs/frontend/LF-201-31e546d8-evidence.json) covers 48 SSR renders (populated/empty/missing fields), malformed dates, safe export, and all 16 layouts at 320px/390px plus narrow/wide desktop containers. [React browser evidence](../memory/handoffs/frontend/LF-201-31e546d8-dynamic.json) covers 48 mounted layouts and ten groups of interaction checks: search/sort, keyboard disclosure/open record, comparison selection limit, week navigation, exact goal/balance calculations, check-in toggle/undo, expense month/day changes, actual CSV/JSON downloads. Zero page errors and zero API calls. The gallery caught a real auxiliary screen-reader text overflow, fixed by anchoring it to its record button. Both sets use explicit sample records; persistence and independent full-catalog QA remain LF-200/LF-203/LF-204. No provider call or deployment is part of LF-201.

Skills: adapted `frontend-dev` responsive hierarchy and `animations` CSS feedback/accessibility guidance; MiniMax Phase 3 omitted per project policy. Optional screen-recorder/video-analyser skills are unavailable. No frame-rate measurement is claimed.
