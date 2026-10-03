import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDatabase, type Database } from '@livingforma/db';
import { readingDefinition, toolSpecSchema, type ToolAdapter } from '@livingforma/contracts';
import { buildApp, type Planner, type ToolPlanner } from './app';

const origin='http://localhost:5173';
const contexts:Awaited<ReturnType<typeof buildApp>>[]=[];
let database:Database;
const releases:Array<()=>void>=[];
function gate(){let release!:()=>void,entered!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});const started=new Promise<void>(resolve=>{entered=resolve;});releases.push(release);return {release,started,async pause(){entered();await wait;}};}
const spec=toolSpecSchema.parse({toolId:'delayed',toolVersion:1,name:'Delayed fixture',description:'Test only',endpointId:'fixture',method:'GET',sideEffects:'none',parameters:[],responseMap:{title:'title'},timeoutMs:10000});
function proposal(current:ReturnType<typeof readingDefinition>|null){const next=structuredClone(current??readingDefinition());next.appSpec.skin='rose';return {entitySchema:next.entitySchema,appSpec:next.appSpec,summary:'Deferred fixture',source:'local-rules' as const,capabilityGaps:[]};}
async function setup(overrides:{planner?:Planner;toolPlanner?:ToolPlanner;tools?:ToolAdapter}={}){
 process.env.NODE_ENV='test';process.env.ENABLE_LOCAL_DEMO='true';
 const context=await buildApp({db:database,origin,localDemo:true,...overrides});contexts.push(context);
 const login=await context.app.inject({method:'POST',url:'/auth/local',headers:{origin},payload:{persona:'owner'}});
 const headers={origin,cookie:login.headers['set-cookie']!.toString().split(';')[0]!,'x-csrf-token':login.json().csrfToken};
 const post=(url:string,payload?:unknown)=>context.app.inject({method:'POST',url,headers,...(payload?{payload}: {})});
 return {...context,headers,post};
}
// PGlite/WASM initialization is fixture setup, separate from bounded request assertions.
beforeEach(async()=>{database=await createDatabase();},30000);
afterEach(async()=>{for(const release of releases.splice(0))release();const active=contexts.splice(0);for(const context of active)await context.app.close();if(!active.length)await database?.close();delete process.env.ENABLE_LOCAL_DEMO;});

