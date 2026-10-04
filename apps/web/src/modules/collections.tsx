import {useState, type ReactNode} from 'react';
import type {DataRecord, EntityField} from '@livingforma/contracts';
import {dateField, dates, dayAdd, EmptyModule, field, fields, format, groupField, Hint, number, records, text, title, today, useWrite, valueField, type ModuleProps, type ModuleRegistry} from './shared';
import './collections.css';

const dayLabel = (day: string, options: Intl.DateTimeFormatOptions = {month: 'short', day: 'numeric'}) => new Intl.DateTimeFormat('en-US', {...options, timeZone: 'UTC'}).format(new Date(`${day}T12:00:00Z`));
const validDates = (value: unknown) => dates(value).filter(day => {const stamp = new Date(`${day}T12:00:00Z`); return Number.isFinite(stamp.getTime()) && stamp.toISOString().slice(0, 10) === day;});
const numeric = (p: ModuleProps) => fields(p).filter(f => f.type === 'number');
const percent = (value: number) => Math.min(100, Math.max(0, value));
const signed = (p: ModuleProps, value: number) => `${value > 0 ? '+' : ''}${format(p, value)}`;
function RecordLink({p, record, children}: {p: ModuleProps; record: DataRecord; children?: ReactNode}) {return <button className="collection-record-link" onClick={() => p.onSelect(record)}>{children ?? title(p, record)}</button>;}
function FieldDetails({p, record}: {p: ModuleProps; record: DataRecord}) {return <dl className="collection-details">{fields(p).map(f => <div key={f.id}><dt>{f.label}</dt><dd>{text(record.values[f.id])}</dd></div>)}</dl>;}
function ScrollTable({label, children}: {label: string; children: ReactNode}) {return <div className="module-scroll collection-table-scroll" role="region" aria-label={label} tabIndex={0}><table className="collection-table">{children}</table></div>;}
function Meter({value, label}: {value: number; label: string}) {return <div className="collection-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent(value))}><span style={{transform: `scaleX(${percent(value) / 100})`}}/></div>;}
function DayRecords({p, rows, empty = 'Nothing scheduled.'}: {p: ModuleProps; rows: DataRecord[]; empty?: string}) {return rows.length ? <ul className="collection-records">{rows.map(r => <li key={r.id}><RecordLink p={p} record={r}/></li>)}</ul> : <p className="module-hint">{empty}</p>;}
function datedRows(p: ModuleProps) {const date = dateField(p); return date ? records(p).flatMap(record => validDates(record.values[date.id]).map(day => ({record, day}))).sort((a, b) => a.day.localeCompare(b.day)) : [];}
function Need({message}: {message: string}) {return <EmptyModule message={message}/>;}

function DataTable(p: ModuleProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{field: string; descending: boolean} | null>(null);
  const columns = fields(p);
  const rows = records(p).filter(r => columns.some(f => text(r.values[f.id]).toLowerCase().includes(query.toLowerCase())));
  if (sort) rows.sort((a, b) => {const av = a.values[sort.field], bv = b.values[sort.field]; return (typeof av === 'number' && typeof bv === 'number' ? av - bv : text(av).localeCompare(text(bv))) * (sort.descending ? -1 : 1);});
  return <div className="module-stack"><label className="module-field">Search records<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a record"/></label><Hint>{rows.length} matching {rows.length === 1 ? 'record' : 'records'}</Hint>{rows.length && columns.length ? <ScrollTable label="Records table"><thead><tr>{columns.map(f => <th key={f.id} scope="col" aria-sort={sort?.field === f.id ? sort.descending ? 'descending' : 'ascending' : 'none'}><button className="collection-sort" onClick={() => setSort({field: f.id, descending: sort?.field === f.id && !sort.descending})}>{f.label}<span aria-hidden="true">{sort?.field === f.id ? sort.descending ? '↓' : '↑' : '↕'}</span></button></th>)}<th scope="col">Record</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}>{columns.map(f => <td key={f.id}>{text(r.values[f.id])}</td>)}<td><RecordLink p={p} record={r}>Open<span className="collection-sr-only"> {title(p, r)}</span></RecordLink></td></tr>)}</tbody></ScrollTable> : <Need message={query ? 'No records match this search.' : 'Add a record and choose fields for your table.'}/>}</div>;
}

function RecordAccordion(p: ModuleProps) {const rows = records(p); return rows.length ? <div className="collection-accordion">{rows.map(r => <details key={r.id}><summary>{title(p, r)}<span aria-hidden="true">＋</span></summary><div className="collection-accordion-body"><FieldDetails p={p} record={r}/><RecordLink p={p} record={r}>Open record</RecordLink></div></details>)}</div> : <EmptyModule/>;}

function ComparisonTable(p: ModuleProps) {
  const rows = records(p), columns = fields(p);
  const [selection, setSelection] = useState<string[] | null>(null);
  const selectedIds = selection ?? rows.slice(0, 2).map(r => r.id);
  const selected = rows.filter(r => selectedIds.includes(r.id));
  return rows.length ? <div className="module-stack"><fieldset className="collection-choice-group"><legend>Compare up to four records</legend><div className="collection-choices">{rows.map(r => <label key={r.id}><input type="checkbox" checked={selectedIds.includes(r.id)} disabled={selected.length >= 4 && !selectedIds.includes(r.id)} onChange={e => setSelection(e.target.checked ? [...selected.map(r => r.id), r.id] : selectedIds.filter(id => id !== r.id))}/><span>{title(p, r)}</span></label>)}</div></fieldset>{selected.length ? <ScrollTable label="Record comparison"><thead><tr><th scope="col">Field</th>{selected.map(r => <th scope="col" key={r.id}>{title(p, r)}</th>)}</tr></thead><tbody>{columns.map(f => <tr key={f.id}><th scope="row">{f.label}</th>{selected.map(r => <td key={r.id}>{text(r.values[f.id])}</td>)}</tr>)}</tbody></ScrollTable> : <Need message="Select a record above to compare its fields."/>}</div> : <EmptyModule/>;
}

function Timeline(p: ModuleProps) {
  const entries = datedRows(p), current = today(p);
  return entries.length ? <ol className="collection-timeline">{entries.map(({record, day}) => <li key={`${record.id}:${day}`} className={day === current ? 'is-today' : ''}><span className="collection-timeline-dot" aria-hidden="true"/><time dateTime={day}>{dayLabel(day, {month: 'short', day: 'numeric', year: 'numeric'})}</time><RecordLink p={p} record={record}/></li>)}</ol> : <Need message="Connect a date field and add dated records to build a timeline."/>;
}

function Agenda(p: ModuleProps) {
  const entries = datedRows(p), current = today(p);
  const groups = [{label: 'Today', rows: entries.filter(e => e.day === current)}, {label: 'Upcoming', rows: entries.filter(e => e.day > current)}, {label: 'Past', rows: entries.filter(e => e.day < current).reverse()}];
  return entries.length ? <div className="collection-agenda">{groups.map(group => <section key={group.label}><h3>{group.label}<span>{group.rows.length}</span></h3>{group.rows.length ? group.rows.map(({record, day}) => <div className="collection-agenda-row" key={`${record.id}:${day}`}><time dateTime={day}>{dayLabel(day)}</time><RecordLink p={p} record={record}/></div>) : <Hint>No {group.label.toLowerCase()} events.</Hint>}</section>)}</div> : <Need message="Add a date to a record to start your agenda."/>;
}

function WeekBoard(p: ModuleProps) {
  const [offset, setOffset] = useState(0), current = today(p);
  const monday = dayAdd(current, -((new Date(`${current}T12:00:00Z`).getUTCDay() + 6) % 7) + offset * 7);
  const days = Array.from({length: 7}, (_, i) => dayAdd(monday, i));
  const entries = datedRows(p);
  if (!dateField(p)) return <Need message="Choose a date field to organize a week."/>;
  return <div className="module-stack"><div className="collection-navigation"><button className="module-button" aria-label="Previous week" onClick={() => setOffset(n => n - 1)}>←</button><strong>{dayLabel(days[0]!)} – {dayLabel(days[6]!)}</strong><button className="module-button" aria-label="Next week" onClick={() => setOffset(n => n + 1)}>→</button><button className="module-button" onClick={() => setOffset(0)}>This week</button></div><div className="collection-week">{days.map(day => <section key={day} className={day === current ? 'is-today' : ''}><h3><span>{dayLabel(day, {weekday: 'short'})}</span><time dateTime={day}>{dayLabel(day, {day: 'numeric'})}</time></h3><DayRecords p={p} rows={entries.filter(e => e.day === day).map(e => e.record)}/></section>)}</div></div>;
}

function MilestoneStepper(p: ModuleProps) {
  const rows = records(p), done = field(p, 'boolean'), status = groupField(p);
  const completed = (r: DataRecord) => done ? r.values[done.id] === true : status ? /^(done|complete|completed|finished)$/i.test(String(r.values[status.id])) : false;
  const count = rows.filter(completed).length;
  return rows.length ? <div className="module-stack"><Hint>{count} of {rows.length} milestones complete{!done && !status ? ' · Connect a completion or status field to track progress.' : ''}</Hint><Meter value={count / rows.length * 100} label="Milestone completion"/><ol className="collection-milestones">{rows.map((r, index) => <li key={r.id} className={completed(r) ? 'is-complete' : ''}><span className="collection-step" aria-label={completed(r) ? 'Complete' : `Step ${index + 1}`}>{completed(r) ? '✓' : String(index + 1).padStart(2, '0')}</span><div><RecordLink p={p} record={r}/><span className="module-hint">{completed(r) ? 'Complete' : status ? text(r.values[status.id]) : 'Pending'}</span></div></li>)}</ol></div> : <EmptyModule/>;
}

function PriorityMatrix(p: ModuleProps) {
  const [x, y] = numeric(p), threshold = p.spec.config?.target ?? 50, rows = records(p);
  if (!x || !y) return <Need message="Choose two numeric fields, in horizontal then vertical order, to map priorities."/>;
  const groups = [{label: 'High / High', highX: true, highY: true}, {label: 'Low / High', highX: false, highY: true}, {label: 'High / Low', highX: true, highY: false}, {label: 'Low / Low', highX: false, highY: false}];
  const usable = rows.filter(r => typeof r.values[x.id] === 'number' && typeof r.values[y.id] === 'number');
  return <div className="module-stack"><Hint>{x.label} / {y.label} · High is {threshold} or above</Hint><div className="collection-priority">{groups.map(group => {const items = usable.filter(r => (number(r.values[x.id]) >= threshold) === group.highX && (number(r.values[y.id]) >= threshold) === group.highY); return <section key={group.label}><h3>{group.label}<span>{items.length}</span></h3><DayRecords p={p} rows={items} empty="No records in this quadrant."/></section>;})}</div>{usable.length < rows.length && <Hint>{rows.length - usable.length} {rows.length - usable.length === 1 ? 'record needs' : 'records need'} both numeric values.</Hint>}</div>;
}

function GoalMeter(p: ModuleProps) {
  const value = valueField(p), rows = records(p), target = p.spec.config?.target ?? 100;
  if (!value) return <Need message="Choose a numeric field to measure your goal."/>;
  if (!rows.length) return <EmptyModule/>;
  const total = rows.reduce((sum, r) => sum + number(r.values[value.id]), 0), progress = target > 0 ? total / target * 100 : 0;
  return <div className="collection-goal"><span className="module-hint">{value.label}</span><strong>{format(p, total)}</strong><span>of {format(p, target)}</span><Meter value={progress} label={`${value.label} goal progress`}/><p>{target <= 0 ? 'Set a target greater than zero to track progress.' : total >= target ? 'Goal reached. Keep the momentum.' : `${format(p, target - total)} to go`}</p><span className="collection-percent">{target > 0 ? `${Math.round(progress)}%` : '—'}</span></div>;
}

function BudgetBreakdown(p: ModuleProps) {
  const [actualField, budgetField] = numeric(p), category = groupField(p), rows = records(p);
  if (!actualField || !budgetField) return <Need message="Choose two numeric fields: actual first, budget second."/>;
  if (!rows.length) return <EmptyModule/>;
  const buckets = new Map<string, {actual: number; budget: number}>();
  rows.forEach(r => {const key = category ? text(r.values[category.id]) : 'All records', bucket = buckets.get(key) ?? {actual: 0, budget: 0}; bucket.actual += number(r.values[actualField.id]); bucket.budget += number(r.values[budgetField.id]); buckets.set(key, bucket);});
  return <div className="module-stack"><Hint>{actualField.label} against {budgetField.label}</Hint>{[...buckets].map(([label, totals]) => <section className="collection-budget" key={label}><div className="collection-split"><h3>{label}</h3><span>{format(p, totals.actual)} / {format(p, totals.budget)}</span></div><Meter value={totals.budget > 0 ? totals.actual / totals.budget * 100 : 0} label={`${label} budget used`}/><p className="module-hint">{totals.budget <= 0 ? 'No positive budget set' : totals.actual > totals.budget ? `${format(p, totals.actual - totals.budget)} over budget` : `${format(p, totals.budget - totals.actual)} remaining`}</p></section>)}</div>;
}

function BalanceSheet(p: ModuleProps) {
  const [first, second] = numeric(p), rows = records(p);
  if (!first || !second) return <Need message="Choose two numeric fields to compare incoming and outgoing values."/>;
  if (!rows.length) return <EmptyModule/>;
  const a = rows.reduce((sum, r) => sum + number(r.values[first.id]), 0), b = rows.reduce((sum, r) => sum + number(r.values[second.id]), 0);
  return <dl className="collection-balance"><div><dt>{first.label}</dt><dd>{format(p, a)}</dd></div><div><dt>{second.label}</dt><dd>{format(p, b)}</dd></div><div className="collection-net"><dt>Net difference<span>{first.label} − {second.label}</span></dt><dd>{signed(p, a - b)}</dd></div></dl>;
}

function HabitMatrix(p: ModuleProps) {
  const writer = useWrite(p), date = dateField(p), rows = records(p), current = today(p);
  const days = Array.from({length: 7}, (_, i) => dayAdd(current, i - 6));
  const action = writer.action('record.checkin');
  const canCheck = !!action && action.fieldId === date?.id && p.snapshot.permissions.canWrite;
  if (!date || date.type !== 'dates') return <Need message="Choose a date-list field for daily habit check-ins."/>;
  if (!rows.length) return <EmptyModule/>;
  return <div className="module-stack"><ScrollTable label="Seven-day habit check-ins"><thead><tr><th scope="col">Habit</th>{days.map(day => <th scope="col" key={day}><time dateTime={day}>{dayLabel(day, {weekday: 'short'})}<span className="collection-day-number">{dayLabel(day, {day: 'numeric'})}</span></time></th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id}><th scope="row">{title(p, r)}</th>{days.map(day => {const checked = validDates(r.values[date.id]).includes(day); return <td key={day}>{day === current && canCheck ? <button className={`collection-check ${checked ? 'is-checked' : ''}`} aria-label={`${checked ? 'Undo' : 'Complete'} today's check-in: ${title(p, r)}`} aria-pressed={checked} disabled={writer.busy} onClick={() => void writer.write(r, {}, 'record.checkin')}>{checked ? '✓' : '＋'}</button> : <span className={`collection-check ${checked ? 'is-checked' : ''}`} aria-label={`${day}: ${checked ? 'completed' : 'not completed'}`}>{checked ? '✓' : '·'}</span>}</td>;})}</tr>)}</tbody></ScrollTable><Hint>{canCheck ? 'Select today’s cell to check in or undo. Earlier days are read-only.' : 'A view of the last seven days. Check-ins require an enabled action and write access.'}</Hint>{writer.error && <p className="form-error" role="alert">{writer.error}</p>}</div>;
}

