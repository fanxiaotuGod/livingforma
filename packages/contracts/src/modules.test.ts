import {describe,it,expect} from 'vitest';
import {COMPONENT_MANIFESTS,componentTypes,componentSchema,readingDefinition,validateDefinition,presentationRequestSchema} from './index';
describe('module presentation contracts',()=>{
  it('registers sixty unique types and retains existing definitions',()=>{
    expect(componentTypes.filter(type=>type!=='generated-site')).toHaveLength(60);
    expect(new Set(COMPONENT_MANIFESTS.filter(m=>m.id!=='generated-site').map(m=>m.id)).size).toBe(60);
    expect(COMPONENT_MANIFESTS.filter(m=>m.id==='generated-site')).toHaveLength(1);
    expect(validateDefinition(readingDefinition())).toEqual(readingDefinition());
  });
  it('accepts bounded optional sizes and rejects unsafe presentation data',()=>{
    const base=readingDefinition().appSpec.components[0];
    expect(componentSchema.parse({...base,size:{columns:4,minHeight:320},config:{density:'compact'}}).size?.columns).toBe(4);
    for(const size of [{columns:0},{columns:1},{columns:2},{columns:13},{columns:4,minHeight:10000},{columns:4,css:'position:fixed'}])expect(()=>componentSchema.parse({...base,size})).toThrow();
    expect(()=>componentSchema.parse({...base,config:{html:'<script/>'}})).toThrow();
  });
  it('checks per-module configuration and numeric bindings',()=>{
    const d=readingDefinition();
    d.appSpec.components[0]={id:'hist',type:'histogram',version:1,variant:'default',fields:[],actionIds:[],span:'full',valueField:'progress',config:{bins:8}};
    expect(()=>validateDefinition(d)).not.toThrow();
    d.appSpec.components[0].valueField='title';expect(()=>validateDefinition(d)).toThrow(/number/);
    d.appSpec.components[0].valueField='progress';d.appSpec.components[0].config={durationSeconds:30};expect(()=>validateDefinition(d)).toThrow(/configuration/);
  });
  it('presentation edits cannot carry schema, records or authority',()=>{
    const p={requestId:'aeee953e-3473-4f29-aea7-aa79dfe40640',baseDefinitionVersion:1,components:readingDefinition().appSpec.components};
    expect(presentationRequestSchema.parse(p)).toEqual(p);
    for(const key of ['entitySchema','records','actions','permissions'])expect(()=>presentationRequestSchema.parse({...p,[key]:[]})).toThrow();
  });
});
