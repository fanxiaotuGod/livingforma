# Adjustable module library

2026-10-03 America/Vancouver. Accepted target: 60 module types (12 existing + 48 additions). All 60 renderers and adjustable frames are implemented; independent responsive matrix 300/300 passed. Local integration acceptance passed: 22 interaction/persistence checks and 11 review regressions; see [QA evidence](../qa/module-expansion/). Production remains frozen at reviewed source 7efaa91.

Each module uses bounded desktop widths (3–12 of 12 grid columns) and optional minimum height (120–960 px), automatic full-width mobile layout, container-aware internals, touch/keyboard controls and reduced-motion support. No generated code, raw HTML, new paid services, or external media fetches. Twenty-four instances per page remain the limit; sixty is the catalog size. All records remain server-owned. Timers, calculators, reading preferences and filters are explicitly local session state.

| Module | Family | Behavior | Bindings | Options |
|---|---|---|---|---|
| `form` | Essentials | Create records using typed field validation | fields | density, showHeader |
| `cards` | Essentials | Collection cards with covers, compact or hero presentation | fields, sort, emphasis | density, showHeader, limit |
| `list` | Essentials | Dense or comfortable record list with available actions | fields, sort | density, showHeader, limit |
| `counter` | Essentials | Record count or numeric total | valueField | density, showHeader |
| `progress` | Essentials | Numeric progress summary | valueField | density, showHeader |
| `calendar-grid` | Essentials | Monthly check-in history and selected-day count | dateField | density, showHeader |
| `streak` | Essentials | Consecutive days of check-in activity | dateField | density, showHeader |
| `chart` | Essentials | Category distribution bars | groupBy, valueField | density, showHeader |
| `kanban` | Essentials | Records grouped into workflow columns | groupBy, fields | density, showHeader, limit |
| `detail` | Essentials | One record with default or hero presentation | fields | density, showHeader |
| `tool-result` | Essentials | Enabled read-only tool results (requires authorized real space) | toolRef | density, showHeader |
| `camera` | Essentials | Explicit Owner camera session (requires configured media services) | none | density, showHeader |
| `data-table` | Collection | Sortable records with a text search | fields, sort | limit |
| `record-accordion` | Collection | Expandable long-form records | fields | limit |
| `comparison-table` | Collection | Select records and compare their fields | fields | limit |
| `timeline` | Planning | Chronological events and milestones | dateField, fields | limit |
| `agenda` | Planning | Today, upcoming and past deadlines | dateField, fields | limit |
| `week-board` | Planning | Browse records across a seven-day schedule | dateField, fields | limit |
| `milestone-stepper` | Planning | Ordered stages and completion states | fields, sort | limit |
| `priority-matrix` | Planning | Classify records using two numeric priorities | fields | target, limit |
| `metric-grid` | Analytics | Count, total, average and range of a numeric field | valueField | precision, prefix, suffix |
| `line-chart` | Analytics | Daily numeric totals over time | dateField, valueField | precision, limit |
| `donut-chart` | Analytics | Category proportions with readable legend | groupBy, valueField | precision |
| `histogram` | Analytics | Numeric distribution grouped into bins | valueField | bins, precision |
| `scatter-plot` | Analytics | Compare two numeric dimensions | fields | limit, precision |
| `activity-heatmap` | Analytics | Daily activity intensity across recent weeks | dateField | limit |
| `leaderboard` | Analytics | Rank records by a numeric measure | fields, valueField | limit, precision, suffix |
| `funnel` | Analytics | Current counts in ordered workflow stages | groupBy |  |
| `checklist` | Input | Toggle record completion with a checkbox | fields | limit |
| `rating-input` | Input | Edit a bounded numeric star rating | fields, valueField |  |
| `number-stepper` | Input | Increase or decrease a record quantity | fields, valueField | step |
| `range-input` | Input | Adjust and explicitly save a numeric range | fields, valueField | step |
| `segmented-input` | Input | Choose an enum status for a record | fields, groupBy |  |
| `toggle-panel` | Input | Edit several boolean settings on one record | fields |  |
| `quick-add` | Input | Quickly create records with typed field validation | fields |  |
| `text-editor` | Input | Edit and explicitly save a long text field | fields |  |
| `goal-meter` | Goals | Track total progress against a target | valueField | target, precision, suffix |
| `budget-breakdown` | Goals | Compare actual and budget values by category | fields, groupBy | precision, prefix |
| `balance-sheet` | Goals | Totals and net difference of two numeric fields | fields | precision, prefix |
| `habit-matrix` | Goals | Habit rows and seven-day check-in matrix | fields, dateField | limit |
| `date-countdown` | Planning | Days until or since a recorded date | fields, dateField | limit |
| `inventory-levels` | Goals | Highlight quantities below a numeric threshold | fields, valueField | target, limit |
| `expense-calendar` | Goals | Daily numeric totals and selected-day details | dateField, valueField | precision, prefix |
| `export-panel` | Collection | Download visible records as CSV or JSON | fields |  |
| `flashcards` | Study | Flip question and answer cards | fields | limit |
| `quiz` | Study | Check typed answers against record text | fields | limit |
| `random-picker` | Study | Randomly choose from the current collection | fields |  |
| `pomodoro` | Tools | Local focus and break timer with pause and reset |  | durationSeconds |
| `stopwatch` | Tools | Local elapsed timer and lap history |  |  |
| `breathing-guide` | Tools | Start and stop a gentle breathing rhythm |  | durationSeconds |
| `calculator` | Tools | Four-operation calculator with local history |  | precision |
| `unit-converter` | Tools | Convert length, mass and temperature |  | precision |
| `search-panel` | Discovery | Search text across the shared collection view | fields |  |
| `filter-panel` | Discovery | Filter the shared view by category and completion | fields, groupBy |  |
| `tag-cloud` | Discovery | Category frequency and matching records | groupBy | limit |
| `text-reader` | Reading | Focused reading with adjustable text size | fields |  |
| `word-counter` | Reading | Count characters, words and paragraphs | fields | text |
| `markdown-viewer` | Reading | Read a safe Markdown subset without raw HTML | fields | text |
| `link-directory` | Reading | Validated web links stored in records | fields | limit |
| `recipe-scaler` | Tools | Scale numeric quantities across records | fields, valueField | scale, precision, suffix |

