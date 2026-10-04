import {describe,it,expect} from 'vitest';
import {COMPONENT_MANIFESTS, EXTENDED_MODULES, readingDefinition, validateEvolution} from '@livingforma/contracts';
import {planProposal, plannerParameters, moduleCompositionInstructions} from './planner';
import {assertProposal} from './local-composer';
import {requestedModules} from './module-composer';

describe('expanded module planning, offline',()=>{
  it('discovers all 60 trusted manifest types in the structured planner',()=>{
    expect(COMPONENT_MANIFESTS.filter(m=>m.id!=='generated-site')).toHaveLength(60);
    const schema=plannerParameters as any,component=schema.properties.appSpec.properties.components.items;
    expect(new Set(component.properties.type.enum)).toEqual(new Set(COMPONENT_MANIFESTS.filter(m=>m.id!=='generated-site').map(m=>m.id)));
    expect(component.properties.size.properties.columns).toMatchObject({minimum:3,maximum:12});
    expect(component.properties.config.additionalProperties).toBe(false);
    expect(schema.properties.appSpec.properties.components.maxItems).toBe(24);
    expect(moduleCompositionInstructions).toContain('browser-local view filter');
  });
  it.each(EXTENDED_MODULES.map(m=>m.id))('adds %s while preserving existing schema fields and IDs',async type=>{
    const old=readingDefinition(),proposal=await planProposal({prompt:`Add ${type}`,current:old});
    expect(proposal.appSpec.components.some(c=>c.type===type)).toBe(true);
    expect(proposal.entitySchema.fields.slice(0,old.entitySchema.fields.length)).toEqual(old.entitySchema.fields);
    expect(proposal.appSpec.components.slice(0,old.appSpec.components.length).map(c=>c.id)).toEqual(old.appSpec.components.map(c=>c.id));
    validateEvolution(old,{definitionVersion:2,entitySchema:proposal.entitySchema,appSpec:proposal.appSpec,summary:proposal.summary});
    expect(proposal.source).toBe('local-rules');
  });
  it('builds ordered study and two-number bindings without hardcoded app templates',async()=>{
    const p=await planProposal({prompt:'Add flashcards, quiz, scatter-plot and breathing-guide',current:null});
    for(const type of ['flashcards','quiz']){const c=p.appSpec.components.find(c=>c.type===type)!;expect(c.fields.map(id=>p.entitySchema.fields.find(f=>f.id===id)?.type)).toEqual(['text','text']);}
    const scatter=p.appSpec.components.find(c=>c.type==='scatter-plot')!;
    expect(scatter.fields.map(id=>p.entitySchema.fields.find(f=>f.id===id)?.type).filter(t=>t==='number')).toHaveLength(2);
    const breathing=p.appSpec.components.find(c=>c.type==='breathing-guide')!;expect(breathing.fields).toEqual([]);expect(breathing.actionIds).toEqual([]);
    expect(p.capabilityGaps).toEqual([]);
  });
  it('changes bounded presentation without creating a duplicate or changing schema',async()=>{
    const initial=await planProposal({prompt:'Add pomodoro',current:readingDefinition()}),current={...initial,definitionVersion:2};
    const next=await planProposal({prompt:'Make pomodoro 4 columns, 320px high, compact, 12 minutes',current});
    const timers=next.appSpec.components.filter(c=>c.type==='pomodoro');expect(timers).toHaveLength(1);
    expect(timers[0]).toMatchObject({size:{columns:4,minHeight:320},config:{durationSeconds:720,density:'compact'}});
    expect(next.entitySchema).toEqual(current.entitySchema);
  });
  it('rejects hostile or inappropriate module config and unbounded sizes',async()=>{
    const valid=await planProposal({prompt:'Add calculator',current:readingDefinition()});
    for(const bad of [{config:{html:'<script>alert(1)</script>'}},{config:{durationSeconds:20}},{size:{columns:13}},{size:{columns:2}},{size:{columns:3,minHeight:999}}]){
      const p=structuredClone(valid);Object.assign(p.appSpec.components.find(c=>c.type==='calculator')!,bad);expect(()=>assertProposal(p,readingDefinition(),'gemini')).toThrow();
    }
  });
  it('preserves configured modules during an unrelated skin change',async()=>{
    const p=await planProposal({prompt:'Add pomodoro 4 columns, 320px high, compact, 12 minutes',current:readingDefinition()});
    const old={...p,definitionVersion:2},next=await planProposal({prompt:'Use sage skin',current:old});
    expect(next.appSpec.components).toEqual(old.appSpec.components);expect(next.entitySchema).toEqual(old.entitySchema);expect(next.appSpec.skin).toBe('sage');
  });
  it('does not confuse week-board or flashcards with a request to replace the existing collection',async()=>{
    const old=readingDefinition(),next=await planProposal({prompt:'Add a week board and flashcards',current:old});
    expect(next.appSpec.components.slice(0,old.appSpec.components.length)).toEqual(old.appSpec.components);
  });
  it('caps compositions at 24 and reports a gap without silently deleting the old app',async()=>{
    const old=readingDefinition(),proposal=await planProposal({prompt:`Add ${EXTENDED_MODULES.map(m=>m.id).join(', ')}`,current:old});
    expect(proposal.appSpec.components).toHaveLength(24);expect(proposal.capabilityGaps.join(' ')).toContain('24 modules');
    expect(proposal.appSpec.components.slice(0,old.appSpec.components.length).map(c=>c.id)).toEqual(old.appSpec.components.map(c=>c.id));
  });
  it('recognizes human labels and Chinese study intents',()=>{
    expect(requestedModules('Add a unit converter and memory flash cards').map(m=>m.id)).toEqual(['flashcards','unit-converter']);
    expect(requestedModules('添加番茄钟和测验与呼吸引导').map(m=>m.id)).toEqual(['quiz','pomodoro','breathing-guide']);
  });
});
