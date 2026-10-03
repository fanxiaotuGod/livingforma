import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COMPONENT_MANIFESTS, readingDefinition, validateEvolution } from '@livingforma/contracts';
import { planProposal } from './planner';
import { assertProposal } from './local-composer';
import { createToolAdapter, OPEN_LIBRARY_SPEC, isPublicIPv4, projectOpenLibrary, validateToolInput, validateToolSpec, proposeTool } from './tools';
import { reserveFreeRequest } from './pi-runtime';

describe('component planner',()=>{
  it('composes structurally distinct reading, habits, tasks and expenses from one catalog',async()=>{
    const proposals=await Promise.all(['A book reading tracker','Track daily habits','A project task board','An expense budget tracker'].map(prompt=>planProposal({prompt,current:null})));
    for(const p of proposals){expect(p.source).toBe('local-rules');validateEvolution(null,{definitionVersion:1,entitySchema:p.entitySchema,appSpec:p.appSpec,summary:p.summary});}
    expect(proposals[0].appSpec.components.some(c=>c.type==='cards')).toBe(true);expect(proposals[1].appSpec.components.some(c=>c.type==='calendar-grid')).toBe(true);expect(proposals[2].appSpec.components.some(c=>c.type==='kanban')).toBe(true);expect(proposals[3].appSpec.components.some(c=>c.type==='chart')).toBe(true);
  });
  it('preserves stable fields while adding rating, sorting, skins and a board',async()=>{
    const old=readingDefinition();const p=await planProposal({prompt:'Add rating, sort by rating descending, use a kanban board and ink skin',current:old});
    expect(p.entitySchema.fields.slice(0,old.entitySchema.fields.length)).toEqual(old.entitySchema.fields);expect(p.appSpec.skin).toBe('ink');expect(p.appSpec.components.find(c=>c.type==='kanban')?.sort).toEqual({field:'rating',direction:'desc'});
  });
  it('rejects destructive/model-invented definitions and reports unavailable capabilities',async()=>{
    const old=readingDefinition(),payload={entitySchema:structuredClone(old.entitySchema),appSpec:old.appSpec,summary:'Bad',source:'gemini',capabilityGaps:[]};payload.entitySchema.fields.shift();expect(()=>assertProposal(payload,old,'gemini')).toThrow();
    const p=await planProposal({prompt:'Collect payments',current:old});expect(p.capabilityGaps.length).toBeGreaterThan(0);expect(p.appSpec.components).toEqual(old.appSpec.components);
  });
  it('uses the camera manifest availability without adding media fields or mutation actions',async()=>{
    const manifest=COMPONENT_MANIFESTS.find(m=>m.id==='camera')!,status=manifest.status,old=readingDefinition();
    try{
      manifest.status='planned';const pending=await planProposal({prompt:'Add a camera scene',current:old});expect(pending.capabilityGaps.join(' ')).toMatch(/Camera/);expect(pending.appSpec.components).toEqual(old.appSpec.components);
      manifest.status='available';const ready=await planProposal({prompt:'Add a camera scene and use sage skin',current:old});expect(ready.entitySchema).toEqual(old.entitySchema);expect(ready.appSpec.actions).toEqual(old.appSpec.actions);expect(ready.appSpec.components.find(c=>c.type==='camera')).toMatchObject({fields:[],actionIds:[]});expect(ready.appSpec.skin).toBe('sage');expect(ready.capabilityGaps).toEqual([]);
    }finally{manifest.status=status;}
  });
  it('preserves an enabled external tool while adding a local camera and changing skin',async()=>{
    const original=readingDefinition();const composed=await planProposal({prompt:'Add book search from Open Library',current:original,registeredTools:[{spec:OPEN_LIBRARY_SPEC,enabled:true,verifiedAt:new Date().toISOString(),invocationCount:1}]});
    const current={...composed,definitionVersion:2},manifest=COMPONENT_MANIFESTS.find(m=>m.id==='camera')!,status=manifest.status;
    try{manifest.status='available';const next=await planProposal({prompt:'Use sage and add a camera',current});expect(next.appSpec.components.find(c=>c.type==='tool-result')).toEqual(current.appSpec.components.find(c=>c.type==='tool-result'));expect(next.entitySchema).toEqual(current.entitySchema);expect(next.appSpec.actions).toEqual(current.appSpec.actions);expect(next.appSpec.components.some(c=>c.type==='camera')).toBe(true);}finally{manifest.status=status;}
  });
  it('binds a check-in only when a single dates field is unambiguous',async()=>{
    const p=await planProposal({prompt:'Daily habits',current:null});delete p.appSpec.actions.find(a=>a.type==='record.checkin')!.fieldId;expect(assertProposal(p,null,'gemini').appSpec.actions.find(a=>a.type==='record.checkin')?.fieldId).toBe('dates');p.entitySchema.fields.push({id:'other_dates',label:'Other dates',type:'dates',required:false,public:true});expect(()=>assertProposal(p,null,'gemini')).toThrow(/Check-in/);
  });
  it('gates missing tools and reuses only enabled registered versions',async()=>{
    const old=readingDefinition();const pending=await planProposal({prompt:'Add book search from Open Library',current:old});expect(pending.toolProposals?.[0].endpointId).toBe('openlibrary_search');expect(pending.appSpec).toEqual(old.appSpec);
    const registered={spec:OPEN_LIBRARY_SPEC,enabled:true,verifiedAt:new Date().toISOString(),invocationCount:2};const ready=await planProposal({prompt:'Add book search from Open Library',current:old,registeredTools:[registered]});expect(ready.toolProposals).toBeUndefined();expect(ready.appSpec.components.find(c=>c.type==='tool-result')?.toolRef?.toolId).toBe('openlibrary_search');
    expect((await proposeTool({prompt:'Search books',registered:[registered]})).reused).toBe(true);
  });
});
describe('bounded registry and Pi execution',()=>{
  it('rejects endpoints, arbitrary URLs, response traversal and excess query arguments',()=>{
    expect(()=>validateToolSpec({...OPEN_LIBRARY_SPEC,endpointId:'internal'})).toThrow();expect(()=>validateToolSpec({...OPEN_LIBRARY_SPEC,url:'http://localhost'})).toThrow();expect(()=>validateToolSpec({...OPEN_LIBRARY_SPEC,responseMap:{books:'constructor',total:'numFound'}})).toThrow();expect(()=>validateToolInput({q:'Dune',url:'http://localhost'})).toThrow();
  });
  it('denies private/reserved DNS results',()=>{for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.2','172.16.2.2','100.64.0.1','::1','::ffff:127.0.0.1','198.18.1.1','224.0.0.1'])expect(isPublicIPv4(ip),ip).toBe(false);expect(isPublicIPv4('207.241.234.205')).toBe(true);});
  it('runs dynamic Pi tools, caches repeats and rejects cancellation/oversized results',async()=>{
    let calls=0;const events:string[]=[];const adapter=createToolAdapter({transport:async()=>{calls++;return {books:[{title:'Dune'}]};},onPiEvent:event=>events.push(event)});
    const first=await adapter.invoke(OPEN_LIBRARY_SPEC,{q:'Dune'});const second=await adapter.invoke(OPEN_LIBRARY_SPEC,{q:'Dune'});expect(second).toEqual(first);expect(calls).toBe(1);expect(events).toEqual(['tool_execution_start','tool_execution_end','tool_execution_start','tool_execution_end']);
    const controller=new AbortController();controller.abort();await expect(adapter.invoke(OPEN_LIBRARY_SPEC,{q:'Dune'},controller.signal)).rejects.toThrow();
    const large=createToolAdapter({transport:async()=>({value:'x'.repeat(20000)})});await expect(large.invoke(OPEN_LIBRARY_SPEC,{q:'Dune'})).rejects.toThrow();
  });
  it('projects external data without arbitrary links/instructions or excessive records',()=>{
    const result=projectOpenLibrary({numFound:10,docs:Array.from({length:7},()=>({title:'Book',author_name:['Author'],key:'javascript:alert(1)',secret:'hidden'}))});expect((result.books as unknown[])).toHaveLength(5);expect(JSON.stringify(result)).not.toContain('javascript');expect(JSON.stringify(result)).not.toContain('hidden');
  });
});
describe('free budget',()=>{
  it('persists reservations, stops on quota, requires a production store, and has no fallback',()=>{
    const dir=mkdtempSync(join(tmpdir(),'livingforma-budget-'));try{const env={GEMINI_API_KEY:'test-only',GEMINI_FREE_TIER_VERIFIED:'true',GEMINI_DAILY_REQUEST_LIMIT:'1',GEMINI_BUDGET_FILE:join(dir,'budget.json')};reserveFreeRequest(env);expect(()=>reserveFreeRequest({...env})).toThrow(/budget is exhausted/);expect(()=>reserveFreeRequest({...env,GEMINI_FREE_TIER_VERIFIED:'false'})).toThrow(/verified free-tier/);expect(()=>reserveFreeRequest({...env,NODE_ENV:'production',GEMINI_BUDGET_FILE:''})).toThrow(/persistent budget/);}finally{rmSync(dir,{recursive:true,force:true});}
  });
});
