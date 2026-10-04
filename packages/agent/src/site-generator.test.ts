import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import type { AssistantMessage,Model,Api,TranscriptContext,ToolCall } from '@earendil-works/pi-ai';
import { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream';
import { readingDefinition,validateGeneratedArtifact,validateEvolution,type Proposal,type SiteGenerationProgress,type ProviderBudgetStore } from '@livingforma/contracts';
import { generateSite,createSiteGenerator,siteInstructions,siteProgress } from './site-generator';
import { configureBudgetStore,getLastRunEvidence } from './pi-runtime';
import { planProposal,plannerParameters } from './planner';

const provider=vi.hoisted(()=>({stream:vi.fn()}));
vi.mock('@earendil-works/pi-ai/api/google-generative-ai',()=>({stream:provider.stream}));
const asDefinition=(proposal:Proposal,definitionVersion=1)=>({definitionVersion,entitySchema:proposal.entitySchema,appSpec:proposal.appSpec,summary:proposal.summary});
const usage={input:15,output:35,cacheRead:0,cacheWrite:0,totalTokens:50,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}};
function assistant(model:Model<Api>,content:AssistantMessage['content']):AssistantMessage {
 return {role:'assistant',api:model.api,provider:model.provider,model:model.id,content,usage,stopReason:'toolUse',timestamp:Date.now()};
}
function payload(kind='notes'){
 const interactions:Record<string,{html:string;js:string}>={
  photos:{html:'<main><h1>Photo decisions</h1><div id="deck"></div><button id="add">Add photo</button><p id="status" role="status"></p></main>',js:'(async()=>{let state=await lf.ready;const deck=document.getElementById("deck");function render(){deck.textContent=state.records.length+" photos"}deck.addEventListener("pointerdown",()=>{deck.style.transform="translateX(12px)"});document.getElementById("add").addEventListener("click",async()=>{try{const image=await lf.pickImage();state=await lf.create({title:image.assetId});render()}catch(error){document.getElementById("status").textContent=error.message}});lf.subscribe(next=>{state=next;render()});render();await lf.reportReady()})();'},
  study:{html:'<main><h1>Practice a question</h1><p id="question">What would you like to learn?</p><button id="reveal">Reveal answer</button><p id="answer" hidden></p></main>',js:'(async()=>{let state=await lf.ready;document.getElementById("reveal").addEventListener("click",()=>{const answer=document.getElementById("answer");answer.hidden=!answer.hidden;answer.textContent=state.records[0]?.values.title||"Add your first question after publishing."});lf.subscribe(next=>{state=next});await lf.reportReady()})();'},
  calculator:{html:'<main><h1>Shared bill</h1><label>Total<input id="total" type="number"></label><label>People<input id="people" type="number" min="1" value="2"></label><output id="share"></output></main>',js:'(async()=>{await lf.ready;const total=document.getElementById("total"),people=document.getElementById("people");function calculate(){document.getElementById("share").textContent=(Number(total.value)/Math.max(1,Number(people.value))).toFixed(2)}total.addEventListener("input",calculate);people.addEventListener("input",calculate);calculate();await lf.reportReady()})();'},
  notes:{html:'<main><h1>Notes</h1><ul id="notes"></ul></main>',js:'(async()=>{let state=await lf.ready;function render(){const list=document.getElementById("notes");list.replaceChildren(...state.records.map(record=>{const item=document.createElement("li");item.textContent=record.values.title;return item}))}lf.subscribe(next=>{state=next;render()});render();await lf.reportReady()})();'},
 };
 const chosen=interactions[kind];
 return {outline:{version:1,layout:'flow',title:kind,sections:[{id:'main',kind:kind==='photos'?'media':kind==='calculator'?'form':'content',label:'Main interaction',columns:12}]},title:kind,description:'A focused browser interaction.',artifact:{format:'html-v1' as const,bridgeVersion:1 as const,...chosen,css:'*{box-sizing:border-box}body{margin:0;font-family:system-ui}main{max-width:60rem;margin:auto;padding:2rem}button,input{font:inherit}@media(prefers-reduced-motion:reduce){*{transition:none!important}}',assetIds:[]},entitySchema:{schemaVersion:1,name:'Item',fields:[{id:'title',label:'Title',type:'text' as const,public:true,required:false}]},actions:[{id:'add',type:'record.create' as const,label:'Add item'}],skin:'linen' as const,summary:'Created a custom interaction.',capabilityGaps:[] as string[]};
}
function emitCandidate(model:Model<Api>,args:unknown,options?:{wait?:Promise<void>;before?:()=>void;noTool?:boolean;updates?:unknown[]}){
 const stream=new AssistantMessageEventStream();
 queueMicrotask(async()=>{
  const empty=assistant(model,[]);stream.push({type:'start',partial:empty});
  const thought=assistant(model,[{type:'thinking',thinking:'PRIVATE_THINKING_DO_NOT_EXPOSE'}]);
  stream.push({type:'thinking_start',contentIndex:0,partial:thought});stream.push({type:'thinking_delta',contentIndex:0,delta:'PRIVATE_THINKING_DO_NOT_EXPOSE',partial:thought});
  options?.before?.();if(options?.wait)await options.wait;
  if(options?.noTool){const message={...assistant(model,[{type:'text' as const,text:'Unusable response'}]),stopReason:'stop' as const};stream.push({type:'done',reason:'stop',message});stream.end();return;}
  for(const update of options?.updates??[]){const part=assistant(model,[{type:'toolCall',id:'site',name:'submit_site',arguments:update as ToolCall['arguments']}]);stream.push({type:'toolcall_delta',contentIndex:0,delta:JSON.stringify(update),partial:part});}
  const message=assistant(model,[{type:'toolCall',id:'site',name:'submit_site',arguments:args as ToolCall['arguments']}]);
  stream.push({type:'toolcall_start',contentIndex:0,partial:message});stream.push({type:'toolcall_delta',contentIndex:0,delta:JSON.stringify(args),partial:message});stream.push({type:'toolcall_end',contentIndex:0,toolCall:message.content[0] as any,partial:message});stream.push({type:'done',reason:'toolUse',message});stream.end();
 });return stream;
}
let reservations:Parameters<ProviderBudgetStore['reserve']>[0][],contexts:TranscriptContext[];
beforeEach(()=>{
 vi.stubEnv('GEMINI_API_KEY','fixture-key-never-real');vi.stubEnv('GEMINI_FREE_TIER_VERIFIED','true');vi.stubEnv('GEMINI_MODEL','gemini-3.5-flash-lite');vi.stubEnv('NODE_ENV','production');
 reservations=[];contexts=[];configureBudgetStore({reserve:async value=>{reservations.push(value)}});provider.stream.mockReset();
 provider.stream.mockImplementation((model:Model<Api>,context:TranscriptContext)=>{contexts.push(context);return emitCandidate(model,payload())});
});
afterEach(()=>{vi.unstubAllEnvs();configureBudgetStore(undefined as never)});

