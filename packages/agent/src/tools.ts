import { resolve4 } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { Agent, type AgentTool, type StreamFn } from '@earendil-works/pi-agent-core';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream';
import { Type } from 'typebox';
import { toolSpecSchema, type RegisteredTool, type ToolAdapter, type ToolSpec, type ToolProposal } from '@livingforma/contracts';
import { PlannerError, runGeminiTools } from './pi-runtime';

export const OPEN_LIBRARY_SPEC:ToolSpec={toolId:'openlibrary_search',toolVersion:1,name:'Open Library book search',description:'Find books by title or author using Open Library. A human-initiated, read-only public metadata lookup.',endpointId:'openlibrary_search',method:'GET',sideEffects:'none',parameters:[{name:'q',type:'string',required:true}],responseMap:{books:'docs',total:'numFound'},timeoutMs:8000};
export type { ToolProposal } from '@livingforma/contracts';
export const toolIntent=(prompt:string)=>/open.?library|(?:search|find|look.?up|lookup|fetch|discover).*(?:book|author)|(?:book|author).*(?:search|lookup)|查.*书|搜索.*书/i.test(prompt);
export function validateToolSpec(input:unknown):ToolSpec{
  const spec=toolSpecSchema.parse(input);
  if(spec.endpointId!=='openlibrary_search'||spec.toolId!=='openlibrary_search'||spec.toolVersion!==1)throw new Error('This tool is not in the trusted endpoint catalog.');
  if(JSON.stringify(spec.parameters)!==JSON.stringify(OPEN_LIBRARY_SPEC.parameters)||Object.keys(spec.responseMap).length!==2||spec.responseMap.books!=='docs'||spec.responseMap.total!=='numFound')throw new Error('The endpoint only accepts its registered query and response mapping.');
  return spec;
}
export function validateToolInput(input:Record<string,unknown>):{q:string}{
  if(!input||Object.keys(input).some(k=>k!=='q')||typeof input.q!=='string'||!input.q.trim()||input.q.length>200||/[\x00-\x1f]/.test(input.q))throw new Error('Enter a book title or author in 1–200 characters.');
  return {q:input.q.trim()};
}
export function isPublicIPv4(address:string):boolean{
  if(isIP(address)!==4)return false;
  const [a,b,c]=address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2||(b===88&&c===99)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
}
export function projectOpenLibrary(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||!Array.isArray((value as {docs?:unknown}).docs))throw new Error('The book service returned an invalid response.');
  const data=value as {docs:unknown[];numFound?:unknown};
  return {books:data.docs.slice(0,5).filter((row):row is Record<string,unknown>=>!!row&&typeof row==='object').map(row=>({title:typeof row.title==='string'?row.title.slice(0,200):'Untitled',authors:Array.isArray(row.author_name)?row.author_name.filter((a):a is string=>typeof a==='string').slice(0,3).map(a=>a.slice(0,120)):[],firstPublished:typeof row.first_publish_year==='number'?row.first_publish_year:null,url:typeof row.key==='string'&&/^\/works\/OL\d+W$/.test(row.key)?`https://openlibrary.org${row.key}`:null})),total:typeof data.numFound==='number'?data.numFound:0,source:'Open Library'};
}
// This transport never follows redirects, uses a pinned public DNS result, and sends no credentials.
export async function openLibraryRequest(q:string,signal:AbortSignal):Promise<Record<string,unknown>>{
  signal.throwIfAborted();
  let cancelDns:()=>void=()=>{};
  const cancellation=new Promise<never>((_,reject)=>{cancelDns=()=>reject(new Error('Book lookup timed out.'));signal.addEventListener('abort',cancelDns,{once:true});});
  let addresses:string[];try{addresses=await Promise.race([resolve4('openlibrary.org'),cancellation]);}finally{signal.removeEventListener('abort',cancelDns);}
  if(!addresses.length||addresses.some(a=>!isPublicIPv4(a)))throw new Error('The book service did not resolve to a public address.');
  signal.throwIfAborted();
  const url=new URL('https://openlibrary.org/search.json');url.searchParams.set('q',q);url.searchParams.set('limit','5');url.searchParams.set('fields','key,title,author_name,first_publish_year');
  return new Promise((resolve,reject)=>{
    const req=request(url,{method:'GET',signal,lookup:((_hostname:unknown,options:{all?:boolean},callback:Function)=>options.all?callback(null,[{address:addresses[0],family:4}]):callback(null,addresses[0],4)) as never,headers:{Accept:'application/json','User-Agent':'LivingForma/0.1 (https://livingforma.tech)'}},res=>{
      if(res.statusCode!==200||!res.headers['content-type']?.includes('application/json')){res.resume();reject(new Error('The book service is unavailable.'));return;}
      if(Number(res.headers['content-length']??0)>65_536){res.destroy();reject(new Error('Book response exceeds the size limit.'));return;}
      const chunks:Buffer[]=[];let size=0;
      res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>65_536){res.destroy();reject(new Error('Book response exceeds the size limit.'));}else chunks.push(chunk);});
      res.on('error',()=>reject(new Error('The book response was interrupted.')));
      res.on('end',()=>{try{resolve(projectOpenLibrary(JSON.parse(Buffer.concat(chunks).toString('utf8'))));}catch{reject(new Error('The book service returned invalid data.'));}});
    });req.on('error',()=>reject(new Error(signal.aborted?'Book lookup was cancelled or timed out.':'The book service could not be reached.')));req.end();
  });
}
type Transport=(q:string,signal:AbortSignal)=>Promise<Record<string,unknown>>;
export function createToolAdapter(options:{transport?:Transport;now?:()=>number;onPiEvent?:(event:string)=>void}={}):ToolAdapter {
  const transport=options.transport??openLibraryRequest,now=options.now??Date.now;
  const cache=new Map<string,{at:number;value:Record<string,unknown>}>();let lastRequest=-Infinity;
  async function execute(spec:ToolSpec,input:Record<string,unknown>,signal?:AbortSignal){
    validateToolSpec(spec);const {q}=validateToolInput(input);signal?.throwIfAborted();const cached=cache.get(q.toLocaleLowerCase());if(cached&&now()-cached.at<600_000)return structuredClone(cached.value);
    if(now()-lastRequest<1100)throw new Error('Book lookup is limited to one request per second. Please try again shortly.');lastRequest=now();
    const bounded=AbortSignal.any([AbortSignal.timeout(spec.timeoutMs),...(signal?[signal]:[])]);const result=await transport(q,bounded);bounded.throwIfAborted();
    if(JSON.stringify(result).length>16_384)throw new Error('The tool result exceeds the size limit.');if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(q.toLocaleLowerCase(),{at:now(),value:result});return structuredClone(result);
  }
  return {validate:validateToolSpec,test:async(spec,signal)=>{try{await execute(spec,{q:'Pride and Prejudice'},signal);return {ok:true,message:options.transport?'Fixture transport test passed.':'Live Open Library query passed.'};}catch{return {ok:false,message:'The read-only tool test failed. Please try again later.'};}},invoke:async(spec,input,signal)=>{
    validateToolSpec(spec);validateToolInput(input);
    // The host already checked Owner + enabled registry. Reconstruct the handler from the persisted recipe.
    // A deterministic Pi stream schedules this explicit UI tool call without spending model tokens.
    let output:Record<string,unknown>|undefined;
    const tool=registeredPiTool(spec,async args=>{output=await execute(spec,args,signal);return output;});
    const streamFn:StreamFn=()=>{const stream=new AssistantMessageEventStream();const message:AssistantMessage={role:'assistant',content:[{type:'toolCall',id:'explicit-lookup',name:spec.toolId,arguments:validateToolInput(input)}],api:'livingforma-explicit',provider:'local',model:'explicit-tool-call',stopReason:'toolUse',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}};stream.push({type:'done',reason:'toolUse',message});stream.end();return stream;};
    const agent:Agent=new Agent({streamFn,initialState:{tools:[]},prepareRequest:({context})=>({context:{...context,tools:agent.state.tools}}),finishTurn:()=>({action:'end'})});
    agent.state.tools=[tool];agent.subscribe(e=>{if(e.type==='tool_execution_start'||e.type==='tool_execution_end')options.onPiEvent?.(e.type);});
    const abort=()=>agent.abort();signal?.addEventListener('abort',abort,{once:true});try{signal?.throwIfAborted();await agent.prompt('Execute the Owner-authorized, enabled book lookup.');if(!output)throw new Error('The registered Pi tool could not complete the lookup.');return output;}finally{signal?.removeEventListener('abort',abort);}
  }};
}
export function registeredPiTool(spec:ToolSpec,invoke:(input:Record<string,unknown>,signal?:AbortSignal)=>Promise<Record<string,unknown>>):AgentTool<any>{
  validateToolSpec(spec);return {name:spec.toolId,label:spec.name,description:spec.description,parameters:Type.Object({q:Type.String({minLength:1,maxLength:200})},{additionalProperties:false}),execute:async(_id,args,signal)=>({content:[{type:'text',text:JSON.stringify(await invoke(args as Record<string,unknown>,signal))}],details:{endpointId:spec.endpointId,version:spec.toolVersion}})};
}
export const toolAdapter=createToolAdapter();
export async function proposeTool({prompt,registered=[],mode='local',signal}:{prompt:string;registered?:RegisteredTool[];mode?:'local'|'gemini';signal?:AbortSignal}):Promise<ToolProposal>{
  if(prompt.length>4000||!prompt.trim())throw new PlannerError('INVALID_PROMPT','Describe the capability in 1–4,000 characters.');
  signal?.throwIfAborted();let spec:ToolSpec|null=null;
  if(mode==='local'){if(toolIntent(prompt))spec=structuredClone(OPEN_LIBRARY_SPEC);}
  else {let completed=false;await runGeminiTools({prompt,signal,complete:()=>completed,system:`Identify the missing external capability. The only trusted endpoint is openlibrary_search: public read-only book title/author discovery. No purchases, email, arbitrary URLs or other APIs. Call propose_capability with endpointId openlibrary_search only if appropriate, otherwise unsupported. This is a proposal, never consent. Owner must enable after validation. All text English.`,tools:[{name:'propose_capability',label:'Propose safe capability',description:'Choose a trusted endpoint or report unsupported capability.',parameters:Type.Object({endpointId:Type.Union([Type.Literal('openlibrary_search'),Type.Literal('unsupported')])}),execute:async(_id,args)=>{spec=(args as {endpointId:string}).endpointId==='openlibrary_search'?structuredClone(OPEN_LIBRARY_SPEC):null;completed=true;return {content:[{type:'text',text:'Capability proposal prepared; Owner enablement remains required.'}],details:{approved:false}};}}]});}
  const selected=spec as ToolSpec|null;const existing=selected?registered.find(t=>t.spec.endpointId===selected.endpointId&&t.spec.toolVersion===selected.toolVersion):undefined;
  return {spec:existing?validateToolSpec(existing.spec):selected,reused:!!existing,requiresEnable:!!selected&&!existing?.enabled,summary:!selected?'This external capability is not available in the trusted catalog.':existing?.enabled?'The enabled Open Library tool is ready to reuse.':'Enable Open Library book search to make read-only title and author lookups.',source:mode==='gemini'?'gemini':'local-rules'};
}