describe('authorization after delayed external work',()=>{
 it.each(['proposal','create','tool-proposal','registration'] as const)('rejects %s completion after logout without publishing or returning private output',async operation=>{
  const pendingGate=gate();
  const planner:Planner=async({current})=>{await pendingGate.pause();return proposal(current);};
  const toolPlanner:ToolPlanner=async()=>{await pendingGate.pause();return {spec,reused:false,requiresEnable:true,summary:'Fixture',source:'local-rules'};};
  const tools:ToolAdapter={validate:input=>toolSpecSchema.parse(input),test:async()=>{await pendingGate.pause();return {ok:true,message:'Fixture'};},invoke:async()=>({title:'Fixture'})};
  const ctx=await setup({planner,toolPlanner,tools});
  const initial=await ctx.store.getSpace('reading');
  const requests={proposal:()=>ctx.post('/api/spaces/reading/proposals',{requestId:randomUUID(),prompt:'Delayed fixture',baseDefinitionVersion:1}),create:()=>ctx.post('/api/spaces',{slug:'delayed-create',title:'Deferred',prompt:'Deferred fixture'}),'tool-proposal':()=>ctx.post('/api/spaces/reading/tool-proposals',{prompt:'Deferred fixture'}),registration:()=>ctx.post('/api/spaces/reading/tools',{spec,enable:true})};
  const pending=requests[operation]().then(response=>response);await pendingGate.started;
  expect((await ctx.post('/auth/logout')).statusCode).toBe(200);pendingGate.release();
  const response=await pending;expect(response.statusCode,response.body).toBe(401);
  expect(response.json()).not.toHaveProperty('snapshot');
  expect(await ctx.store.getSpace('reading')).toEqual(initial);expect(await ctx.store.getSpace('delayed-create')).toBeNull();expect(await ctx.store.getTools(initial!.space.id)).toEqual([]);
 });
 it('rejects an expired session while planning and preserves the last definition',async()=>{
  const pendingGate=gate(),ctx=await setup({planner:async({current})=>{await pendingGate.pause();return proposal(current);}});
  const before=await ctx.store.getSpace('reading');
  const pending=ctx.post('/api/spaces/reading/proposals',{requestId:randomUUID(),prompt:'Deferred fixture',baseDefinitionVersion:1}).then(r=>r);
  await pendingGate.started;await ctx.store.db.query("UPDATE lf_sessions SET expires_at=now()-interval '1 second'");pendingGate.release();
  expect((await pending).statusCode).toBe(401);expect(await ctx.store.getSpace('reading')).toEqual(before);
 });
 it('coalesces concurrent retries, rejects conflicting payloads before external work, and commits one audit/result',async()=>{
  const pendingGate=gate();let calls=0;
  const tools:ToolAdapter={validate:input=>toolSpecSchema.parse(input),test:async()=>({ok:true,message:'Fixture'}),invoke:async()=>{calls++;await pendingGate.pause();return {title:'One response'};}};
  const ctx=await setup({tools});expect((await ctx.post('/api/spaces/reading/tools',{spec,enable:true})).statusCode).toBe(200);
  const body={requestId:randomUUID(),toolVersion:1,input:{}};const url='/api/spaces/reading/tools/delayed/invoke';
  const first=ctx.post(url,body).then(r=>r);await pendingGate.started;
  const second=ctx.post(url,body).then(r=>r);const conflict=await ctx.post(url,{...body,input:{different:true}});
  expect(conflict.statusCode).toBe(409);expect(calls).toBe(1);pendingGate.release();
  const [a,b]=await Promise.all([first,second]);expect(a.statusCode,a.body).toBe(200);expect(b.json()).toEqual(a.json());expect(calls).toBe(1);
  const state=await ctx.store.getSpace('reading');expect((await ctx.store.getTools(state!.space.id))[0]!.invocationCount).toBe(1);
  expect((await ctx.store.db.query('SELECT id FROM lf_tool_runs')).rows).toHaveLength(1);
  expect((await ctx.post(url,body)).json()).toEqual(a.json());expect(calls).toBe(1);
 });
 it('lets logout finish during external GET, then withholds its late result and success audit',async()=>{
  const pendingGate=gate();const tools:ToolAdapter={validate:input=>toolSpecSchema.parse(input),test:async()=>({ok:true,message:'Fixture'}),invoke:async()=>{await pendingGate.pause();return {title:'Private response'};}};
  const ctx=await setup({tools});await ctx.post('/api/spaces/reading/tools',{spec,enable:true});
  const pending=ctx.post('/api/spaces/reading/tools/delayed/invoke',{requestId:randomUUID(),toolVersion:1,input:{}}).then(r=>r);await pendingGate.started;
  // A timeout would expose a transaction held across the external request.
  const logout=await Promise.race([ctx.post('/auth/logout'),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Logout blocked by provider work')),1500))]);
  expect(logout.statusCode).toBe(200);pendingGate.release();const result=await pending;expect(result.statusCode,result.body).toBe(401);expect(result.body).not.toContain('Private response');
  expect((await ctx.store.db.query('SELECT id FROM lf_tool_runs')).rows).toHaveLength(0);
 });
 it('rechecks durable replay when a retry finishes its registry read after the first flight committed',async()=>{
  const external=gate(),lookup=gate();let calls=0,reads=0;
  const tools:ToolAdapter={validate:input=>toolSpecSchema.parse(input),test:async()=>({ok:true,message:'Fixture'}),invoke:async()=>{calls++;await external.pause();return {title:'One result'};}};
  const ctx=await setup({tools});await ctx.post('/api/spaces/reading/tools',{spec,enable:true});
  const readTool=ctx.store.getTool.bind(ctx.store);ctx.store.getTool=async(...args)=>{const result=await readTool(...args);if(args[3]===undefined&&++reads===2)await lookup.pause();return result;};
  const url='/api/spaces/reading/tools/delayed/invoke',body={requestId:randomUUID(),toolVersion:1,input:{}};
  const first=ctx.post(url,body).then(r=>r);await external.started;
  const second=ctx.post(url,body).then(r=>r);await lookup.started;
  external.release();expect((await first).statusCode).toBe(200);lookup.release();expect((await second).statusCode).toBe(200);
  expect(calls).toBe(1);expect((await ctx.store.db.query('SELECT id FROM lf_tool_runs')).rows).toHaveLength(1);
 });
 it('withholds a query if the owner disables the tool before it completes',async()=>{
  const pendingGate=gate();const tools:ToolAdapter={validate:input=>toolSpecSchema.parse(input),test:async()=>({ok:true,message:'Fixture'}),invoke:async()=>{await pendingGate.pause();return {title:'Late response'};}};
  const ctx=await setup({tools});await ctx.post('/api/spaces/reading/tools',{spec,enable:true});
  const pending=ctx.post('/api/spaces/reading/tools/delayed/invoke',{requestId:randomUUID(),toolVersion:1,input:{}}).then(r=>r);await pendingGate.started;
  expect((await ctx.post('/api/spaces/reading/tools',{spec,enable:false})).statusCode).toBe(200);pendingGate.release();expect((await pending).statusCode).toBe(403);
  expect((await ctx.store.db.query('SELECT id FROM lf_tool_runs')).rows).toHaveLength(0);
 });
});
