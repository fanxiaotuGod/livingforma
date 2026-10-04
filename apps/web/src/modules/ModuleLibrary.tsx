import {useState} from 'react';
import {COMPONENT_MANIFESTS,type ComponentSpec,type Definition} from '@livingforma/contracts';
import {Modal} from '../components/ui';

export function createModule(type:ComponentSpec['type'],definition:Definition):ComponentSpec{
  const m=COMPONENT_MANIFESTS.find(m=>m.id===type)!,fs=definition.entitySchema.fields;
  const spec:ComponentSpec={id:`module_${crypto.randomUUID().replaceAll('-','').slice(0,14)}`,type,version:1,variant:m.variants.includes('default')?'default':m.variants[0],title:type.replaceAll('-',' '),span:'full',size:{columns:m.defaultColumns??6},fields:m.bindings.includes('fields')?fs.map(f=>f.id):[],actionIds:definition.appSpec.actions.filter(a=>m.actions.includes(a.type)).map(a=>a.id)};
  if(m.bindings.includes('valueField'))spec.valueField=fs.find(f=>f.type==='number')?.id;
  if(m.bindings.includes('dateField'))spec.dateField=fs.find(f=>f.type===(type==='habit-matrix'?'dates':'date'))?.id??fs.find(f=>f.type==='dates')?.id;
  if(m.bindings.includes('groupBy'))spec.groupBy=fs.find(f=>f.type==='enum')?.id;
  if(type==='tool-result')spec.toolRef=definition.appSpec.components.find(c=>c.toolRef)?.toolRef;
  return spec;
}
export function ModuleLibrary({open,onOpenChange,onAdd,count}:{open:boolean;onOpenChange:(open:boolean)=>void;onAdd:(type:ComponentSpec['type'])=>void;count:number}){
  const [query,setQuery]=useState(''),[category,setCategory]=useState('All');const categories=['All',...new Set(COMPONENT_MANIFESTS.filter(m=>m.id!=='generated-site').map(m=>m.category??'Essentials'))];
  const items=COMPONENT_MANIFESTS.filter(m=>m.id!=='generated-site'&&(category==='All'||(m.category??'Essentials')===category)&&`${m.id} ${m.description} ${m.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <Modal open={open} onOpenChange={onOpenChange} title="60 ways to shape your space." description="Choose a module, connect your fields, and make it your own. Every module adapts to phone and desktop." className="module-library"><div className="library-search"><label className="module-field">Find a module<input type="search" placeholder="Try calendar, study, or chart…" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="module-field">Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div><p className="module-hint">{items.length} modules · {count}/24 on this page · <a href="/modules" target="_blank" rel="noreferrer">Open the interactive gallery ↗</a></p><div className="module-library-grid">{items.map((m,i)=><article key={m.id}><small>{m.category??'Essentials'} / {String(i+1).padStart(2,'0')}</small><h3>{m.id.replaceAll('-',' ')}</h3><p>{m.description}</p><button className="module-button" disabled={count>=24} onClick={()=>onAdd(m.id)}>Add module ＋</button></article>)}</div>{!items.length&&<p>No modules match this search.</p>}</Modal>
}
