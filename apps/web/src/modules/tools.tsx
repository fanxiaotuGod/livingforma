import {useEffect, useId, useState, type ReactNode} from 'react';
import {EmptyModule, Hint, RecordSelect, fields, format, groupField, records, text, title, useRecord, useViewFilters, valueField, type ModuleProps, type ModuleRegistry} from './shared';
import './tools.css';

const LocalState = () => <Hint>Only in this browser. Resets when you leave this module.</Hint>;
const button = 'module-button';
const prettyNumber = (value:number, precision=4) => Number.isFinite(value) ? value.toLocaleString('en-US', {maximumFractionDigits:precision}) : 'Out of range';
const timeLabel = (ms:number) => {const s=Math.max(0,Math.floor(ms/1000));return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;};

/** The interval only refreshes the display; elapsed time is derived from timestamps. */
function useClock() {
  const [base,setBase]=useState(0),[started,setStarted]=useState<number|null>(null),[now,setNow]=useState(Date.now());
  useEffect(()=>{if(started===null)return;const id=window.setInterval(()=>setNow(Date.now()),200);return()=>window.clearInterval(id);},[started]);
  const elapsed=base+(started===null?0:Math.max(0,now-started));
  return {elapsed,running:started!==null,start:()=>{if(started===null){const n=Date.now();setNow(n);setStarted(n);}},pause:()=>{if(started!==null){setBase(base+Math.max(0,Date.now()-started));setStarted(null);}},reset:()=>{setBase(0);setStarted(null);setNow(Date.now());}};
}

function Flashcards(p:ModuleProps) {
  const deck=records(p),pair=fields(p).filter(f=>f.type==='text'),[index,setIndex]=useState(0),[flipped,setFlipped]=useState(false);
  const selected=deck[index%Math.max(1,deck.length)];
  useEffect(()=>setFlipped(false),[selected?.id]);
  if(pair.length<2)return <EmptyModule message="Bind two text fields in question, answer order."/>;
  if(!selected)return <EmptyModule message="Add question and answer records to start studying."/>;
  function move(delta:number){setIndex((index+delta+deck.length)%deck.length);setFlipped(false);}
  return <div className="module-stack tool-study"><div className="tool-eyebrow">{index%deck.length+1} / {deck.length} · {flipped?'Answer':'Question'}</div><button type="button" className="tool-flashcard" aria-label={flipped?'Answer; flip to question':'Question; flip to answer'} aria-pressed={flipped} onClick={()=>setFlipped(!flipped)}><span key={`${selected.id}-${flipped}`} className="tool-card-text">{text(selected.values[pair[flipped?1:0].id])}</span><small>Tap to {flipped?'see question':'reveal answer'}</small></button><div className="module-row"><button type="button" className={button} onClick={()=>move(-1)}>Previous</button><button type="button" className={button} onClick={()=>move(1)}>Next card</button></div><LocalState/></div>;
}

function Quiz(p:ModuleProps) {
  const deck=records(p),pair=fields(p).filter(f=>f.type==='text'),[index,setIndex]=useState(0),[answer,setAnswer]=useState(''),[checked,setChecked]=useState(false),[score,setScore]=useState<Record<string,boolean>>({});
  const selected=deck[index%Math.max(1,deck.length)];
  useEffect(()=>{setAnswer('');setChecked(false);},[selected?.id]);
  if(pair.length<2)return <EmptyModule message="Bind two text fields in question, answer order."/>;
  if(!selected)return <EmptyModule message="Add question and answer records to create a quiz."/>;
  const expected=text(selected.values[pair[1].id]),correct=answer.trim().normalize('NFKC').toLocaleLowerCase()===expected.trim().normalize('NFKC').toLocaleLowerCase();
  const results=Object.entries(score).filter(([id])=>deck.some(r=>r.id===id));
  return <form className="module-stack tool-study" onSubmit={e=>{e.preventDefault();if(!answer.trim()||checked)return;setChecked(true);setScore({...score,[selected.id]:correct});}}><div className="tool-eyebrow">Question {index%deck.length+1} of {deck.length}</div><p className="tool-question">{text(selected.values[pair[0].id])}</p><label className="module-field">Your answer<input value={answer} maxLength={2000} onChange={e=>setAnswer(e.target.value)} disabled={checked} autoComplete="off"/></label><div aria-live="polite">{checked&&<p className={correct?'tool-success':'tool-feedback'}>{correct?'Correct.':`Answer: ${expected}`}</p>}</div><div className="module-row"><button className={button} disabled={!answer.trim()||checked}>Check answer</button><button type="button" className={button} onClick={()=>{setIndex((index+1)%deck.length);setChecked(false);setAnswer('');}}>Next question</button><button type="button" className={button} onClick={()=>{setScore({});setIndex(0);setChecked(false);setAnswer('');}}>Restart</button></div><Hint>{results.filter(([,value])=>value).length} correct / {results.length} answered · Answers match ignoring case and surrounding spaces.</Hint><LocalState/></form>;
}