## Reusable use cases

- Travel: timeline + week-board + budget-breakdown + link-directory.
- Study: flashcards + quiz + pomodoro + goal-meter.
- Project delivery: milestone-stepper + priority-matrix + kanban + agenda.
- Habits: habit-matrix + activity-heatmap + streak + breathing-guide.
- Household inventory: data-table + inventory-levels + number-stepper + quick-add.
- Reading club: cards + rating-input + text-reader + comparison-table.
- Personal research: scatter-plot + histogram + filter-panel + export-panel.
- Recipe collection: record-accordion + recipe-scaler + checklist + unit-converter.

- Event planning: agenda + date-countdown + checklist + budget-breakdown.
- Team health: rating-input + metric-grid + line-chart + text-editor.
- Language practice: flashcards + quiz + stopwatch + habit-matrix.
- Workshop supplies: inventory-levels + number-stepper + data-table + export-panel.
- Product feedback: quick-add + segmented-input + leaderboard + tag-cloud.
- Savings: balance-sheet + expense-calendar + goal-meter + donut-chart.
- Garden care: calendar-grid + date-countdown + toggle-panel + record-accordion.
- Creative studio: random-picker + pomodoro + markdown-viewer + priority-matrix.

These are combinations, not hardcoded whole-app templates. Optional new external capabilities remain outside this local expansion.

## How to use and how it runs

Open `/modules` for a searchable, interactive sample gallery. It uses local sample records; reset clears playground drafts. Camera and external tool samples do not activate real services. In an owned space, use **Add module** or **Customize layout**, then **Configure** for title, desktop width/height, density, appearance, field selection and supported module options. Desktop pointer handles resize modules; the same values are available as keyboard/touch controls. Phones automatically use full width and content height. **Save layout** persists the definition and updates other viewers through SSE. Record data is unchanged by layout edits.

Vite serves the React/TypeScript app. A validated AppSpec selects registered React components, binds authorized schema fields and actions, and applies one of six existing palettes. CSS media/container queries respond to both the device and the module's own width; Motion respects reduced-motion preferences. Pi/Gemini receives the same versioned catalog, and the explicit local fallback can compose each new module offline. No generated code is executed.

The presentation endpoint is Owner-only, checks version/CSRF/origin, and supports safe replay. Invalid configuration is rejected before preview/save; pending saves lock layout controls. Text/range drafts retain their original record version, survive record switching in the current browser session, and require loading the latest value when another edit wins. Local timers, calculators and filters are labeled as local state.
