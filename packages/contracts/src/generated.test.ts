import {describe,expect,it} from 'vitest';
import {validateGeneratedArtifact,GeneratedSourceError} from './generated';
import {readingDefinition,validateDefinition,validateEvolution,type Definition} from './index';
const app=(js:string,html='<main id="app"></main>')=>({format:'html-v1',bridgeVersion:1,html,css:'main { display:grid; gap:1rem; }',js,assetIds:[]});
describe('generated browser source validation',()=>{
 it('accepts varied self-contained interactions without selecting a template',()=>{
  for(const js of ["const cards=[]; document.getElementById('app').addEventListener('pointerup',()=>cards.shift());", "let count=0; document.getElementById('app').onclick=()=>{count++;};", "lf.ready.then(state=>{document.getElementById('app').textContent=state.records.length;lf.reportReady();});"]){expect(validateGeneratedArtifact(app(js)).js).toBe(js)}
 });
 it('parses but never executes source on the host',()=>{expect(validateGeneratedArtifact(app("throw new Error('would execute');")).js).toContain('throw')});
 it('reports removed inline handlers while allowing ordinary labels and attribute values',()=>{
  for(const html of ['<button onclick="save()">Save</button>',"<button ONCLICK='save()'>Save</button>",'<button onpointerup=save()>Save</button>'])expect(()=>validateGeneratedArtifact(app('',html))).toThrow(/inline event/);
  for(const html of ['<p>Use onclick= only in JavaScript documentation.</p>','<button title="Example onclick=save() > test">Save</button>',"<p data-example='onclick=save()'>Guide</p>",'<!-- <button onclick="save()"> --> <button>Save</button>'])expect(()=>validateGeneratedArtifact(app('',html))).not.toThrow();
 });
 it('returns repairable syntax diagnostics',()=>{expect(()=>validateGeneratedArtifact(app('const = ;'))).toThrow(GeneratedSourceError)});
 it('rejects script-tag boundary injection and external module paths',()=>{
  for(const value of [app('', '<script src="https://example.com/x"></script>'),app("import('https://example.com/x.js')"),app("const close='</script>';"),{...app(''),css:'@import "https://example.com/x.css";'}])expect(()=>validateGeneratedArtifact(value)).toThrow(GeneratedSourceError);
 });
 it('rejects direct network, credential and navigation APIs with bridge guidance',()=>{
  for(const js of ["fetch('/api/session');","window.location.href='https://example.com';","document.cookie;","new RTCPeerConnection();","localStorage.getItem('x');"]){expect(()=>validateGeneratedArtifact(app(js))).toThrow(GeneratedSourceError)}
 });
 it('bounds source size and requires the declared bridge version',()=>{expect(()=>validateGeneratedArtifact({...app(''),html:'x'.repeat(60001)})).toThrow();expect(()=>validateGeneratedArtifact({...app(''),bridgeVersion:2})).toThrow()});
 it('requires exactly one generated surface paired with its source',()=>{
  const base=readingDefinition(),artifact=validateGeneratedArtifact(app('lf.ready.then(()=>lf.reportReady());'));
  const next:Definition={...base,appSpec:{...base.appSpec,generated:artifact,components:[{id:'website',type:'generated-site',version:1,variant:'default',fields:['title'],actionIds:['add'],span:'full'}]}};
  expect(validateDefinition(next).appSpec.generated).toEqual(artifact);
  expect(()=>validateDefinition({...next,appSpec:{...next.appSpec,generated:undefined}})).toThrow(/exactly one/);
  expect(()=>validateDefinition({...base,appSpec:{...base.appSpec,generated:artifact}})).toThrow(/exactly one/);
  expect(()=>validateDefinition({...next,appSpec:{...next.appSpec,components:[...next.appSpec.components,{...next.appSpec.components[0],id:'duplicate'}]}})).toThrow(/exactly one/);
 });
 it('changing to custom source cannot erase, retype or expose existing fields',()=>{
  const previous=readingDefinition(),next:Definition={...previous,definitionVersion:previous.definitionVersion+1,appSpec:{...previous.appSpec,generated:validateGeneratedArtifact(app('lf.ready.then(()=>lf.reportReady());')),components:[{id:'website',type:'generated-site',version:1,variant:'default',fields:['title'],actionIds:['add'],span:'full'}]}};
  expect(()=>validateEvolution(previous,next)).not.toThrow();
  for(const fields of [previous.entitySchema.fields.slice(1),previous.entitySchema.fields.map(f=>f.id==='title'?{...f,type:'number' as const}:f),previous.entitySchema.fields.map(f=>f.id==='title'?{...f,public:!f.public}:f)])expect(()=>validateEvolution(previous,{...next,entitySchema:{...next.entitySchema,fields}})).toThrow();
 });
});
