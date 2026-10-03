import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, Store, type SpaceState } from '@livingforma/db';
import { readingDefinition, habitDefinition, toolSpecSchema, type Proposal, type Snapshot, type ToolAdapter, type RegisteredTool } from '@livingforma/contracts';
import { buildApp, type Planner, type ToolPlanner } from './app';
import { createAuthStore } from './auth-store';
import { timezoneDay } from './domain';

const origin='http://localhost:5173';
let plannerRegistry:RegisteredTool[]=[];
let toolPlannerCalls=0;let toolTests=0;
const proposal:Planner=async({prompt,current,registeredTools=[]})=>{
  plannerRegistry=registeredTools;
  const next=structuredClone(current??readingDefinition());
  if(prompt==='destructive')next.entitySchema.fields=next.entitySchema.fields.filter(field=>field.id!=='author');
  if(prompt==='rating'){next.entitySchema.schemaVersion++;next.entitySchema.fields.push({id:'rating',label:'Rating',type:'number',public:true,required:false,min:0,max:5,defaultValue:0});next.appSpec.components[0]!.sort={field:'rating',direction:'desc'};}
  if(prompt==='tool'){next.appSpec.components.push({id:'query',type:'tool-result',version:1,variant:'default',fields:[],actionIds:[],span:'full',toolRef:{toolId:'fixture',toolVersion:1}});}
  if(prompt==='approve-fixture'){
    const enabled=registeredTools.find(tool=>tool.spec.toolId==='fixture'&&tool.enabled);
    if(!enabled)return {entitySchema:next.entitySchema,appSpec:next.appSpec,summary:'Enable the fixture tool to continue.',source:'local-rules',capabilityGaps:['Owner approval required'],toolProposals:[fixtureTool]};
    next.appSpec.components.push({id:'query',type:'tool-result',version:1,variant:'default',fields:[],actionIds:[],span:'full',toolRef:{toolId:'fixture',toolVersion:1}});
  }
  return {entitySchema:next.entitySchema,appSpec:next.appSpec,summary:prompt,source:'local-rules',capabilityGaps:prompt==='unsupported'?['This capability is not available.']:[]} satisfies Proposal;
};
const fixtureTool=toolSpecSchema.parse({toolId:'fixture',toolVersion:1,name:'Fixture query',description:'Explicitly a test endpoint',endpointId:'fixture',method:'GET',sideEffects:'none',parameters:[],responseMap:{title:'title'},timeoutMs:1000});
let calls=0;
const adapter:ToolAdapter={validate:input=>toolSpecSchema.parse(input),test:async(spec)=>{toolTests++;return {ok:spec.name!=='Failing fixture',message:'Fixture checked'};},invoke:async()=>{calls++;return {title:'Fixture result'};}};
const toolPlanner:ToolPlanner=async()=>{toolPlannerCalls++;return {spec:fixtureTool,reused:false,requiresEnable:true,summary:'Fixture proposal for an explicit test endpoint.',source:'local-rules'};};
let context:Awaited<ReturnType<typeof buildApp>>;
let owner:Record<string,string>;let participant:Record<string,string>;let url:string;
async function newSpace(kind:'reading'|'habits'='reading',privateField=false){
  const definition=kind==='reading'?readingDefinition():habitDefinition();if(privateField)definition.entitySchema.fields.push({id:'secret',label:'Secret field',type:'text',required:false,public:false});
  const slug=`test-${randomUUID().slice(0,8)}`;const state:SpaceState={space:{id:`sp_${randomUUID()}`,slug,title:'Test',timezone:'America/Vancouver',visibility:'public',participation:'authenticated'},ownerId:'user-local-owner',members:[],definition,records:[],stateVersion:0,eventCursor:0};await context.store.insertSpace(state);return state;
}
async function mutation(slug:string,headers:Record<string,string>,input:Record<string,unknown>){return context.app.inject({method:'POST',url:`/api/spaces/${slug}/actions`,headers,payload:{requestId:randomUUID(),definitionVersion:1,actionId:'add',...input}});}
async function publish(slug:string,prompt:string,headers=owner,baseDefinitionVersion=1){return context.app.inject({method:'POST',url:`/api/spaces/${slug}/proposals`,headers,payload:{requestId:randomUUID(),baseDefinitionVersion,prompt}});}
async function snapshot(slug:string,headers:Record<string,string>={}){return (await context.app.inject({url:`/api/spaces/${slug}/snapshot`,headers})).json<Snapshot>();}
async function readUntil(reader:ReadableStreamDefaultReader<Uint8Array>,needle:string){let text='';while(!text.includes(needle)){const chunk=await reader.read();if(chunk.done)break;text+=new TextDecoder().decode(chunk.value);}return text;}

