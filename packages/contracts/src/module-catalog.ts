// Trusted module catalog. Behavior lives in the corresponding React registry.
export const EXTENDED_COMPONENT_TYPES = ["data-table", "record-accordion", "comparison-table", "timeline", "agenda", "week-board", "milestone-stepper", "priority-matrix", "metric-grid", "line-chart", "donut-chart", "histogram", "scatter-plot", "activity-heatmap", "leaderboard", "funnel", "checklist", "rating-input", "number-stepper", "range-input", "segmented-input", "toggle-panel", "quick-add", "text-editor", "goal-meter", "budget-breakdown", "balance-sheet", "habit-matrix", "date-countdown", "inventory-levels", "expense-calendar", "export-panel", "flashcards", "quiz", "random-picker", "pomodoro", "stopwatch", "breathing-guide", "calculator", "unit-converter", "search-panel", "filter-panel", "tag-cloud", "text-reader", "word-counter", "markdown-viewer", "link-directory", "recipe-scaler"] as const;
export const EXTENDED_MODULES = [
  {
    "id": "data-table",
    "category": "Collection",
    "description": "Sortable records with a text search",
    "bindings": [
      "fields",
      "sort"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "record-accordion",
    "category": "Collection",
    "description": "Expandable long-form records",
    "bindings": [
      "fields"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "comparison-table",
    "category": "Collection",
    "description": "Select records and compare their fields",
    "bindings": [
      "fields"
    ],
    "actions": [],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "timeline",
    "category": "Planning",
    "description": "Chronological events and milestones",
    "bindings": [
      "dateField",
      "fields"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "agenda",
    "category": "Planning",
    "description": "Today, upcoming and past deadlines",
    "bindings": [
      "dateField",
      "fields"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "week-board",
    "category": "Planning",
    "description": "Browse records across a seven-day schedule",
    "bindings": [
      "dateField",
      "fields"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "milestone-stepper",
    "category": "Planning",
    "description": "Ordered stages and completion states",
    "bindings": [
      "fields",
      "sort"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "priority-matrix",
    "category": "Planning",
    "description": "Classify records using two numeric priorities",
    "bindings": [
      "fields"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "target",
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "metric-grid",
    "category": "Analytics",
    "description": "Count, total, average and range of a numeric field",
    "bindings": [
      "valueField"
    ],
    "actions": [],
    "configKeys": [
      "precision",
      "prefix",
      "suffix"
    ],
    "defaultColumns": 6
  },
  {
    "id": "line-chart",
    "category": "Analytics",
    "description": "Daily numeric totals over time",
    "bindings": [
      "dateField",
      "valueField"
    ],
    "actions": [],
    "configKeys": [
      "precision",
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "donut-chart",
    "category": "Analytics",
    "description": "Category proportions with readable legend",
    "bindings": [
      "groupBy",
      "valueField"
    ],
    "actions": [],
    "configKeys": [
      "precision"
    ],
    "defaultColumns": 6
  },
  {
    "id": "histogram",
    "category": "Analytics",
    "description": "Numeric distribution grouped into bins",
    "bindings": [
      "valueField"
    ],
    "actions": [],
    "configKeys": [
      "bins",
      "precision"
    ],
    "defaultColumns": 6
  },
  {
    "id": "scatter-plot",
    "category": "Analytics",
    "description": "Compare two numeric dimensions",
    "bindings": [
      "fields"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "limit",
      "precision"
    ],
    "defaultColumns": 6
  },
  {
    "id": "activity-heatmap",
    "category": "Analytics",
    "description": "Daily activity intensity across recent weeks",
    "bindings": [
      "dateField"
    ],
    "actions": [],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "leaderboard",
    "category": "Analytics",
    "description": "Rank records by a numeric measure",
    "bindings": [
      "fields",
      "valueField"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "limit",
      "precision",
      "suffix"
    ],
    "defaultColumns": 6
  },
  {
    "id": "funnel",
    "category": "Analytics",
    "description": "Current counts in ordered workflow stages",
    "bindings": [
      "groupBy"
    ],
    "actions": [],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "checklist",
    "category": "Input",
    "description": "Toggle record completion with a checkbox",
    "bindings": [
      "fields"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "rating-input",
    "category": "Input",
    "description": "Edit a bounded numeric star rating",
    "bindings": [
      "fields",
      "valueField"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "number-stepper",
    "category": "Input",
    "description": "Increase or decrease a record quantity",
    "bindings": [
      "fields",
      "valueField"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "step"
    ],
    "defaultColumns": 6
  },
  {
    "id": "range-input",
    "category": "Input",
    "description": "Adjust and explicitly save a numeric range",
    "bindings": [
      "fields",
      "valueField"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "step"
    ],
    "defaultColumns": 6
  },
  {
    "id": "segmented-input",
    "category": "Input",
    "description": "Choose an enum status for a record",
    "bindings": [
      "fields",
      "groupBy"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "toggle-panel",
    "category": "Input",
    "description": "Edit several boolean settings on one record",
    "bindings": [
      "fields"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "quick-add",
    "category": "Input",
    "description": "Quickly create records with typed field validation",
    "bindings": [
      "fields"
    ],
    "actions": [
      "record.create"
    ],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "text-editor",
    "category": "Input",
    "description": "Edit and explicitly save a long text field",
    "bindings": [
      "fields"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "goal-meter",
    "category": "Goals",
    "description": "Track total progress against a target",
    "bindings": [
      "valueField"
    ],
    "actions": [],
    "configKeys": [
      "target",
      "precision",
      "suffix"
    ],
    "defaultColumns": 6
  },
  {
    "id": "budget-breakdown",
    "category": "Goals",
    "description": "Compare actual and budget values by category",
    "bindings": [
      "fields",
      "groupBy"
    ],
    "actions": [],
    "configKeys": [
      "precision",
      "prefix"
    ],
    "defaultColumns": 6
  },
  {
    "id": "balance-sheet",
    "category": "Goals",
    "description": "Totals and net difference of two numeric fields",
    "bindings": [
      "fields"
    ],
    "actions": [],
    "configKeys": [
      "precision",
      "prefix"
    ],
    "defaultColumns": 6
  },
  {
    "id": "habit-matrix",
    "category": "Goals",
    "description": "Habit rows and seven-day check-in matrix",
    "bindings": [
      "fields",
      "dateField"
    ],
    "actions": [
      "record.checkin"
    ],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "date-countdown",
    "category": "Planning",
    "description": "Days until or since a recorded date",
    "bindings": [
      "fields",
      "dateField"
    ],
    "actions": [],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "inventory-levels",
    "category": "Goals",
    "description": "Highlight quantities below a numeric threshold",
    "bindings": [
      "fields",
      "valueField"
    ],
    "actions": [],
    "configKeys": [
      "target",
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "expense-calendar",
    "category": "Goals",
    "description": "Daily numeric totals and selected-day details",
    "bindings": [
      "dateField",
      "valueField"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "precision",
      "prefix"
    ],
    "defaultColumns": 6
  },
  {
    "id": "export-panel",
    "category": "Collection",
    "description": "Download visible records as CSV or JSON",
    "bindings": [
      "fields"
    ],
    "actions": [],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "flashcards",
    "category": "Study",
    "description": "Flip question and answer cards",
    "bindings": [
      "fields"
    ],
    "actions": [],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "quiz",
    "category": "Study",
    "description": "Check typed answers against record text",
    "bindings": [
      "fields"
    ],
    "actions": [],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "random-picker",
    "category": "Study",
    "description": "Randomly choose from the current collection",
    "bindings": [
      "fields"
    ],
    "actions": [],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "pomodoro",
    "category": "Tools",
    "description": "Local focus and break timer with pause and reset",
    "bindings": [],
    "actions": [],
    "configKeys": [
      "durationSeconds"
    ],
    "defaultColumns": 6
  },
  {
    "id": "stopwatch",
    "category": "Tools",
    "description": "Local elapsed timer and lap history",
    "bindings": [],
    "actions": [],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "breathing-guide",
    "category": "Tools",
    "description": "Start and stop a gentle breathing rhythm",
    "bindings": [],
    "actions": [],
    "configKeys": [
      "durationSeconds"
    ],
    "defaultColumns": 6
  },
  {
    "id": "calculator",
    "category": "Tools",
    "description": "Four-operation calculator with local history",
    "bindings": [],
    "actions": [],
    "configKeys": [
      "precision"
    ],
    "defaultColumns": 6
  },
  {
    "id": "unit-converter",
    "category": "Tools",
    "description": "Convert length, mass and temperature",
    "bindings": [],
    "actions": [],
    "configKeys": [
      "precision"
    ],
    "defaultColumns": 6
  },
  {
    "id": "search-panel",
    "category": "Discovery",
    "description": "Search text across the shared collection view",
    "bindings": [
      "fields"
    ],
    "actions": [],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "filter-panel",
    "category": "Discovery",
    "description": "Filter the shared view by category and completion",
    "bindings": [
      "fields",
      "groupBy"
    ],
    "actions": [],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "tag-cloud",
    "category": "Discovery",
    "description": "Category frequency and matching records",
    "bindings": [
      "groupBy"
    ],
    "actions": [
      "record.update"
    ],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "text-reader",
    "category": "Reading",
    "description": "Focused reading with adjustable text size",
    "bindings": [
      "fields"
    ],
    "actions": [],
    "configKeys": [],
    "defaultColumns": 6
  },
  {
    "id": "word-counter",
    "category": "Reading",
    "description": "Count characters, words and paragraphs",
    "bindings": [
      "fields"
    ],
    "actions": [],
    "configKeys": [
      "text"
    ],
    "defaultColumns": 6
  },
  {
    "id": "markdown-viewer",
    "category": "Reading",
    "description": "Read a safe Markdown subset without raw HTML",
    "bindings": [
      "fields"
    ],
    "actions": [],
    "configKeys": [
      "text"
    ],
    "defaultColumns": 6
  },
  {
    "id": "link-directory",
    "category": "Reading",
    "description": "Validated web links stored in records",
    "bindings": [
      "fields"
    ],
    "actions": [],
    "configKeys": [
      "limit"
    ],
    "defaultColumns": 6
  },
  {
    "id": "recipe-scaler",
    "category": "Tools",
    "description": "Scale numeric quantities across records",
    "bindings": [
      "fields",
      "valueField"
    ],
    "actions": [],
    "configKeys": [
      "scale",
      "precision",
      "suffix"
    ],
    "defaultColumns": 6
  }
] as const;