describe('general website generation through real Pi with an offline provider stream',()=>{
 it.each([
  ['Create swipeable photo decisions with user uploads','photos'],
  ['制作可以揭示答案的学习页面','study'],
  ['Split a dinner bill with an interactive calculator','calculator'],
 ])('passes the ordinary intent through one source-authoring tool: %s',async(prompt,kind)=>{
  provider.stream.mockImplementation((model:Model<Api>,context:TranscriptContext)=>{contexts.push(context);return emitCandidate(model,payload(kind))});
  const progress:SiteGenerationProgress[]=[];const result=await generateSite({prompt,current:null,onProgress:event=>progress.push(event)});
  expect(provider.stream).toHaveBeenCalledTimes(1);expect(provider.stream.mock.calls[0][2]).toMatchObject({maxTokens:6000,maxRetries:0,maxRetryDelayMs:0,toolChoice:'any'});expect(reservations).toHaveLength(1);expect(reservations[0]).toMatchObject({provider:'gemini',dailyLimit:30,minuteLimit:5});
  expect(result.appSpec.generated?.html).toEqual(payload(kind).artifact.html);expect(result.appSpec.generated?.js).toEqual(payload(kind).artifact.js);expect(result.appSpec.components).toHaveLength(1);expect(result.appSpec.components[0].type).toBe('generated-site');
  expect(result.source).toBe('gemini');validateGeneratedArtifact(result.appSpec.generated);validateEvolution(null,asDefinition(result));
  expect(JSON.stringify(contexts)).toContain(prompt);expect(progress.some(event=>event.stage==='writing'&&event.source?.js)).toBe(true);expect(JSON.stringify(progress)).not.toContain('PRIVATE_THINKING');
  expect(getLastRunEvidence()).toMatchObject({requests:1,toolCalls:['submit_site']});
 });
 it('emits only actual partial source checkpoints and never text/thinking/tool metadata',async()=>{
  let continueStream!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>continueStream=r),ready=new Promise<void>(r=>entered=r);
  const candidate=payload();provider.stream.mockImplementation((model:Model<Api>)=>emitCandidate(model,candidate,{wait:waiting,before:entered,updates:[{outline:candidate.outline},{artifact:{html:'<main><h1>Notes</h1>'}},{artifact:{html:candidate.artifact.html}}]}));
  const progress:SiteGenerationProgress[]=[];const generation=generateSite({prompt:'A notes page',current:null,onProgress:p=>progress.push(p)});await ready;
  expect(progress.map(p=>p.stage)).toEqual(['planning']);continueStream();await generation;
  const html=progress.flatMap(p=>p.source?.html?[p.source.html]:[]);expect(html).toEqual(['<main><h1>Notes</h1>',candidate.artifact.html]);
  expect(progress.filter(p=>p.ui)).toHaveLength(1);expect(progress.find(p=>p.ui)?.ui).toEqual(candidate.outline);expect(progress.filter(p=>p.source?.js)).toHaveLength(1);expect(progress.at(-1)?.stage).toBe('validating');expect(JSON.stringify(progress)).not.toMatch(/PRIVATE_THINKING|toolCall|arguments/);
 });
 it('removes private defaults from current and repair context without mutating the old definition',async()=>{
  const current=readingDefinition();current.entitySchema.fields.push({id:'private_note',label:'Private note',type:'text',required:false,public:false,defaultValue:'PRIVATE_VALUE_NEVER_SEND'});
  const initial=structuredClone(current),candidate=payload();candidate.entitySchema=structuredClone(initial.entitySchema) as any;delete (candidate.entitySchema.fields.at(-1)! as any).defaultValue;
  provider.stream.mockImplementation((model:Model<Api>,context:TranscriptContext)=>{contexts.push(context);return emitCandidate(model,candidate)});
  const prior:Proposal={entitySchema:structuredClone(initial.entitySchema),appSpec:{...initial.appSpec,generated:candidate.artifact,components:[{id:'stable-site',type:'generated-site',version:1,variant:'default',span:'full',fields:['title'],actionIds:['add']}]},summary:'Prior candidate',source:'gemini',capabilityGaps:[]};
  const progress:SiteGenerationProgress[]=[];const result=await generateSite({prompt:'Make the reading page calmer',current,onProgress:p=>progress.push(p),repair:{proposal:prior,errors:['Button did not respond','api_key=abcdefghijklmnop']}});
  expect(JSON.stringify(contexts)).not.toContain('PRIVATE_VALUE_NEVER_SEND');expect(JSON.stringify(contexts)).not.toContain('abcdefghijklmnop');expect(JSON.stringify(contexts)).toContain('Button did not respond');
  expect(current).toEqual(initial);expect(result.appSpec.components[0].fields).not.toContain('private_note');expect(result.entitySchema.fields.find(f=>f.id==='private_note')?.defaultValue).toBeUndefined();expect(progress[0].stage).toBe('repairing');
 });
 it('preserves generated surface identity and old schema while rewriting source',async()=>{
  const source=payload();const prior=await generateSite({prompt:'A notes page',current:null});const current=asDefinition(prior,4);current.appSpec.components[0].id='original-surface';
  const old=structuredClone(current);provider.stream.mockImplementation((model:Model<Api>)=>emitCandidate(model,{...source,artifact:{...source.artifact,css:'body{background:#e5ede3}'},summary:'Changed the visual theme.'}));
  const next=await generateSite({prompt:'Change the presentation only',current});expect(current).toEqual(old);expect(next.entitySchema).toEqual(current.entitySchema);expect(next.appSpec.components[0].id).toBe('original-surface');validateEvolution(current,asDefinition(next,5));
 });
 it('leaves one static repair to the host and feeds concrete errors into that single second request',async()=>{
  const broken=payload();broken.artifact.js='const = ;';provider.stream.mockImplementationOnce((model:Model<Api>)=>emitCandidate(model,broken));
  const events:SiteGenerationProgress[]=[];const first=await generateSite({prompt:'A notes page',current:null,onProgress:e=>events.push(e)});
  expect(()=>validateGeneratedArtifact(first.appSpec.generated)).toThrow(/syntax/);expect(events.at(-1)?.message).toContain('No preview has been approved');expect(provider.stream).toHaveBeenCalledTimes(1);
  const fixed=await generateSite({prompt:'A notes page',current:null,repair:{proposal:first,errors:['JavaScript syntax: Unexpected token (1:6)']}});
  validateGeneratedArtifact(fixed.appSpec.generated);expect(provider.stream).toHaveBeenCalledTimes(2);expect(reservations).toHaveLength(2);expect(JSON.stringify(contexts)).toContain('Unexpected token (1:6)');
 });
 it('returns a well-shaped destructive schema for authoritative rejection, not silent data replacement',async()=>{
  const current=readingDefinition();const candidate=payload();provider.stream.mockImplementation((model:Model<Api>)=>emitCandidate(model,candidate));
  const result=await generateSite({prompt:'A new look preserving records',current});expect(()=>validateEvolution(current,asDefinition(result,2))).toThrow(/Destructive/);expect(current).toEqual(readingDefinition());expect(provider.stream).toHaveBeenCalledTimes(1);
 });
 it('fails malformed or missing tool output without hidden provider retries',async()=>{
  provider.stream.mockImplementationOnce((model:Model<Api>)=>emitCandidate(model,{},{}));await expect(generateSite({prompt:'A notes page',current:null})).rejects.toMatchObject({code:'PROVIDER_OUTPUT_INVALID'});expect(getLastRunEvidence()?.candidateFailures?.[0].phase).toBe('arguments');
  expect(provider.stream).toHaveBeenCalledTimes(1);provider.stream.mockImplementationOnce((model:Model<Api>)=>emitCandidate(model,{}, {noTool:true}));await expect(generateSite({prompt:'A notes page',current:null})).rejects.toMatchObject({code:'PROVIDER_FAILED'});expect(provider.stream).toHaveBeenCalledTimes(2);
 });
 it('keeps the actual failed tool candidate in an explicitly supplied diagnostic observer',async()=>{
  const candidate=payload();candidate.summary='x'.repeat(501);const observed:unknown[]=[];
  provider.stream.mockImplementation((model:Model<Api>)=>emitCandidate(model,candidate));
  await expect(createSiteGenerator({onCandidate:value=>observed.push(value)})({prompt:'A page',current:null})).rejects.toMatchObject({code:'PROVIDER_OUTPUT_INVALID'});
  expect(observed).toHaveLength(1);expect((observed[0] as any).summary).toHaveLength(501);expect(getLastRunEvidence()?.candidateFailures?.[0]).toMatchObject({phase:'arguments',issues:[{path:'summary',rule:'bound'}]});
  expect(JSON.stringify(getLastRunEvidence())).not.toContain('x'.repeat(50));expect(provider.stream).toHaveBeenCalledTimes(1);
 });
 it('redacts private defaults and withholds credential-like candidates from opt-in diagnostics',async()=>{
  const candidate=payload();candidate.entitySchema.fields.push({id:'private',label:'Private',type:'text',public:false,required:false,defaultValue:'PRIVATE_DEFAULT'} as any);const observed:unknown[]=[];
  provider.stream.mockImplementation((model:Model<Api>)=>emitCandidate(model,candidate));const controlled=createSiteGenerator({onCandidate:value=>observed.push(value)});
  await controlled({prompt:'A page',current:null});expect(JSON.stringify(observed)).not.toContain('PRIVATE_DEFAULT');expect((candidate.entitySchema.fields.at(-1) as any).defaultValue).toBe('PRIVATE_DEFAULT');
  candidate.artifact.html='<p>api_key=abcdefghijklmnop</p>';await controlled({prompt:'A page',current:null});expect(observed).toHaveLength(1);
 });
});