function DateCountdown(p: ModuleProps) {
  const entries = datedRows(p), current = today(p), stamp = new Date(`${current}T12:00:00Z`).getTime();
  return entries.length ? <div className="collection-countdowns">{entries.map(({record, day}) => {const difference = Math.round((new Date(`${day}T12:00:00Z`).getTime() - stamp) / 86_400_000); return <div className="collection-countdown" key={`${record.id}:${day}`}><div><RecordLink p={p} record={record}/><time dateTime={day}>{dayLabel(day, {month: 'short', day: 'numeric', year: 'numeric'})}</time></div><div className="collection-days"><strong>{Math.abs(difference)}</strong><span>{difference === 0 ? 'today' : `${Math.abs(difference) === 1 ? 'day' : 'days'} ${difference < 0 ? 'ago' : 'left'}`}</span></div></div>;})}</div> : <Need message="Choose a date field to count down to your next milestone."/>;
}

function InventoryLevels(p: ModuleProps) {
  const value = valueField(p), threshold = p.spec.config?.target ?? 10, rows = records(p);
  if (!value) return <Need message="Choose a numeric quantity field to track stock."/>;
  if (!rows.length) return <EmptyModule/>;
  const withQuantity = rows.filter(r => typeof r.values[value.id] === 'number'), low = withQuantity.filter(r => number(r.values[value.id]) < threshold).length;
  return <div className="module-stack"><Hint>{low} below threshold · Reorder below {threshold}</Hint><div className="collection-inventory">{rows.map(r => {const known = typeof r.values[value.id] === 'number', quantity = number(r.values[value.id]); return <div key={r.id}><RecordLink p={p} record={r}/><strong>{known ? format(p, quantity) : '—'}<span>{value.label}</span></strong><span className={`collection-stock ${known && quantity < threshold ? 'is-low' : ''}`}>{!known ? 'Not set' : quantity < threshold ? 'Low stock' : 'In stock'}</span></div>;})}</div></div>;
}