function RandomPicker(p:ModuleProps) {
  const choices=records(p),[picked,setPicked]=useState(''),[used,setUsed]=useState<string[]>([]),[unique,setUnique]=useState(false);
  const pool=unique?choices.filter(r=>!used.includes(r.id)):choices,selected=choices.find(r=>r.id===picked);
  if(!choices.length)return <EmptyModule message="Add records to choose from."/>;
  return <div className="module-stack"><div className="tool-pick" aria-live="polite">{selected?title(p,selected):'Let chance choose'}</div><label className="tool-check"><input type="checkbox" checked={unique} onChange={e=>{setUnique(e.target.checked);setUsed([]);}}/>Avoid repeats</label><div className="module-row"><button className={button} type="button" disabled={!pool.length} onClick={()=>{const r=pool[Math.floor(Math.random()*pool.length)];setPicked(r.id);setUsed([...used,r.id]);}}>Pick a record</button><button className={button} type="button" onClick={()=>{setPicked('');setUsed([]);}}>Reset pool</button></div><Hint>{pool.length} choice{pool.length===1?'':'s'} available.</Hint><LocalState/></div>;
}

function Pomodoro(p:ModuleProps) {
  const focus=p.spec.config?.durationSeconds??1500,[mode,setMode]=useState<'focus'|'break'>('focus'),clock=useClock();
  const duration=(mode==='focus'?focus:300)*1000,remaining=Math.max(0,duration-clock.elapsed),done=remaining===0;
  useEffect(()=>{if(done&&clock.running)clock.pause();},[done,clock.running]);
  return <div className="module-stack tool-timer"><div className="module-row" role="group" aria-label="Timer mode">{(['focus','break'] as const).map(value=><button key={value} type="button" className={button} aria-pressed={mode===value} onClick={()=>{clock.reset();setMode(value);}}>{value==='focus'?'Focus':'Short break'}</button>)}</div><output className="tool-clock" aria-label="Time remaining">{timeLabel(Math.ceil(remaining/1000)*1000)}</output><progress aria-label="Session progress" value={Math.min(duration,clock.elapsed)} max={duration}/><p role="status">{done?'Session complete. Take a moment.':clock.running?'Timer running':mode==='focus'?'Ready to focus':'Ready for a break'}</p><div className="module-row"><button className={button} type="button" disabled={done} onClick={clock.running?clock.pause:clock.start}>{clock.running?'Pause':'Start'}</button><button className={button} type="button" onClick={clock.reset}>Reset</button></div><LocalState/></div>;
}

