import {describe,expect,it} from 'vitest';
import {generatedToolManifest,isBoundedJson,toolJsonSchema,validateGeneratedTool,validateToolJson,type GeneratedToolSpec} from './generated-tools';
import {readingDefinition,validateDefinition} from './index';
import {generationOutlineSchema} from './generated';
const spec:GeneratedToolSpec={kind:'code-js-v1',toolId:'weighted_score',toolVersion:1,name:'Weighted score',description:'Calculate a weighted result.',source:'function run(input, api) { return {score: input.value * input.weight}; }',inputSchema:{type:'object',properties:{value:{type:'number'},weight:{type:'number',minimum:0}},required:['value','weight'],additionalProperties:false},outputSchema:{type:'object',properties:{score:{type:'number'}},required:['score'],additionalProperties:false},sideEffects:'none',capabilities:{publicRecordFields:[],connectors:[]},tests:[{name:'Normal weight',input:{value:8,weight:.5},expected:{score:4}},{name:'Zero weight',input:{value:8,weight:0},expected:{score:0}}]};
describe('generated backend tool contracts',()=>{
 it('accepts original source as guest data and emits reusable metadata without code/tests',()=>{
  const accepted=validateGeneratedTool(spec);expect(accepted.toolId).toBe('weighted_score');const metadata=generatedToolManifest(accepted);expect(metadata).not.toHaveProperty('source');expect(metadata).not.toHaveProperty('tests');expect(metadata.inputSchema).toEqual(spec.inputSchema);
  expect(validateGeneratedTool({...spec,source:'async function run(input, api) { throw new Error("Only the runtime may execute this"); }'}).source).toContain('throw');
 });
 it('requires a declared entry point, representative JSON tests and bounded source',()=>{
  for(const changed of [{source:'const run = () => ({})'},{source:'function run(input) { return {}; }'},{source:'function run(input, api) { invalid syntax }'},{tests:spec.tests.slice(0,1)},{source:'x'.repeat(32769)}])expect(()=>validateGeneratedTool({...spec,...changed})).toThrow();
  expect(()=>validateGeneratedTool({...spec,source:'function run(input, api) { return {}; } /*'+ '字'.repeat(12000)+'*/'})).toThrow(/byte limit/);
 });
 it('validates nested input/output types, required properties and extra keys',()=>{
  const rule=toolJsonSchema.parse({type:'object',properties:{items:{type:'array',maxItems:3,items:{type:'object',properties:{name:{type:'string',enum:['A','B']},value:{type:'number',minimum:0}},required:['name','value'],additionalProperties:false}}},required:['items'],additionalProperties:false});
  expect(validateToolJson(rule,{items:[{name:'A',value:2}]})).toEqual({items:[{name:'A',value:2}]});
  for(const value of [{},{items:[{name:'A'}]},{items:[{name:'X',value:1}]},{items:[{name:'A',value:-1}]},{items:[],admin:true},{items:[{name:'A',value:1,private:true}]}])expect(()=>validateToolJson(rule,value)).toThrow();
 });
 it('rejects non-JSON, excessive structure and ambiguous schema requirements',()=>{
  for(const input of [NaN,undefined,new Date(),()=>{},JSON.parse('{"__proto__":{}}')])expect(isBoundedJson(input)).toBe(false);
  expect(isBoundedJson({value:'字'.repeat(20000)})).toBe(true);expect(isBoundedJson({first:'字'.repeat(20000),second:'字'.repeat(20000)})).toBe(false);
  let nested:unknown='x';for(let i=0;i<9;i++)nested={next:nested};expect(isBoundedJson(nested)).toBe(false);
  for(const schema of [{type:'object',properties:{},required:['missing'],additionalProperties:false},{type:'object',properties:{x:{type:'number'}},required:['x','x'],additionalProperties:false},{type:'number',minimum:3,maximum:1},{type:'object',properties:{},additionalProperties:true}])expect(()=>toolJsonSchema.parse(schema)).toThrow();
 });
 it('binds each generated invocation to an exact declared component action/version',()=>{
  const d=readingDefinition();d.appSpec.actions.push({id:'score',type:'tool.invoke',label:'Calculate score'});d.appSpec.components=[{id:'website',type:'generated-site',version:1,variant:'default',span:'full',fields:['title'],actionIds:['score'],toolBindings:[{actionId:'score',toolId:'weighted_score',toolVersion:1,kind:'generated'}]}];d.appSpec.generated={format:'html-v1',bridgeVersion:1,html:'<main>Score</main>',css:'',js:'lf.ready.then(()=>lf.reportReady());',assetIds:[]};
  expect(()=>validateDefinition(d)).not.toThrow();
  const invalid=structuredClone(d);invalid.appSpec.components[0]!.toolBindings![0]!.actionId='add';expect(()=>validateDefinition(invalid)).toThrow(/bound tool invocation/);
  const missing=structuredClone(d);delete missing.appSpec.components[0]!.toolBindings;expect(()=>validateDefinition(missing)).toThrow(/exact version/);
  const wrong=readingDefinition();wrong.appSpec.components[0]!.toolBindings=d.appSpec.components[0]!.toolBindings;expect(()=>validateDefinition(wrong)).toThrow(/Only generated/);
  const ambiguous=structuredClone(d);ambiguous.appSpec.actions.push({id:'score_catalog',type:'tool.invoke',label:'Calculate catalog score'});ambiguous.appSpec.components[0]!.actionIds.push('score_catalog');ambiguous.appSpec.components[0]!.toolBindings!.push({...ambiguous.appSpec.components[0]!.toolBindings![0]!,actionId:'score_catalog',kind:'catalog'});expect(()=>validateDefinition(ambiguous)).toThrow(/unique/);
 });
 it('accepts meaningful evolving UI outlines and rejects executable or duplicate data',()=>{
  const outline={version:1,title:'A reading room',layout:'split',sections:[{id:'intro',kind:'hero',columns:12},{id:'books',kind:'collection',items:3,columns:8}]};expect(generationOutlineSchema.parse(outline).sections).toHaveLength(2);
  for(const changed of [{...outline,html:'<script/>'},{...outline,sections:[...outline.sections,{...outline.sections[0]}]},{...outline,sections:[{id:'intro',kind:'hero',columns:50}]}])expect(()=>generationOutlineSchema.parse(changed)).toThrow();
 });
});
