/** Independent ordinary QA. Real HTTP/PGlite/QuickJS, explicitly offline source generator. */
import {expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildApp} from '../../apps/api/src/app';
import {createDatabase,type SpaceState} from '../../packages/db/src/index';
import {componentSchema,readingDefinition,validateGeneratedTool,type GeneratedToolSpec,type GeneratedToolGenerator} from '../../packages/contracts/src/index';

process.env.NODE_ENV='test';process.env.ENABLE_LOCAL_DEMO='true';
const origin='http://localhost:4348',reportDir='docs/qa/generated-tools';
const directory=await mkdtemp(join(tmpdir(),'lf-qa-tools-'));
type Context=Awaited<ReturnType<typeof buildApp>>;
let context:Context|undefined;
const checks:{name:string;status:'passed';details?:unknown}[]=[];
const spec=(version=1):GeneratedToolSpec=>validateGeneratedTool({
 kind:'code-js-v1',toolId:'serviceQuote',toolVersion:version,name:'Service quote',description:'Compute a bounded service charge with cent rounding.',
 source:`function run(input, api) { return {charge: Math.round((input.amount * input.rate${version===2?' + 0.5':''}) * 100) / 100}; }`,
 inputSchema:{type:'object',properties:{amount:{type:'number',minimum:0,maximum:10000},rate:{type:'number',minimum:0,maximum:1}},required:['amount','rate'],additionalProperties:false},
 outputSchema:{type:'object',properties:{charge:{type:'number',minimum:0}},required:['charge'],additionalProperties:false},sideEffects:'none',capabilities:{publicRecordFields:[],connectors:[]},
 tests:[{name:'Fractional cents',input:{amount:33.33,rate:0.15},expected:{charge:version===1?5:5.5}},{name:'Zero amount',input:{amount:0,rate:0.2},expected:{charge:version===1?0:0.5}}],
});
let generator:GeneratedToolGenerator=async input=>{expect(JSON.stringify(input)).not.toContain('PRIVATE_QA_DEFAULT');return {spec:spec(),reuse:null,source:'gemini',summary:'Offline source fixture.'};};
async function start(){context=await buildApp({db:await createDatabase({dataDir:directory}),origin,localDemo:true,toolCodeGenerator:input=>generator(input)});await context.app.listen({host:'127.0.0.1',port:4348});}
async function call(path:string,method='GET',body?:unknown,headers:Record<string,string>={}){const response=await fetch(`${origin}${path}`,{method,headers:{...headers,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,value:await response.json()};}
async function login(persona='owner'){const response=await fetch(`${origin}/auth/local`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({persona})});expect(response.status).toBe(200);return {origin,cookie:response.headers.get('set-cookie')!.split(';')[0]!,'x-csrf-token':(await response.json()).csrfToken};}
async function check(name:string,run:()=>Promise<unknown>){const details=await run();checks.push({name,status:'passed',...(details?{details}:{})});console.log('PASS',name);}
const slug='qa-generated-tools',prefix=`/api/spaces/${slug}/code-tools`;
const body=(version=1,requestId=randomUUID())=>({requestId,definitionVersion:1,componentId:'qa-site',actionId:version===1?'quote_v1':'quote_v2',toolVersion:version,input:{amount:84.5,rate:0.2}});
try{
 await start();let owner=await login(),participant=await login('participant');
 const definition=readingDefinition();definition.entitySchema.fields.push({id:'private_note',label:'Private note',type:'text',required:false,public:false,defaultValue:'PRIVATE_QA_DEFAULT'});
 definition.appSpec.actions.push({id:'quote_v1',type:'tool.invoke',label:'Quote v1'},{id:'quote_v2',type:'tool.invoke',label:'Quote v2'});
 definition.appSpec.components=[componentSchema.parse({id:'qa-site',type:'generated-site',version:1,fields:['title'],actionIds:['quote_v1','quote_v2'],toolBindings:[{actionId:'quote_v1',toolId:'serviceQuote',toolVersion:1,kind:'generated'},{actionId:'quote_v2',toolId:'serviceQuote',toolVersion:2,kind:'generated'}]})];
 definition.appSpec.generated={format:'html-v1',bridgeVersion:1,html:'<main>Offline QA quote fixture</main>',css:'body{font:16px system-ui}',js:'lf.reportReady();',assetIds:[]};
 const time=new Date().toISOString();const state:SpaceState={space:{id:randomUUID(),slug,title:'QA generated tools',timezone:'UTC',visibility:'public',participation:'authenticated'},ownerId:'user-local-owner',members:[],definition,records:[{id:'qa-kept-record',version:1,values:{title:'Retained business record',private_note:'PRIVATE_QA_RECORD'},createdAt:time,updatedAt:time}],stateVersion:1,eventCursor:0};await context!.store.insertSpace(state);
 await check('Anonymous, Participant, wrong Origin and stale CSRF cannot register a generated tool',async()=>{
  for(const [headers,status]of [[{},401],[participant,403],[{...owner,origin:'https://example.invalid'},403],[{...owner,'x-csrf-token':'invalid'},403]]as const)expect((await call(prefix,'POST',{spec:spec(),enable:true},headers)).status).toBe(status);
  expect((await call(prefix)).status).toBe(401);expect((await call(prefix,'GET',undefined,participant)).status).toBe(403);
 });
 await check('Proposal runs actual guest fixtures but does not register or enable source',async()=>{
  const proposed=await call(`${prefix}/proposals`,'POST',{prompt:'Compute a service charge with cent rounding'},owner);expect(proposed.status).toBe(200);expect(proposed.value.testReport.ok).toBe(true);expect((await call(prefix,'GET',undefined,owner)).value.tools).toEqual([]);
 });
 await check('A wrong expected result fails registration without changing registry or data',async()=>{
  const broken=spec();broken.tests[0].expected={charge:19};expect((await call(prefix,'POST',{spec:broken,enable:true},owner)).status).toBe(422);expect((await call(prefix,'GET',undefined,owner)).value.tools).toEqual([]);expect((await context!.store.getSpace(slug))!.records).toEqual(state.records);
 });
 await check('Explicit Owner registration tests actual source and preserves immutable exact versions',async()=>{
  const registered=await call(prefix,'POST',{spec:spec(),enable:true},owner);expect(registered.status).toBe(200);expect(registered.value.tool.testReport.results.every((r:{ok:boolean})=>r.ok)).toBe(true);expect(registered.value.tool.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
  const changed=spec();changed.source='function run(input,api){return {charge:0}}';expect((await call(prefix,'POST',{spec:changed,enable:true},owner)).status).toBe(409);
 });
 let completed:ReturnType<typeof body>,first:unknown;
 await check('Real QuickJS computes a fresh input; request identity replays without a second execution',async()=>{
  completed=body();const response=await call(`${prefix}/serviceQuote/invoke`,'POST',completed,owner);expect(response.status).toBe(200);expect(response.value).toEqual({toolId:'serviceQuote',toolVersion:1,result:{charge:16.9},reused:false});first=response.value;
  expect((await call(`${prefix}/serviceQuote/invoke`,'POST',completed,owner)).value).toEqual(first);expect((await call(prefix,'GET',undefined,owner)).value.tools[0].invocationCount).toBe(1);
  expect((await call(`${prefix}/serviceQuote/invoke`,'POST',{...completed,input:{amount:90,rate:0.2}},owner)).status).toBe(409);
 });
 await check('Schema, exact binding, current definition and Owner remain authoritative at invocation',async()=>{
  const path=`${prefix}/serviceQuote/invoke`;
  expect((await call(path,'POST',{...body(),input:{amount:-1,rate:0.2}},owner)).status).toBe(422);
  expect((await call(path,'POST',{...body(),definitionVersion:8},owner)).status).toBe(409);
  expect((await call(path,'POST',{...body(),actionId:'unbound'},owner)).status).toBe(403);
  expect((await call(path,'POST',body(),participant)).status).toBe(403);
  expect((await call(path,'POST',body())).status).toBe(401);
  const response=await call(path,'POST',body(),owner);expect(response.status).toBe(200);expect(response.value.reused).toBe(true);
 });
 await check('A new tool version coexists with the old source and each exact binding executes its own logic',async()=>{
  expect((await call(prefix,'POST',{spec:spec(2),enable:true},owner)).status).toBe(200);
  expect((await call(`${prefix}/serviceQuote/invoke`,'POST',body(2),owner)).value.result).toEqual({charge:17.4});
  const tools=(await call(prefix,'GET',undefined,owner)).value.tools;expect(tools.map((t:{spec:GeneratedToolSpec})=>t.spec.toolVersion)).toEqual([1,2]);expect(tools[0].spec.source).toBe(spec().source);
 });
 await check('Manifest discovery reuses an enabled exact version without exposing source, fixtures or private defaults',async()=>{
  generator=async input=>{expect(input.registeredTools).toHaveLength(2);for(const tool of input.registeredTools){expect(tool).not.toHaveProperty('source');expect(tool).not.toHaveProperty('tests');}expect(JSON.stringify(input)).not.toMatch(/PRIVATE_QA_DEFAULT|PRIVATE_QA_RECORD/);return {spec:null,reuse:{toolId:'serviceQuote',toolVersion:1},summary:'Offline reuse fixture.',source:'gemini'};};
  const response=await call(`${prefix}/proposals`,'POST',{prompt:'Reuse the existing service quote'},owner);expect(response.status).toBe(200);expect(response.value.reuse).toEqual({toolId:'serviceQuote',toolVersion:1});
 });
 await check('Ordinary private-field capability request is rejected before guest execution',async()=>{
  const privateTool=spec();privateTool.toolId='privateSummary';privateTool.capabilities.publicRecordFields=['private_note'];expect((await call(prefix,'POST',{spec:privateTool,enable:true},owner)).status).toBe(422);
  const snapshot=await call(`/api/spaces/${slug}/snapshot`);expect(JSON.stringify(snapshot.value)).not.toMatch(/PRIVATE_QA|function run|sourceDigest|toolBindings/);expect((await context!.store.getSpace(slug))!.records).toEqual(state.records);
 });
 await check('Physical database/server restart retains both versions, completed replay and audit count without generation',async()=>{
  const count=(await context!.store.db.query<{count:string}>('SELECT count(*) FROM lf_tool_runs WHERE space_id=$1',[state.space.id])).rows[0].count;
  const interrupted=randomUUID();await context!.store.db.query('INSERT INTO lf_code_tool_requests(space_id,user_id,request_id,data) VALUES($1,$2,$3,$4)',[state.space.id,'user-local-owner',interrupted,JSON.stringify({digest:'qa-interrupted-fixture',status:'pending',startedAt:Date.now()})]);
  await context!.app.close();context=undefined;generator=async()=>{throw new Error('No generator may run during restart recovery.');};await start();
  expect((await call(`${prefix}/serviceQuote/invoke`,'POST',completed!,owner)).value).toEqual(first);expect((await call(prefix,'GET',undefined,owner)).value.tools).toHaveLength(2);
  expect((await context!.store.db.query<{count:string}>('SELECT count(*) FROM lf_tool_runs WHERE space_id=$1',[state.space.id])).rows[0].count).toBe(count);
  const pending=(await context!.store.db.query<{data:{status:string}}>('SELECT data FROM lf_code_tool_requests WHERE request_id=$1',[interrupted])).rows[0].data;expect(pending.status).toBe('failed');expect((await context!.store.getSpace(slug))!.records).toEqual(state.records);
  return {completedAuditRows:Number(count),interruptedReservation:'Explicit crash-state fixture; no automatic rerun'};
 });
 await check('Disabled and logged-out sessions cannot execute cached or new tool requests',async()=>{
  expect((await call(prefix,'POST',{spec:spec(),enable:false},owner)).status).toBe(200);
  expect((await call(`${prefix}/serviceQuote/invoke`,'POST',completed!,owner)).status).toBe(403);expect((await call(`${prefix}/serviceQuote/invoke`,'POST',body(),owner)).status).toBe(403);
  expect((await call('/auth/logout','POST',{},owner)).status).toBe(200);expect((await call(prefix,'GET',undefined,owner)).status).toBe(401);expect((await call(`${prefix}/serviceQuote/invoke`,'POST',body(2),owner)).status).toBe(401);
 });
 await mkdir(reportDir,{recursive:true});await writeFile(`${reportDir}/results.json`,JSON.stringify({at:new Date().toISOString(),scope:'Independent real HTTP, physical PGlite restart and QuickJS execution. Source generation and the inserted interrupted reservation are explicit fixtures; no provider, OAuth/cloud or production evidence.',checks},null,2));
}catch(error){await mkdir(reportDir,{recursive:true});await writeFile(`${reportDir}/failed.json`,JSON.stringify({at:new Date().toISOString(),error:String(error),checks},null,2));throw error}finally{await context?.app.close();await rm(directory,{recursive:true,force:true});}