function Stopwatch() {
  const clock=useClock(),[laps,setLaps]=useState<number[]>([]);
  return <div className="module-stack tool-timer"><output className="tool-clock" aria-label="Elapsed time">{timeLabel(clock.elapsed)}<small>.{Math.floor(clock.elapsed%1000/100)}</small></output><div className="module-row"><button type="button" className={button} onClick={clock.running?clock.pause:clock.start}>{clock.running?'Pause':'Start'}</button><button type="button" className={button} disabled={!clock.running||laps.length>=50} onClick={()=>setLaps([...laps,clock.elapsed])}>Record lap</button><button type="button" className={button} onClick={()=>{clock.reset();setLaps([]);}}>Reset</button></div><ol className="tool-laps" aria-label="Lap times">{laps.map((lap,index)=><li key={index}><span>Lap {index+1}</span><strong>{timeLabel(lap)}.{Math.floor(lap%1000/100)}</strong><small>+{((lap-(laps[index-1]??0))/1000).toFixed(1)}s</small></li>)}</ol><LocalState/></div>;
}

function BreathingGuide(p:ModuleProps) {
  const clock=useClock(),cycle=p.spec.config?.durationSeconds??12,phase=Math.floor(clock.elapsed/1000/(cycle/3))%3,labels=['Breathe in','Hold gently','Breathe out'];
  return <div className="module-stack tool-breathing"><div className="tool-breath-stage"><div className={`tool-breath-orbit ${clock.running?'is-running':''}`} style={{transform:`scale(${clock.running&&phase<2?1:0.72})`,transitionDuration:`${cycle/3}s`}} aria-hidden="true"/><strong role="status">{clock.running?labels[phase]:'Find your rhythm'}</strong></div><Hint>{prettyNumber(cycle/3,1)} seconds per phase. Breathe comfortably; pause whenever you like.</Hint><div className="module-row"><button type="button" className={button} onClick={clock.running?clock.pause:clock.start}>{clock.running?'Pause':'Start breathing'}</button><button type="button" className={button} onClick={clock.reset}>Stop & reset</button></div><LocalState/></div>;
}

function Calculator(p:ModuleProps) {
  const [left,setLeft]=useState(''),[right,setRight]=useState(''),[operator,setOperator]=useState('+'),[history,setHistory]=useState<string[]>([]),[result,setResult]=useState('');
  function calculate(){const a=Number(left),b=Number(right);if(!left.trim()||!right.trim()||!Number.isFinite(a)||!Number.isFinite(b)){setResult('Enter two finite numbers.');return;}if(operator==='÷'&&b===0){setResult('Cannot divide by zero.');return;}const value=operator==='+'?a+b:operator==='−'?a-b:operator==='×'?a*b:a/b;const line=`${left} ${operator} ${right} = ${prettyNumber(value,p.spec.config?.precision??4)}`;setResult(line);if(Number.isFinite(value))setHistory([line,...history].slice(0,8));}
  return <form className="module-stack" onSubmit={e=>{e.preventDefault();calculate();}}><div className="tool-calculator-grid"><label className="module-field">First number<input type="number" step="any" value={left} onChange={e=>setLeft(e.target.value)}/></label><label className="module-field">Operation<select value={operator} onChange={e=>setOperator(e.target.value)}>{['+','−','×','÷'].map(op=><option key={op}>{op}</option>)}</select></label><label className="module-field">Second number<input type="number" step="any" value={right} onChange={e=>setRight(e.target.value)}/></label></div><div className="module-row"><button className={button}>Calculate</button><button className={button} type="button" onClick={()=>{setLeft('');setRight('');setHistory([]);setResult('');}}>Clear</button></div><output className="tool-calculation-result" aria-live="polite">{result||'Ready for your numbers'}</output>{history.length>0&&<details><summary>Calculation history ({history.length})</summary><ol className="tool-history">{history.map((item,index)=><li key={index}>{item}</li>)}</ol></details>}<LocalState/></form>;
}