beforeAll(async()=>{
  process.env.ENABLE_LOCAL_DEMO='true';process.env.NODE_ENV='test';
  context=await buildApp({db:await createDatabase(),origin,localDemo:true,planner:proposal,toolPlanner,tools:adapter});
  const login=async(persona:'owner'|'participant')=>{const response=await context.app.inject({method:'POST',url:'/auth/local',headers:{origin},payload:{persona}});expect(response.statusCode,response.body).toBe(200);return {origin,cookie:response.headers['set-cookie']!.toString().split(';')[0]!,'x-csrf-token':response.json().csrfToken};};
  owner=await login('owner');participant=await login('participant');url=await context.app.listen({host:'127.0.0.1',port:0});
},30_000);
afterAll(async()=>{await context?.app.close();delete process.env.ENABLE_LOCAL_DEMO;});

describe('persistent application API',()=>{
  it('requires a session, Origin, CSRF and owner role at the server',async()=>{
    const state=await newSpace();expect((await mutation(state.space.slug,{}, {values:{title:'Denied'}})).statusCode).toBe(401);
    expect((await mutation(state.space.slug,{...owner,origin:'https://attacker.example'},{values:{title:'Denied'}})).statusCode).toBe(403);
    expect((await mutation(state.space.slug,{...owner,'x-csrf-token':'wrong'},{values:{title:'Denied'}})).statusCode).toBe(403);
    expect((await publish(state.space.slug,'rating',participant)).statusCode).toBe(403);
    expect((await mutation(state.space.slug,participant,{values:{title:'Participant book'}})).statusCode).toBe(200);
    expect((await snapshot(state.space.slug)).permissions.actionIds).toEqual([]);
  });
  it('projects private schema, values and bindings away from anonymous readers and participants',async()=>{
    const state=await newSpace('reading',true);state.definition!.appSpec.components[0]!.fields.push('secret');state.definition!.appSpec.components[0]!.sort={field:'secret',direction:'asc'};await context.store.db.transaction(tx=>context.store.saveSpace(state,tx));
    expect((await mutation(state.space.slug,owner,{values:{title:'Public title',secret:'PRIVATE_TOKEN'}})).statusCode).toBe(200);
    const publicView=await snapshot(state.space.slug);expect(JSON.stringify(publicView)).not.toContain('PRIVATE_TOKEN');expect(JSON.stringify(publicView)).not.toContain('secret');
    expect((await snapshot(state.space.slug,owner)).records[0]!.values.secret).toBe('PRIVATE_TOKEN');
    expect((await mutation(state.space.slug,participant,{values:{title:'Hidden',secret:'attack'}})).statusCode).toBe(403);
  });
  it('returns an explicit empty public view when every field or component is private',async()=>{
    const state=await newSpace();await mutation(state.space.slug,owner,{values:{title:'Owner-only title'}});
    const stored=(await context.store.getSpace(state.space.slug))!;stored.definition!.entitySchema.fields.forEach(field=>{field.public=false;});await context.store.db.transaction(tx=>context.store.saveSpace(stored,tx));
    for(const headers of [{},participant]){const projected=await snapshot(state.space.slug,headers);expect(projected.definition).toBeNull();expect(projected.phase).toBe('unconfigured');expect(projected.records).toEqual([]);expect(projected.permissions.canWrite).toBe(false);expect(projected.permissions.actionIds).toEqual([]);expect(projected.loginRequiredForWrite).toBe(false);}
    const ownerView=await snapshot(state.space.slug,owner);expect(ownerView.definition!.entitySchema.fields.length).toBeGreaterThan(0);expect(ownerView.records[0]!.values.title).toBe('Owner-only title');
    expect((await mutation(state.space.slug,participant,{values:{title:'Denied'}})).statusCode).toBe(403);
    // Fields may be public while the only presentation is an Owner-only external tool.
    stored.definition!.entitySchema.fields[0]!.public=true;stored.definition!.appSpec.components=[{id:'private-tool',type:'tool-result',version:1,variant:'default',fields:[],actionIds:[],span:'full',toolRef:{toolId:'fixture',toolVersion:1}}];await context.store.db.transaction(tx=>context.store.saveSpace(stored,tx));expect((await snapshot(state.space.slug)).definition).toBeNull();
  });
  it('retries one request once and rejects request ID reuse for a different mutation',async()=>{
    const state=await newSpace();const requestId=randomUUID();const payload={requestId,values:{title:'One book'}};
    const [first,second]=await Promise.all([mutation(state.space.slug,owner,payload),mutation(state.space.slug,owner,payload)]);
    expect(first.statusCode,first.body).toBe(200);expect(second.statusCode,second.body).toBe(200);const current=await snapshot(state.space.slug);expect(current.records).toHaveLength(1);expect(current.stateVersion).toBe(1);expect(current.eventCursor).toBe(1);
    expect((await mutation(state.space.slug,owner,{requestId,values:{title:'Different'}})).statusCode).toBe(409);
  });
  it('serializes concurrent record writes and preserves the winning version',async()=>{
    const state=await newSpace();const created=(await mutation(state.space.slug,owner,{values:{title:'Original'}})).json<Snapshot>().records[0]!;
    const write=(title:string)=>mutation(state.space.slug,owner,{actionId:'edit',recordId:created.id,recordVersion:1,values:{title}});
    const responses=await Promise.all([write('First'),write('Second')]);expect(responses.map(response=>response.statusCode).sort()).toEqual([200,409]);expect((await snapshot(state.space.slug)).records[0]!.version).toBe(2);
  });
  it('evolves fields without losing records and rolls invalid publication back atomically',async()=>{
    const state=await newSpace();await mutation(state.space.slug,owner,{values:{title:'Retained',author:'Author'}});
    const before=await snapshot(state.space.slug,owner);const published=await publish(state.space.slug,'rating');expect(published.statusCode,published.body).toBe(200);
    const after=await snapshot(state.space.slug,owner);expect(after.space.slug).toBe(before.space.slug);expect(after.definition!.definitionVersion).toBe(2);expect(after.records[0]!.values).toMatchObject({title:'Retained',author:'Author',rating:0});
    expect((await publish(state.space.slug,'destructive',owner,2)).statusCode).toBe(422);expect(await snapshot(state.space.slug,owner)).toEqual(after);
    expect((await mutation(state.space.slug,owner,{values:{title:'Stale definition'}})).statusCode).toBe(409);
  });
  it('check-in toggles the space-local day and an idempotent retry does not toggle twice',async()=>{
    const state=await newSpace('habits');const record=(await mutation(state.space.slug,owner,{values:{title:'Read'}})).json<Snapshot>().records[0]!;
    const payload={requestId:randomUUID(),actionId:'checkin',recordId:record.id,recordVersion:1};
    await mutation(state.space.slug,owner,payload);await mutation(state.space.slug,owner,payload);
    expect((await snapshot(state.space.slug)).records[0]!.values.dates).toEqual([timezoneDay('America/Vancouver')]);
    await mutation(state.space.slug,owner,{actionId:'checkin',recordId:record.id,recordVersion:2});expect((await snapshot(state.space.slug)).records[0]!.values.dates).toEqual([]);
  });
  it('hides private spaces and refuses nonmember writing policies',async()=>{
    const state=await newSpace();state.space.visibility='private';state.space.participation='members';await context.store.db.transaction(tx=>context.store.saveSpace(state,tx));
    expect((await context.app.inject({url:`/api/spaces/${state.space.slug}/snapshot`})).statusCode).toBe(404);
    expect((await mutation(state.space.slug,participant,{values:{title:'Denied'}})).statusCode).toBe(404);
    const listing=(await context.app.inject({url:'/api/spaces'})).json();expect(listing.spaces.map((space:{slug:string})=>space.slug)).not.toContain(state.space.slug);
  });
  it('maps verified Google subjects to stable internal users without conflating email',async()=>{
    const authStore=createAuthStore(context.store);const first=await authStore.resolveIdentity({provider:'google',subject:'subject-one',name:'One',email:'same@example.com'});
    const again=await authStore.resolveIdentity({provider:'google',subject:'subject-one',name:'Updated'});const other=await authStore.resolveIdentity({provider:'google',subject:'subject-two',name:'Two',email:'same@example.com'});
    expect(again.id).toBe(first.id);expect(again.name).toBe('Updated');expect(other.id).not.toBe(first.id);
    await authStore.saveOAuthTransaction({stateHash:'fixture-hash',verifier:'verifier',nonce:'nonce',returnTo:'/',expiresAt:new Date(Date.now()+10000).toISOString()});
    const consumed=await Promise.all([authStore.consumeOAuthTransaction('fixture-hash'),authStore.consumeOAuthTransaction('fixture-hash')]);expect(consumed.filter(Boolean)).toHaveLength(1);
  });
  it('persists a tested tool version, enforces owner enablement, and reuses invocations',async()=>{
    const state=await newSpace();expect((await publish(state.space.slug,'tool')).statusCode).toBe(422);
    const register=(headers:Record<string,string>,enable:boolean)=>context.app.inject({method:'POST',url:`/api/spaces/${state.space.slug}/tools`,headers,payload:{spec:fixtureTool,enable}});
    expect((await register(participant,true)).statusCode).toBe(403);expect((await register(owner,false)).statusCode).toBe(200);
    const requestId=randomUUID();const invoke=(id=requestId)=>context.app.inject({method:'POST',url:`/api/spaces/${state.space.slug}/tools/fixture/invoke`,headers:owner,payload:{toolVersion:1,input:{},requestId:id}});
    expect((await invoke()).statusCode).toBe(403);expect((await register(owner,true)).statusCode).toBe(200);expect((await publish(state.space.slug,'tool')).statusCode).toBe(200);
    const before=calls;expect((await invoke()).json().reused).toBe(false);await invoke();expect(calls-before).toBe(1);expect((await invoke(randomUUID())).json().reused).toBe(true);
    expect((await context.store.getTools(state.space.id))[0]!.invocationCount).toBe(2);
  });
  it('replays the snapshot/subscribe gap and sends reset.required for future cursors',async()=>{
    const state=await newSpace();const before=await snapshot(state.space.slug);await mutation(state.space.slug,owner,{values:{title:'Between snapshot and stream'}});
    const response=await fetch(`${url}/api/spaces/${state.space.slug}/events?after=${before.eventCursor}`,{signal:AbortSignal.timeout(5000)});const reader=response.body!.getReader();const events=await readUntil(reader,'records.changed');expect(events).toContain('id: 1');expect(events).not.toContain('Between snapshot');await reader.cancel();
    const future=await fetch(`${url}/api/spaces/${state.space.slug}/events?after=999`,{signal:AbortSignal.timeout(5000)});expect(await future.text()).toContain('event: reset.required');
  });
  it('keeps pending tool proposals unpublished and permits the same request after explicit enablement',async()=>{
    const state=await newSpace();await mutation(state.space.slug,owner,{values:{title:'Keep me'}});const before=await snapshot(state.space.slug,owner);
    const requestId=randomUUID();const request=()=>context.app.inject({method:'POST',url:`/api/spaces/${state.space.slug}/proposals`,headers:owner,payload:{requestId,prompt:'approve-fixture',baseDefinitionVersion:1}});
    const testsBefore=toolTests;const callsBefore=calls;
    const pending=await request();expect(pending.statusCode,pending.body).toBe(200);expect(pending.json().requiresToolApproval).toBe(true);expect(pending.json().snapshot).toEqual(before);expect(await context.store.getTools(state.space.id)).toEqual([]);expect(calls).toBe(callsBefore);expect(toolTests).toBe(testsBefore);
    expect((await request()).json().requiresToolApproval).toBe(true);expect(await context.store.request(context.store.db,state.space.id,'user-local-owner',requestId)).toBeNull();
    await context.app.inject({method:'POST',url:`/api/spaces/${state.space.slug}/tools`,headers:owner,payload:{spec:fixtureTool,enable:false}});
    expect((await request()).json().requiresToolApproval).toBe(true);expect(plannerRegistry).toEqual([]);
    await context.app.inject({method:'POST',url:`/api/spaces/${state.space.slug}/tools`,headers:owner,payload:{spec:fixtureTool,enable:true}});
    const published=await request();expect(published.statusCode,published.body).toBe(200);expect(published.json().requiresToolApproval).toBeUndefined();expect(published.json().snapshot.definition.definitionVersion).toBe(2);expect(published.json().snapshot.records).toEqual(before.records);expect(plannerRegistry).toHaveLength(1);expect((await request()).json().snapshot.definition.definitionVersion).toBe(2);
  });
  it('requires Owner and CSRF to propose a tool without granting enablement',async()=>{
    const state=await newSpace();const propose=(headers:Record<string,string>)=>context.app.inject({method:'POST',url:`/api/spaces/${state.space.slug}/tool-proposals`,headers,payload:{prompt:'Find a book'}});
    const before=toolPlannerCalls;expect((await propose({})).statusCode).toBe(401);expect((await propose(participant)).statusCode).toBe(403);expect((await propose({...owner,'x-csrf-token':'wrong'})).statusCode).toBe(403);expect(toolPlannerCalls).toBe(before);
    const response=await propose(owner);expect(response.statusCode,response.body).toBe(200);expect(response.json().requiresEnable).toBe(true);expect(await context.store.getTools(state.space.id)).toEqual([]);expect((await snapshot(state.space.slug,owner)).definition!.definitionVersion).toBe(1);
  });
  it('leaves the app and registry unchanged on failed enablement and reports unsupported no-op requests',async()=>{
    const state=await newSpace();const before=await snapshot(state.space.slug,owner);
    const failed=await context.app.inject({method:'POST',url:`/api/spaces/${state.space.slug}/tools`,headers:owner,payload:{spec:{...fixtureTool,name:'Failing fixture'},enable:true}});expect(failed.statusCode).toBe(422);expect(await context.store.getTools(state.space.id)).toEqual([]);expect(await snapshot(state.space.slug,owner)).toEqual(before);
    const unsupported=await publish(state.space.slug,'unsupported');expect(unsupported.statusCode).toBe(422);expect(unsupported.json().error.code).toBe('CAPABILITY_UNAVAILABLE');expect(await snapshot(state.space.slug,owner)).toEqual(before);
  });
  it('detects an interior replay gap rather than silently skipping a missing event',async()=>{
    const state=await newSpace();for(let i=0;i<3;i++)await mutation(state.space.slug,owner,{values:{title:`Event ${i}`}});
    await context.store.db.query('DELETE FROM lf_events WHERE space_id=$1 AND cursor=2',[state.space.id]);
    const response=await fetch(`${url}/api/spaces/${state.space.slug}/events?after=0`,{signal:AbortSignal.timeout(5000)});const data=await response.text();expect(data).toContain('id: 1');expect(data).toContain('event: reset.required');expect(data).not.toContain('id: 3');
  });
  it('restores records, event log, registry and session after a real disk database restart',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'livingforma-db-'));
    try{
      const db=await createDatabase({dataDir:directory});const store=new Store(db);const state=await newSpace();state.space.id=`restart-${randomUUID()}`;state.space.slug='restart';state.records=[{id:'record-persisted',values:{title:'Persistent'},version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];
      await store.db.transaction(async tx=>{await store.insertSpace(state,tx);await store.event(state,'records.changed',tx);});await store.putTool(state.space.id,{spec:fixtureTool,enabled:true,verifiedAt:new Date().toISOString(),invocationCount:2});
      const authStore=createAuthStore(store);const user=await authStore.resolveIdentity({provider:'google',subject:'restart-subject',name:'Persistent user'});await authStore.createSession({tokenHash:'hash',userId:user.id,csrfToken:'csrf',expiresAt:new Date(Date.now()+60000).toISOString()});await db.close();
      const reopened=await createDatabase({dataDir:directory});const reloaded=new Store(reopened);expect((await reloaded.getSpace('restart'))!.records[0]!.values.title).toBe('Persistent');expect((await reloaded.events(state.space.id,0))[0]!.id).toBe(1);expect((await reloaded.getTools(state.space.id))[0]!.invocationCount).toBe(2);expect((await createAuthStore(reloaded).getSession('hash'))!.user.id).toBe(user.id);await reopened.close();
    }finally{await rm(directory,{recursive:true,force:true});}
  },30_000);
});
