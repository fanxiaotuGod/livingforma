import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import type { Api,AssistantMessage,Model,ToolCall,TranscriptContext } from '@earendil-works/pi-ai';
import { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream';
import { generatedToolManifest,readingDefinition,validateEvolution,validateGeneratedArtifact,validateGeneratedTool,type GeneratedToolSpec,type ProviderBudgetStore,type SiteGenerationProgress,type ToolJsonSchema } from '@livingforma/contracts';
import { createGeneratedToolAdapter } from '../../../apps/api/src/generated-tool-runtime';
import { generateTool,checkCodeDependencies,decodeCodeTool,toolWriting,codeToolInstructions } from './tool-generator';
import { generateSite,siteInstructions } from './site-generator';
import { modelRegistry } from './generation-context';
import { OPEN_LIBRARY_SPEC } from './tools';
import { configureBudgetStore,getLastRunEvidence } from './pi-runtime';

const provider=vi.hoisted(()=>({stream:vi.fn()}));
vi.mock('@earendil-works/pi-ai/api/google-generative-ai',()=>({stream:provider.stream}));
const schema=(properties:Record<string,ToolJsonSchema>):Extract<ToolJsonSchema,{type:'object'}>=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
function fixture(kind:'weighted'|'normalize'|'records'|'connector'):GeneratedToolSpec {
 const common={kind:'code-js-v1' as const,toolId:kind,toolVersion:1,name:kind,description:'Synthetic test fixture for original computation.',sideEffects:'none' as const,capabilities:{publicRecordFields:[] as string[],connectors:[] as {toolId:string;toolVersion:number}[]}};
 if(kind==='weighted')return {...common,source:'function run(input, api){return {total:input.values.reduce((sum,n)=>sum+n,0)*input.factor}}',inputSchema:schema({values:{type:'array',items:{type:'number'},maxItems:20},factor:{type:'number'}}),outputSchema:schema({total:{type:'number'}}),tests:[{name:'Mixed signs',input:{values:[3,-1,4],factor:2},expected:{total:12}},{name:'Empty list',input:{values:[],factor:5},expected:{total:0}}]};
 if(kind==='normalize')return {...common,source:'function run(input, api){const words=input.text.toLowerCase().split(" ").filter(Boolean);return {normalized:words.join(" "),count:words.length}}',inputSchema:schema({text:{type:'string',maxLength:500}}),outputSchema:schema({normalized:{type:'string'},count:{type:'number'}}),tests:[{name:'Repeated spaces',input:{text:'Hello   WORLD'},expected:{normalized:'hello world',count:2}},{name:'Empty text',input:{text:''},expected:{normalized:'',count:0}}]};
 if(kind==='records')return {...common,source:'async function run(input, api){const rows=await api.readRecords({fields:["points"],limit:100});return {total:rows.filter(row=>row.values.points>=input.minimum).reduce((sum,row)=>sum+row.values.points,0)}}',inputSchema:schema({minimum:{type:'number'}}),outputSchema:schema({total:{type:'number'}}),capabilities:{publicRecordFields:['points'],connectors:[]},tests:[{name:'Threshold',input:{minimum:5},expected:{total:9},records:[{id:'example-a',version:1,values:{points:4}},{id:'example-b',version:1,values:{points:9}}]},{name:'No records',input:{minimum:0},expected:{total:0},records:[]}]};
 return {...common,source:'async function run(input, api){const found=await api.callConnector({toolId:"openlibrary_search",toolVersion:1,input:{q:input.query}});return {titles:found.books.map(book=>book.title)}}',inputSchema:schema({query:{type:'string',maxLength:100}}),outputSchema:schema({titles:{type:'array',items:{type:'string'},maxItems:5}}),capabilities:{publicRecordFields:[],connectors:[{toolId:'openlibrary_search',toolVersion:1}]},tests:[{name:'Titles',input:{query:'example'},expected:{titles:['Synthetic book']},connectorResults:[{toolId:'openlibrary_search',toolVersion:1,input:{q:'example'},result:{books:[{title:'Synthetic book'}]}}]},{name:'No matches',input:{query:'missing'},expected:{titles:[]},connectorResults:[{toolId:'openlibrary_search',toolVersion:1,input:{q:'missing'},result:{books:[]}}]}]};
}
function encoded(spec:GeneratedToolSpec){return {toolId:spec.toolId,toolVersion:spec.toolVersion,name:spec.name,description:spec.description,source:spec.source,inputSchemaJson:JSON.stringify(spec.inputSchema),outputSchemaJson:JSON.stringify(spec.outputSchema),capabilities:spec.capabilities,testsJson:JSON.stringify(spec.tests)};}
const catalog={spec:OPEN_LIBRARY_SPEC,enabled:true,verifiedAt:'2026-10-03T00:00:00Z',invocationCount:0};
function site(spec:GeneratedToolSpec,create=true){
 return {outline:{version:1,layout:'split',sections:[{id:'controls',kind:'form',label:'Calculation',columns:6},{id:'answer',kind:'metrics',label:'Computed result',columns:6}]},title:'Weighted values',description:'A server calculation.',skin:'linen',summary:'Added a custom calculation.',capabilityGaps:[],entitySchema:{schemaVersion:1,name:'Item',fields:[{id:'title',label:'Title',type:'text',public:true,required:false}]},actions:[{id:'calculate',type:'tool.invoke',label:'Calculate'}],toolBindings:[{actionId:'calculate',toolId:spec.toolId,toolVersion:spec.toolVersion,kind:'generated'}],...(create?{codeTools:[encoded(spec)]}:{}),artifact:{format:'html-v1',bridgeVersion:1,assetIds:[],html:'<main><button id="run">Calculate</button><output id="answer"></output></main>',css:'main{max-width:40rem;margin:auto;padding:2rem}button{font:inherit}',js:'(async()=>{const state=await lf.ready;const button=document.getElementById("run"),answer=document.getElementById("answer");button.disabled=state.preview||!state.permissions.canUseTools;button.textContent=state.preview?"Publish to run tool":"Calculate";button.addEventListener("click",async()=>{button.disabled=true;answer.textContent="Calculating";try{const response=await lf.runTool("weighted",1,{values:[1,2],factor:3});answer.textContent=String(response.result.total)}catch(error){answer.textContent=error.message}finally{button.disabled=false}});await lf.reportReady()})();'}};
}
function stream(model:Model<Api>,args:unknown,name='submit_tool',options?:{updates?:unknown[];wait?:Promise<void>;entered?:()=>void}){
 const result=new AssistantMessageEventStream();const message=(argumentsValue:unknown):AssistantMessage=>({role:'assistant',api:model.api,provider:model.provider,model:model.id,content:[{type:'toolCall',id:'candidate',name,arguments:argumentsValue as ToolCall['arguments']}],usage:{input:10,output:50,cacheRead:0,cacheWrite:0,totalTokens:60,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'toolUse',timestamp:Date.now()});
 queueMicrotask(async()=>{result.push({type:'start',partial:{...message({}),content:[]}});options?.entered?.();if(options?.wait)await options.wait;for(const update of options?.updates??[]){const partial=message(update);result.push({type:'toolcall_delta',contentIndex:0,delta:JSON.stringify(update),partial});}const final=message(args);result.push({type:'toolcall_start',contentIndex:0,partial:final});result.push({type:'toolcall_delta',contentIndex:0,delta:JSON.stringify(args),partial:final});result.push({type:'toolcall_end',contentIndex:0,toolCall:final.content[0] as ToolCall,partial:final});result.push({type:'done',reason:'toolUse',message:final});result.end();});return result;
}
let reservations:Parameters<ProviderBudgetStore['reserve']>[0][],contexts:TranscriptContext[];
beforeEach(()=>{vi.stubEnv('GEMINI_API_KEY','offline-fixture-key');vi.stubEnv('GEMINI_FREE_TIER_VERIFIED','true');vi.stubEnv('GEMINI_MODEL','gemini-3.5-flash-lite');vi.stubEnv('NODE_ENV','production');reservations=[];contexts=[];configureBudgetStore({reserve:async input=>{reservations.push(input)}});provider.stream.mockReset();});
afterEach(()=>{vi.unstubAllEnvs();configureBudgetStore(undefined as never)});
const adapter=createGeneratedToolAdapter();
const broker={readRecords:async()=>[],callConnector:async()=>{throw new Error('No live connector I/O in this test.')}};

describe('generated backend tools through real Pi and an offline transport',()=>{
 it.each([['Weight a collection of values','weighted'],['Normalize words with an accurate count','normalize'],['Aggregate public points above a threshold','records'],['Transform existing book search metadata','connector']] as const)('authors distinct source and runs its fixtures in real QuickJS: %s',async(prompt,kind)=>{
  const spec=fixture(kind);provider.stream.mockImplementation((model:Model<Api>,context:TranscriptContext)=>{contexts.push(context);return stream(model,{decision:'create',tool:encoded(spec),summary:'A custom backend candidate.'})});
  const progress:SiteGenerationProgress[]=[];const result=await generateTool({prompt,current:null,registeredTools:[],registeredCatalogTools:[catalog],onProgress:event=>progress.push(event)});
  expect(result.spec).toEqual(spec);expect(result.reuse).toBeNull();validateGeneratedTool(result.spec);expect((await adapter.test(result.spec!)).ok).toBe(true);
  expect(provider.stream).toHaveBeenCalledTimes(1);expect(reservations).toHaveLength(1);expect(provider.stream.mock.calls[0][2]).toMatchObject({maxTokens:6000,maxRetries:0});expect(getLastRunEvidence()?.toolCalls).toEqual(['submit_tool']);expect(JSON.stringify(contexts)).toContain(prompt);
  expect(progress.filter(p=>p.tool)).toHaveLength(1);expect(progress.find(p=>p.tool)?.tool).toMatchObject({toolId:kind,phase:'writing'});expect(progress.every(p=>!p.tool||p.tool.phase==='writing')).toBe(true);expect(JSON.stringify(progress)).not.toContain(spec.source);
 },20000);
 it('selects an exact enabled version without generating code, exposing private defaults or fixture/source metadata',async()=>{
  const spec=fixture('weighted'),current=readingDefinition();current.entitySchema.fields.push({id:'private_note',label:'Private note',type:'text',public:false,required:false,defaultValue:'PRIVATE_DEFAULT'});
  const manifest={...generatedToolManifest(spec),source:'SOURCE_MUST_NOT_ENTER_CONTEXT',tests:[{records:'PRIVATE_FIXTURES'}]};
  provider.stream.mockImplementation((model:Model<Api>,context:TranscriptContext)=>{contexts.push(context);return stream(model,{decision:'reuse',reuse:{toolId:'weighted',toolVersion:1},summary:'Reuse the compatible weighted calculation.'})});
  const progress:SiteGenerationProgress[]=[];const result=await generateTool({prompt:'Reuse the weighted calculation',current,registeredTools:[manifest],registeredCatalogTools:[{...catalog,enabled:false}],onProgress:p=>progress.push(p)});
  expect(result.spec).toBeNull();expect(result.reuse).toEqual({toolId:'weighted',toolVersion:1});expect(progress.some(p=>p.tool)).toBe(false);
  const context=JSON.stringify(contexts);expect(context).not.toMatch(/PRIVATE_DEFAULT|SOURCE_MUST_NOT_ENTER_CONTEXT|PRIVATE_FIXTURES|openlibrary_search/);expect(current.entitySchema.fields.at(-1)?.defaultValue).toBe('PRIVATE_DEFAULT');
 });
 it('refuses invented reuse and malformed JSON without retries or pretending a tool is enabled',async()=>{
  provider.stream.mockImplementationOnce((model:Model<Api>)=>stream(model,{decision:'reuse',reuse:{toolId:'absent',toolVersion:2},summary:'Reuse.'}));
  await expect(generateTool({prompt:'Reuse a tool',current:null,registeredTools:[]})).rejects.toThrow();expect(provider.stream).toHaveBeenCalledTimes(1);
  const malformed=encoded(fixture('weighted'));malformed.testsJson='[broken';provider.stream.mockImplementationOnce((model:Model<Api>)=>stream(model,{decision:'create',tool:malformed,summary:'A candidate.'}));
  await expect(generateTool({prompt:'Compute weights',current:null,registeredTools:[]})).rejects.toThrow();expect(provider.stream).toHaveBeenCalledTimes(2);expect(reservations).toHaveLength(2);
 });
 it('generates page, original backend source and exact binding together, then reuses the registered version',async()=>{
  const spec=fixture('weighted');provider.stream.mockImplementationOnce((model:Model<Api>,context:TranscriptContext)=>{contexts.push(context);return stream(model,site(spec),'submit_site',{updates:[{codeTools:[{toolId:spec.toolId,toolVersion:1,name:spec.name,source:'function run(input, api){'}]}]})});
  const events:SiteGenerationProgress[]=[];const proposal=await generateSite({prompt:'Build a page with a reusable server weighted calculation',current:null,onProgress:event=>events.push(event)});
  expect(provider.stream).toHaveBeenCalledTimes(1);expect(proposal.codeToolProposals).toEqual([spec]);expect(proposal.appSpec.components[0].toolBindings).toEqual([{actionId:'calculate',toolId:'weighted',toolVersion:1,kind:'generated'}]);expect(proposal.appSpec.components[0].actionIds).toContain('calculate');
  const current={definitionVersion:1,entitySchema:proposal.entitySchema,appSpec:proposal.appSpec,summary:proposal.summary};validateGeneratedArtifact(current.appSpec.generated);validateEvolution(null,current);expect((await adapter.test(spec)).ok).toBe(true);
  expect(await adapter.invoke(spec,{values:[1,2],factor:3},{broker})).toEqual({total:9});expect(events.filter(event=>event.tool).map(event=>event.tool?.phase)).toEqual(['writing','writing']);
  const unchanged=structuredClone(current);provider.stream.mockImplementationOnce((model:Model<Api>,context:TranscriptContext)=>{contexts.push(context);return stream(model,site(spec,false),'submit_site')});
  const reused=await generateSite({prompt:'Keep the saved data and reuse the calculation in a fresh layout',current,registeredTools:[generatedToolManifest(spec)]});
  expect(reused.codeToolProposals).toBeUndefined();expect(reused.appSpec.components[0].toolBindings).toEqual(proposal.appSpec.components[0].toolBindings);expect(current).toEqual(unchanged);validateEvolution(current,{...current,definitionVersion:2,entitySchema:reused.entitySchema,appSpec:reused.appSpec});expect(provider.stream).toHaveBeenCalledTimes(2);
  expect(siteInstructions).toContain('response.result');expect(siteInstructions).toContain('Publish to run tool');expect(codeToolInstructions).toContain('row.values');
 },20000);
 it('returns a shape-valid broken tool for the host single repair using concrete diagnostics',async()=>{
  const broken=fixture('weighted');broken.source='function run(input, api){ return {total: input.values.reduce((a,b)=>a+b,0)} }';const first=site(broken);
  provider.stream.mockImplementationOnce((model:Model<Api>)=>stream(model,first,'submit_site'));const proposal=await generateSite({prompt:'Weighted calculation',current:null});expect((await adapter.test(proposal.codeToolProposals![0])).ok).toBe(false);expect(provider.stream).toHaveBeenCalledTimes(1);
  provider.stream.mockImplementationOnce((model:Model<Api>,context:TranscriptContext)=>{contexts.push(context);return stream(model,site(fixture('weighted')),'submit_site')});
  const repaired=await generateSite({prompt:'Weighted calculation',current:null,repair:{proposal,errors:['weighted fixture Mixed signs expected total 12; apply the factor.']}});expect((await adapter.test(repaired.codeToolProposals![0])).ok).toBe(true);expect(provider.stream).toHaveBeenCalledTimes(2);expect(reservations).toHaveLength(2);expect(JSON.stringify(contexts)).toContain('apply the factor');
 },20000);
});

describe('generated tool boundaries without live providers',()=>{
 it('validates exact read-only dependencies and leaves unavailable targets for authoritative host rejection',()=>{
  const current=readingDefinition(),spec=fixture('weighted'),registry=modelRegistry([generatedToolManifest(spec)],[catalog]);
  expect(()=>checkCodeDependencies([spec],registry,current.entitySchema)).toThrow('Reuse');spec.toolVersion=2;expect(()=>checkCodeDependencies([spec],registry,current.entitySchema)).not.toThrow();
  spec.capabilities.publicRecordFields=['private'];expect(()=>checkCodeDependencies([spec],registry,current.entitySchema)).toThrow('public');spec.capabilities.publicRecordFields=[];
  spec.capabilities.connectors=[{toolId:'openlibrary_search',toolVersion:2}];expect(()=>checkCodeDependencies([spec],registry,current.entitySchema)).toThrow('enabled');spec.capabilities.connectors=[{toolId:'openlibrary_search',toolVersion:1}];expect(()=>checkCodeDependencies([spec],registry,current.entitySchema)).not.toThrow();
  expect(()=>checkCodeDependencies([],registry,current.entitySchema,[{actionId:'run',toolId:'weighted',toolVersion:99,kind:'generated'}])).toThrow('exact');expect(()=>decodeCodeTool({...encoded(spec),inputSchemaJson:'{}'})).toThrow();
 });
 it('requires the same durable provider budget and cancels late tool-writing results',async()=>{
  configureBudgetStore(undefined as never);await expect(generateTool({prompt:'Compute',current:null,registeredTools:[]})).rejects.toMatchObject({code:'BUDGET_NOT_CONFIGURED'});expect(provider.stream).not.toHaveBeenCalled();
  configureBudgetStore({reserve:async()=>{throw new Error('No free allowance')}});await expect(generateTool({prompt:'Compute',current:null,registeredTools:[]})).rejects.toMatchObject({code:'FREE_QUOTA_EXHAUSTED'});expect(provider.stream).not.toHaveBeenCalled();
  let release!:()=>void,entered!:()=>void;const pending=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>entered=r);configureBudgetStore({reserve:async input=>{reservations.push(input)}});const controller=new AbortController(),progress:SiteGenerationProgress[]=[];
  provider.stream.mockImplementation((model:Model<Api>)=>stream(model,{decision:'create',tool:encoded(fixture('weighted')),summary:'Candidate.'},'submit_tool',{wait:pending,entered}));
  const generation=generateTool({prompt:'Compute weights',current:null,registeredTools:[],signal:controller.signal,onProgress:p=>progress.push(p)});await ready;controller.abort();const length=progress.length;release();await expect(generation).rejects.toMatchObject({code:'ABORTED'});expect(progress).toHaveLength(length);expect(reservations).toHaveLength(1);
 });
 it('withholds sensitive source and caps actual writing updates without fabricating test status',()=>{
  const events:SiteGenerationProgress[]=[];const writing=toolWriting(e=>events.push(e));const tool=encoded(fixture('weighted'));
  writing({...tool,source:'api_key=abcdefghijklmnop'});writing({...tool,name:'<script>bad</script>'});writing({...tool,source:''});expect(events).toEqual([]);
  for(let i=0;i<100;i++)writing({...tool,source:tool.source+' '.repeat(i)});expect(events).toHaveLength(24);expect(events.every(event=>event.tool?.phase==='writing')).toBe(true);
 });
});