function ExpenseCalendar(p: ModuleProps) {
  const current = today(p), [offset, setOffset] = useState(0), [selected, setSelected] = useState(current);
  const value = valueField(p), date = dateField(p), entries = datedRows(p);
  const month = new Date(`${current.slice(0, 7)}-01T12:00:00Z`); month.setUTCMonth(month.getUTCMonth() + offset);
  const monthKey = month.toISOString().slice(0, 7), first = `${monthKey}-01`;
  const count = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const days = Array.from({length: count}, (_, i) => `${monthKey}-${String(i + 1).padStart(2, '0')}`);
  const activeDay = selected.startsWith(monthKey) ? selected : first;
  const dayEntries = entries.filter(e => e.day === activeDay);
  const totalFor = (day: string) => entries.filter(e => e.day === day).reduce((sum, e) => sum + number(e.record.values[value?.id ?? '']), 0);
  if (!value || !date) return <Need message="Choose a date and numeric amount field to see daily totals."/>;
  return <div className="module-stack"><div className="collection-navigation"><button className="module-button" aria-label="Previous month" onClick={() => setOffset(n => n - 1)}>←</button><strong>{dayLabel(first, {month: 'long', year: 'numeric'})}</strong><button className="module-button" aria-label="Next month" onClick={() => setOffset(n => n + 1)}>→</button></div><div className="module-scroll collection-calendar-scroll" role="region" aria-label="Daily expense totals" tabIndex={0}><div className="collection-expense-grid">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span className="collection-weekday" key={day}>{day}</span>)}{Array.from({length: (month.getUTCDay() + 6) % 7}, (_, i) => <span key={`blank-${i}`} aria-hidden="true"/>)}{days.map(day => {const count = entries.filter(e => e.day === day).length, total = totalFor(day); return <button key={day} className={day === activeDay ? 'is-selected' : ''} aria-pressed={day === activeDay} aria-label={`${day}, ${format(p, total)}, ${count} records`} onClick={() => setSelected(day)}><span>{Number(day.slice(-2))}</span><strong>{count ? format(p, total) : '—'}</strong></button>;})}</div></div><section className="collection-expense-detail" aria-live="polite"><div className="collection-split"><h3>{dayLabel(activeDay)}</h3><strong>{format(p, totalFor(activeDay))}</strong></div>{dayEntries.length ? <ul className="collection-records">{dayEntries.map(({record}) => <li key={record.id}><RecordLink p={p} record={record}/><span>{format(p, number(record.values[value.id]))}</span></li>)}</ul> : <Hint>No records for this day.</Hint>}</section></div>;
}