describe('source progress and provider boundaries',()=>{
 it('requires an injected durable budget even outside production and refuses unverified quota before streaming',async()=>{
  configureBudgetStore(undefined as never);vi.stubEnv('NODE_ENV','development');await expect(generateSite({prompt:'A page',current:null})).rejects.toMatchObject({code:'BUDGET_NOT_CONFIGURED'});expect(provider.stream).not.toHaveBeenCalled();
  configureBudgetStore({reserve:async()=>{throw new Error('budget offline')}});await expect(generateSite({prompt:'A page',current:null})).rejects.toMatchObject({code:'FREE_QUOTA_EXHAUSTED'});expect(provider.stream).not.toHaveBeenCalled();
  vi.stubEnv('GEMINI_FREE_TIER_VERIFIED','false');await expect(generateSite({prompt:'A page',current:null})).rejects.toThrow();expect(provider.stream).not.toHaveBeenCalled();
 });
 it('rejects unsupported model and credential-bearing requests without reserving',async()=>{
  vi.stubEnv('GEMINI_MODEL','unapproved-model');await expect(generateSite({prompt:'A page',current:null})).rejects.toMatchObject({code:'MODEL_NOT_APPROVED'});expect(reservations).toHaveLength(0);
  await expect(generateSite({prompt:'Use api_key=abcdefghijklmnop',current:null})).rejects.toMatchObject({code:'SENSITIVE_PROMPT'});expect(provider.stream).not.toHaveBeenCalled();
 });
 it('cancels during a budget reservation without provider fallback or refund',async()=>{
  let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>entered=r);const controller=new AbortController();
  configureBudgetStore({reserve:async input=>{reservations.push(input);entered();await waiting}});
  const result=generateSite({prompt:'A page',current:null,signal:controller.signal});await ready;controller.abort();release();await expect(result).rejects.toMatchObject({code:'ABORTED'});expect(reservations).toHaveLength(1);expect(provider.stream).not.toHaveBeenCalled();
 });
 it('suppresses late source and candidates after cancellation',async()=>{
  let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>entered=r);const controller=new AbortController();
  provider.stream.mockImplementation((model:Model<Api>)=>emitCandidate(model,payload(),{wait:waiting,before:entered}));const progress:SiteGenerationProgress[]=[];
  const generation=generateSite({prompt:'A page',current:null,signal:controller.signal,onProgress:event=>progress.push(event)});await ready;controller.abort();const count=progress.length;release();await expect(generation).rejects.toMatchObject({code:'ABORTED'});expect(progress).toHaveLength(count);expect(reservations).toHaveLength(1);
 });
 it('allows only one active provider run without reserving a second request',async()=>{
  let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>entered=r);
  provider.stream.mockImplementation((model:Model<Api>)=>emitCandidate(model,payload(),{wait:waiting,before:entered}));const first=generateSite({prompt:'A page',current:null});await ready;
  await expect(generateSite({prompt:'Another page',current:null})).rejects.toMatchObject({code:'PROVIDER_BUSY'});expect(reservations).toHaveLength(1);release();await first;expect(provider.stream).toHaveBeenCalledTimes(1);
 });
 it('accepts complete safe outlines but drops incomplete, duplicate, markup and unrelated tool metadata',()=>{
  const events:SiteGenerationProgress[]=[];const progress=siteProgress(p=>events.push(p));const valid=payload().outline;
  for(const invalid of [{version:1},{...valid,sections:[valid.sections[0],valid.sections[0]]},{...valid,title:'<script>bad</script>'},{...valid,title:'api_key=abcdefghijklmnop'}])progress.source({outline:invalid});expect(events).toEqual([]);
  progress.source({outline:valid});progress.source({outline:valid});expect(events).toHaveLength(1);expect(events[0].ui).toEqual(valid);
  const update={type:'toolcall_delta',contentIndex:0,delta:'PRIVATE_DELTA',partial:{content:[{type:'toolCall',name:'another_tool',arguments:{artifact:{html:'PRIVATE_HTML'},outline:valid}}]}};
  progress.onEvent({type:'message_update',message:{} as any,assistantMessageEvent:update as any});expect(events).toHaveLength(1);expect(JSON.stringify(events)).not.toMatch(/PRIVATE_/);
 });
 it('withholds credential-like source and bounds noisy actual updates',()=>{
  const events:SiteGenerationProgress[]=[];const progress=siteProgress(p=>events.push(p));
  progress.source({artifact:{html:'<p>api_key=abcdefghijklmnop</p>',css:'body{}',js:'const key="AIza";'}});expect(events[0].source).toEqual({css:'body{}'});
  for(let i=0;i<300;i++)progress.source({artifact:{html:`<div>${'x'.repeat(7000)}${i}</div>`}});
  expect(events.length).toBeLessThanOrEqual(50);expect(events.reduce((n,e)=>n+Object.values(e.source??{}).join('').length,0)).toBeLessThanOrEqual(160000);expect(JSON.stringify(events)).not.toMatch(/abcdefghijklmnop|AIza/);
 });
 it('keeps generated-site out of the 60-module planner and protects the studio boundary',async()=>{
  const schema=plannerParameters as any;expect(schema.properties.appSpec.properties.components.items.properties.type.enum).not.toContain('generated-site');
  const generated=await generateSite({prompt:'A page',current:null});await expect(planProposal({prompt:'Make it sage',current:asDefinition(generated)})).rejects.toMatchObject({code:'GENERATION_PREVIEW_REQUIRED'});
  expect(siteInstructions).toContain('FULL PUBLIC STATE, NOT a record');expect(siteInstructions).toContain('lf.reportReady()');
 });
});