const units={Length:{Metres:1,Kilometres:1000,Centimetres:0.01,Inches:0.0254,Feet:0.3048,Miles:1609.344},Mass:{Grams:1,Kilograms:1000,Ounces:28.349523125,Pounds:453.59237},Temperature:{Celsius:1,Fahrenheit:1,Kelvin:1}};
type Dimension=keyof typeof units;
function UnitConverter(p:ModuleProps) {
  const [dimension,setDimension]=useState<Dimension>('Length'),[from,setFrom]=useState('Metres'),[to,setTo]=useState('Feet'),[input,setInput]=useState('1');
  const options=units[dimension] as Record<string,number>,value=Number(input),valid=input.trim()!==''&&Number.isFinite(value);
  const celsius=from==='Fahrenheit'?(value-32)*5/9:from==='Kelvin'?value-273.15:value;
  const converted=dimension==='Temperature'?(to==='Fahrenheit'?celsius*9/5+32:to==='Kelvin'?celsius+273.15:celsius):value*options[from]/options[to];
  return <div className="module-stack"><label className="module-field">Measurement<select value={dimension} onChange={e=>{const next=e.target.value as Dimension,keys=Object.keys(units[next]);setDimension(next);setFrom(keys[0]);setTo(keys[1]);}}>{Object.keys(units).map(key=><option key={key}>{key}</option>)}</select></label><label className="module-field">Amount<input type="number" step="any" value={input} onChange={e=>setInput(e.target.value)}/></label><div className="tool-pair">{([{label:'From',value:from,set:setFrom},{label:'To',value:to,set:setTo}]).map(part=><label className="module-field" key={part.label}>{part.label}<select value={part.value} onChange={e=>part.set(e.target.value)}>{Object.keys(options).map(unit=><option key={unit}>{unit}</option>)}</select></label>)}</div><button type="button" className={button} onClick={()=>{setFrom(to);setTo(from);}}>Swap units</button><output className="tool-calculation-result" aria-live="polite">{valid?`${prettyNumber(converted,p.spec.config?.precision??4)} ${to}`:'Enter a finite amount.'}</output><LocalState/></div>;
}

function SearchPanel(p:ModuleProps) {
  const filters=useViewFilters(),id=useId();
  return <div className="module-stack"><label className="module-field" htmlFor={id}>Search this collection<input id={id} type="search" value={filters.query} maxLength={300} onChange={e=>filters.setQuery(e.target.value)} placeholder="Find a name, note or category…"/></label><div className="module-row"><button className={button} type="button" onClick={()=>filters.setQuery('')} disabled={!filters.query}>Clear search</button><span role="status">{filters.total} / {p.snapshot.records.length} records shown</span></div><Hint>Updates every record-based module in this view. Search stays in this browser.</Hint></div>;
}

function FilterPanel(p:ModuleProps) {
  const filters=useViewFilters(),available=fields(p).filter(f=>f.type==='enum'||f.type==='boolean');
  const active=Object.values(filters.values).some(Boolean)||!!filters.query;
  if(!available.length)return <EmptyModule message="Bind category or checkbox fields to filter this collection."/>;
  return <div className="module-stack">{available.map(f=><label key={f.id} className="module-field">{f.label}<select value={filters.values[f.id]??''} onChange={e=>filters.setFilter(f.id,e.target.value)}><option value="">All values</option>{f.type==='boolean'?<><option value="true">Yes</option><option value="false">No</option></>:f.options?.map(option=><option key={option}>{option}</option>)}</select></label>)}<div className="module-row"><button className={button} type="button" onClick={filters.clear} disabled={!active}>Clear all filters</button><span role="status">{filters.total} records shown</span></div><Hint>Filters combine with search across this view. Nothing is changed in your records.</Hint></div>;
}

function TagCloud(p:ModuleProps) {
  const group=groupField(p),rows=records(p),[selected,setSelected]=useState('');
  if(!group)return <EmptyModule message="Bind a category field to explore its tags."/>;
  if(!rows.length)return <EmptyModule/>;
  const counts=new Map<string,number>();for(const r of rows){const value=text(r.values[group.id]);counts.set(value,(counts.get(value)??0)+1);}
  const visible=selected?rows.filter(r=>text(r.values[group.id])===selected):rows;
  return <div className="module-stack"><div className="tool-tags" aria-label="Categories">{[...counts].sort((a,b)=>b[1]-a[1]).map(([tag,count])=><button type="button" className="tool-tag" key={tag} aria-pressed={tag===selected} style={{fontSize:`${0.9+0.35*count/rows.length}rem`}} onClick={()=>setSelected(selected===tag?'':tag)}>{tag}<span>{count}</span></button>)}</div><p role="status">{visible.length} matching records{selected?` · ${selected}`:''}</p><ul className="tool-records">{visible.map(r=><li key={r.id}><span>{title(p,r)}</span><small>{text(r.values[group.id])}</small></li>)}</ul></div>;
}

