import {createContext,useContext,useState,type ComponentType,type ReactNode} from 'react';
import type {ComponentSpec,DataRecord,EntityField,FieldValue,Mutation,Snapshot} from '@livingforma/contracts';

export type ModuleProps={snapshot:Snapshot;spec:ComponentSpec;mutate:(input:Omit<Mutation,'requestId'|'definitionVersion'>)=>Promise<unknown>;onLogin:()=>void;csrf:string|null;onSelect:(record:DataRecord)=>void};
export type ModuleRegistry=Partial<Record<ComponentSpec['type'],ComponentType<ModuleProps>>>;
export const text=(v:unknown)=>v===undefined||v===null||v===''?'—':Array.isArray(v)?v.join(', '):String(v);
export const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
export const fields=(p:ModuleProps)=>{const all=p.snapshot.definition?.entitySchema.fields??[];return p.spec.fields.length?p.spec.fields.map(id=>all.find(f=>f.id===id)).filter((f):f is EntityField=>!!f):all;};
export const field=(p:ModuleProps,type:EntityField['type'],index=0)=>fields(p).filter(f=>f.type===type)[index];
export const valueField=(p:ModuleProps)=>p.snapshot.definition?.entitySchema.fields.find(f=>f.id===p.spec.valueField&&f.type==='number')??field(p,'number');
export const dateField=(p:ModuleProps)=>p.snapshot.definition?.entitySchema.fields.find(f=>f.id===p.spec.dateField&&['date','dates'].includes(f.type))??field(p,'date')??field(p,'dates');
export const groupField=(p:ModuleProps)=>p.snapshot.definition?.entitySchema.fields.find(f=>f.id===p.spec.groupBy&&f.type==='enum')??field(p,'enum');
export const title=(p:ModuleProps,r:DataRecord)=>text(r.values[field(p,'text')?.id??fields(p)[0]?.id??'title']);
export const dates=(v:unknown):string[]=>Array.isArray(v)?v.filter((d):d is string=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)):typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?[v]:[];
export function records(p:ModuleProps){let rows=[...p.snapshot.records];if(p.spec.sort){const {field,direction}=p.spec.sort;rows.sort((a,b)=>{const av=a.values[field],bv=b.values[field];return (typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??'')))*(direction==='asc'?1:-1)});}return rows.slice(0,p.spec.config?.limit??rows.length);}
export const format=(p:ModuleProps,n:number)=>`${p.spec.config?.prefix??''}${n.toLocaleString('en-US',{maximumFractionDigits:p.spec.config?.precision??1})}${p.spec.config?.suffix??''}`;
export const today=(p:ModuleProps)=>new Intl.DateTimeFormat('en-CA',{timeZone:p.snapshot.space.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function dayAdd(day:string,n:number){const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function Hint({children}:{children:ReactNode}){return <p className="module-hint">{children}</p>}
export function EmptyModule({message='Add a record to bring this module to life.'}:{message?:string}){return <div className="module-empty"><span aria-hidden="true">＋</span><p>{message}</p></div>}
export function RecordSelect({p,id,onChange,disabled=false}:{p:ModuleProps;id:string;disabled?:boolean;onChange:(id:string)=>void}){return <label className="module-field">Record<select disabled={disabled} aria-label="Choose record" value={id} onChange={e=>onChange(e.target.value)}>{records(p).map(r=><option key={r.id} value={r.id}>{title(p,r)}</option>)}</select></label>}
export function useRecord(p:ModuleProps){const rows=records(p);const [id,setId]=useState(rows[0]?.id??'');const record=rows.find(r=>r.id===id)??rows[0];return {record,id:record?.id??'',setId,rows};}
export function useWrite(p:ModuleProps){const [busy,setBusy]=useState(false),[error,setError]=useState('');const action=(type:string)=>p.snapshot.definition?.appSpec.actions.find(a=>a.type===type&&p.spec.actionIds.includes(a.id)&&p.snapshot.permissions.actionIds.includes(a.id));
  async function write(record:DataRecord|undefined,values:Record<string,FieldValue>,type='record.update'){if(!p.snapshot.permissions.canWrite){p.onLogin();return false}const a=action(type);if(!a){setError('This action is not enabled for this module.');return false}if(busy)return false;setBusy(true);setError('');try{await p.mutate({actionId:a.id,...(record?{recordId:record.id,recordVersion:record.version}:{}),values});return true}catch(e){setError((e as Error).message);return false}finally{setBusy(false)}}
  return {write,busy,error,action};
}
export type ViewFilters={query:string;values:Record<string,string>;setQuery:(value:string)=>void;setFilter:(field:string,value:string)=>void;clear:()=>void;total:number};
export const FilterContext=createContext<ViewFilters>({query:'',values:{},setQuery:()=>{},setFilter:()=>{},clear:()=>{},total:0});
export const useViewFilters=()=>useContext(FilterContext);