// Exports use only the current server-projected rows and bound, visible fields.
// Apostrophe-prefix formula-like text before CSV quoting, including leading whitespace.
export function collectionCsvCell(value: unknown) {const raw = value === null || value === undefined ? '' : Array.isArray(value) ? value.join('; ') : String(value); const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(raw) || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`;}
export function collectionExportRows(rows: DataRecord[], columns: EntityField[]) {return rows.map(r => Object.fromEntries(columns.map(f => [f.id, r.values[f.id] ?? null])));}
function ExportPanel(p: ModuleProps) {
  const visibleFields = fields(p), rows = records(p);
  const [selection, setSelection] = useState<string[] | null>(null), [status, setStatus] = useState('');
  const chosen = visibleFields.filter(f => selection === null || selection.includes(f.id));
  function download(kind: 'csv' | 'json') {
    if (!chosen.length || !rows.length) return;
    const payload = kind === 'json' ? JSON.stringify(collectionExportRows(rows, chosen), null, 2) : [chosen.map(f => collectionCsvCell(f.label)).join(','), ...rows.map(r => chosen.map(f => collectionCsvCell(r.values[f.id])).join(','))].join('\r\n');
    const blob = new Blob([payload], {type: kind === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8'}), url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = `livingforma-records.${kind}`; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`${rows.length} records prepared as ${kind.toUpperCase()}.`);
  }
  return <div className="module-stack"><Hint>Download {rows.length} visible records. Hidden fields and private data outside this view are excluded.</Hint><fieldset className="collection-choice-group"><legend>Fields to include</legend><div className="collection-choices">{visibleFields.map(f => <label key={f.id}><input type="checkbox" checked={chosen.some(c => c.id === f.id)} onChange={e => setSelection(e.target.checked ? [...chosen.map(c => c.id), f.id] : chosen.filter(c => c.id !== f.id).map(c => c.id))}/><span>{f.label}</span></label>)}</div></fieldset><div className="module-row"><button className="module-button" disabled={!chosen.length || !rows.length} onClick={() => download('csv')}>Download CSV</button><button className="module-button" disabled={!chosen.length || !rows.length} onClick={() => download('json')}>Download JSON</button></div>{!rows.length && <Hint>Add records to enable downloads.</Hint>}<p className="module-hint" role="status">{status}</p></div>;
}

export const collectionModules: ModuleRegistry = {'data-table': DataTable, 'record-accordion': RecordAccordion, 'comparison-table': ComparisonTable, timeline: Timeline, agenda: Agenda, 'week-board': WeekBoard, 'milestone-stepper': MilestoneStepper, 'priority-matrix': PriorityMatrix, 'goal-meter': GoalMeter, 'budget-breakdown': BudgetBreakdown, 'balance-sheet': BalanceSheet, 'habit-matrix': HabitMatrix, 'date-countdown': DateCountdown, 'inventory-levels': InventoryLevels, 'expense-calendar': ExpenseCalendar, 'export-panel': ExportPanel};