function readingText(p:ModuleProps,record:ReturnType<typeof useRecord>['record']) {const selected=fields(p).filter(f=>f.type==='text');return p.spec.config?.text??(record?String(record.values[selected.at(-1)?.id??'']??''):'');}
function TextReader(p:ModuleProps) {
  const {record,id,setId,rows}=useRecord(p),[size,setSize]=useState(18),body=readingText(p,record);
  return <div className="module-stack tool-reader">{rows.length>1&&<RecordSelect p={p} id={id} onChange={setId}/>}<label className="module-field">Reading size · {size}px<input type="range" min={14} max={30} value={size} onChange={e=>setSize(Number(e.target.value))}/></label>{body?<article className="tool-reading" style={{fontSize:size}}>{body}</article>:<EmptyModule message="Bind a text field and add a record to begin reading."/>}<Hint>Reading size is local to this browser.</Hint></div>;
}

function WordCounter(p:ModuleProps) {
  const {record,id,setId,rows}=useRecord(p),body=readingText(p,record);
  return <div className="module-stack">{rows.length>1&&<RecordSelect p={p} id={id} onChange={setId}/>}<WordCountEditor key={`${id}:${body}`} initial={body}/></div>;
}
function WordCountEditor({initial}:{initial:string}) {
  const [value,setValue]=useState(initial);
  const words=Array.from(new Intl.Segmenter('en',{granularity:'word'}).segment(value)).filter(part=>part.isWordLike).length,characters=Array.from(value).length,paragraphs=value.trim()?value.trim().split(/\n\s*\n/u).filter(Boolean).length:0;
  return <><label className="module-field">Text to measure<textarea value={value} maxLength={10000} rows={7} onChange={e=>setValue(e.target.value)}/></label><dl className="tool-stat-grid" aria-live="polite"><div><dt>Words</dt><dd>{words}</dd></div><div><dt>Characters</dt><dd>{characters}</dd></div><div><dt>Paragraphs</dt><dd>{paragraphs}</dd></div><div><dt>Read time</dt><dd>{words?Math.max(1,Math.ceil(words/200)):0} min</dd></div></dl><Hint>Edits here only measure text; they do not save to the record.</Hint></>;
}

function safeLink(value:unknown):string|null {if(typeof value!=='string'||!/^https?:\/\//i.test(value.trim()))return null;try{const url=new URL(value.trim());return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
function inlineMarkdown(value:string):ReactNode[] {
  const pattern=/(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\))/g,out:ReactNode[]=[];let start=0;
  for(const match of value.matchAll(pattern)){const at=match.index!;out.push(value.slice(start,at));if(match[2])out.push(<strong key={at}>{match[2]}</strong>);else if(match[3])out.push(<code key={at}>{match[3]}</code>);else {const url=safeLink(match[5]);out.push(url?<a key={at} href={url} target="_blank" rel="noopener noreferrer">{match[4]}</a>:<span key={at}>{match[4]} (link unavailable)</span>);}start=at+match[0].length;}
  out.push(value.slice(start));return out;
}
function MarkdownViewer(p:ModuleProps) {
  const {record,id,setId,rows}=useRecord(p),body=readingText(p,record);
  return <div className="module-stack">{rows.length>1&&<RecordSelect p={p} id={id} onChange={setId}/>}<article className="tool-markdown">{body?body.split('\n').map((line,i)=>{if(line.startsWith('### '))return <h4 key={i}>{inlineMarkdown(line.slice(4))}</h4>;if(line.startsWith('## '))return <h3 key={i}>{inlineMarkdown(line.slice(3))}</h3>;if(line.startsWith('# '))return <h2 key={i}>{inlineMarkdown(line.slice(2))}</h2>;if(line.startsWith('> '))return <blockquote key={i}>{inlineMarkdown(line.slice(2))}</blockquote>;if(/^[-*] /.test(line))return <p className="tool-markdown-item" key={i}>• {inlineMarkdown(line.slice(2))}</p>;return line?<p key={i}>{inlineMarkdown(line)}</p>:<br key={i}/>;}):<EmptyModule message="Add text to a bound record or set this module's text."/>}</article><Hint>Supports headings, bold, inline code, quotes, lists and web links. HTML displays as text.</Hint></div>;
}

function LinkDirectory(p:ModuleProps) {
  const rows=records(p),bound=fields(p).filter(f=>f.type==='text'),[query,setQuery]=useState('');
  if(!rows.length)return <EmptyModule message="Add records with a title and a full https:// or http:// address."/>;
  const matches=rows.filter(r=>bound.some(f=>String(r.values[f.id]??'').toLowerCase().includes(query.toLowerCase())));
  return <div className="module-stack"><label className="module-field">Find a link<input type="search" value={query} maxLength={300} onChange={e=>setQuery(e.target.value)}/></label><ul className="tool-links">{matches.map(r=>{const url=bound.map(f=>safeLink(r.values[f.id])).find(Boolean);return <li key={r.id}>{url?<a href={url} target="_blank" rel="noopener noreferrer"><strong>{title(p,r)}</strong><small>{new URL(url).hostname}</small><span aria-hidden="true">↗</span></a>:<div><strong>{title(p,r)}</strong><small>No valid web address</small></div>}</li>;})}</ul>{!matches.length&&<Hint>No matching links.</Hint>}<Hint>Links open in a new tab. No remote previews are loaded.</Hint></div>;
}

function RecipeScaler(p:ModuleProps) {
  const quantity=valueField(p),rows=records(p),[scale,setScale]=useState(String(p.spec.config?.scale??1));
  const factor=Number(scale),valid=Number.isFinite(factor)&&factor>=0.01&&factor<=100;
  if(!quantity)return <EmptyModule message="Bind a numeric quantity field and ingredient names."/>;
  return <div className="module-stack"><label className="module-field">Recipe multiplier<input type="number" min={0.01} max={100} step="0.25" value={scale} onChange={e=>setScale(e.target.value)}/></label><div className="module-row" role="group" aria-label="Scale presets">{[0.5,1,2,3].map(n=><button type="button" className={button} key={n} aria-pressed={factor===n} onClick={()=>setScale(String(n))}>{n}×</button>)}</div>{!valid?<p role="alert">Choose a multiplier between 0.01 and 100.</p>:rows.length?<ul className="tool-ingredients">{rows.map(r=><li key={r.id}><span>{title(p,r)}</span><strong>{typeof r.values[quantity.id]==='number'?format(p,(r.values[quantity.id] as number)*factor):'No quantity'}</strong></li>)}</ul>:<EmptyModule message="Add ingredient records with numeric quantities."/>}<Hint>Scaled quantities are a local preview. Original amounts stay unchanged.</Hint></div>;
}

export const toolModules:ModuleRegistry={'flashcards':Flashcards,'quiz':Quiz,'random-picker':RandomPicker,'pomodoro':Pomodoro,'stopwatch':Stopwatch,'breathing-guide':BreathingGuide,'calculator':Calculator,'unit-converter':UnitConverter,'search-panel':SearchPanel,'filter-panel':FilterPanel,'tag-cloud':TagCloud,'text-reader':TextReader,'word-counter':WordCounter,'markdown-viewer':MarkdownViewer,'link-directory':LinkDirectory,'recipe-scaler':RecipeScaler};
