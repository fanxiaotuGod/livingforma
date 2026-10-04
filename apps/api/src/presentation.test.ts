import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, type SpaceState } from '@livingforma/db';
import { COMPONENT_MANIFESTS, componentSchema, readingDefinition, toolSpecSchema, validateDefinition, type ComponentSpec, type PresentationRequest, type Snapshot } from '@livingforma/contracts';
import { buildApp } from './app';
import { projection } from './domain';

const origin='http://localhost:5173';
type Context=Awaited<ReturnType<typeof buildApp>>;
let context:Context;
let owner:Record<string,string>;
let participant:Record<string,string>;
let url:string;
const planner=vi.fn(async()=>{throw new Error('Presentation editing must never call a planner.');});

async function login(ctx:Context,persona:'owner'|'participant'){
  const response=await ctx.app.inject({method:'POST',url:'/auth/local',headers:{origin},payload:{persona}});
  expect(response.statusCode,response.body).toBe(200);
  return {origin,cookie:response.headers['set-cookie']!.toString().split(';')[0]!,'x-csrf-token':response.json().csrfToken};
}
async function newSpace(ctx=context){
  const now=new Date().toISOString();
  const state:SpaceState={space:{id:`sp_${randomUUID()}`,slug:`modules-${randomUUID().slice(0,8)}`,title:'Module fixture',timezone:'America/Vancouver',visibility:'public',participation:'authenticated'},ownerId:'user-local-owner',members:[],definition:readingDefinition(),records:[{id:'retained',values:{title:'Retained book',author:'Fixture author'},version:3,createdAt:now,updatedAt:now}],stateVersion:4,eventCursor:0};
  await ctx.store.insertSpace(state);return state;
}
function components():ComponentSpec[]{return [
  componentSchema.parse({id:'table',type:'data-table',version:1,fields:['title','author','progress'],actionIds:['edit'],size:{columns:8,minHeight:360},config:{density:'compact',limit:20}}),
  componentSchema.parse({id:'focus',type:'pomodoro',version:1,size:{columns:4,minHeight:240},config:{durationSeconds:1500,showHeader:false}}),
];}
function input(overrides:Partial<PresentationRequest>={}):PresentationRequest{return {requestId:randomUUID(),baseDefinitionVersion:1,components:components(),layout:'dashboard',...overrides};}
function save(state:SpaceState,payload:Record<string,unknown>,headers=owner,ctx=context){return ctx.app.inject({method:'POST',url:`/api/spaces/${state.space.slug}/presentation`,headers,payload});}
async function snapshot(state:SpaceState,headers=owner,ctx=context){const response=await ctx.app.inject({url:`/api/spaces/${state.space.slug}/snapshot`,headers});expect(response.statusCode,response.body).toBe(200);return response.json<Snapshot>();}

beforeAll(async()=>{
  process.env.ENABLE_LOCAL_DEMO='true';process.env.NODE_ENV='test';
  context=await buildApp({db:await createDatabase(),origin,localDemo:true,planner});
  owner=await login(context,'owner');participant=await login(context,'participant');
  url=await context.app.listen({host:'127.0.0.1',port:0});
},30_000);
afterAll(async()=>{await context?.app.close();delete process.env.ENABLE_LOCAL_DEMO;});

describe('owner module presentation edits',()=>{
  it('saves bounded presentation and publishes a single event without touching records, schema, actions or AI',async()=>{
    const state=await newSpace();const before=await snapshot(state);const payload=input();
    const response=await save(state,payload);expect(response.statusCode,response.body).toBe(200);
    const after=response.json<Snapshot>();
    expect(after.definition!.definitionVersion).toBe(2);
    expect(after.definition!.appSpec.components).toEqual(payload.components);
    expect(after.definition!.appSpec.layout).toBe('dashboard');
    expect(after.definition!.entitySchema).toEqual(before.definition!.entitySchema);
    expect(after.definition!.appSpec.actions).toEqual(before.definition!.appSpec.actions);
    expect(after.records).toEqual(before.records);
    expect(after.stateVersion).toBe(before.stateVersion);
    expect(after.space).toEqual(before.space);
    expect(after.eventCursor).toBe(before.eventCursor+1);
    expect(planner).not.toHaveBeenCalled();
    expect(await snapshot(state)).toEqual(after);
    expect(await context.store.events(state.space.id,0)).toEqual([{id:1,spaceId:state.space.id,type:'definition.published',definitionVersion:2,stateVersion:4}]);
  });

  it('requires session, exact Origin, CSRF and ownership, including for retries',async()=>{
    const state=await newSpace();const payload=input();const before=await snapshot(state);
    for(const [headers,status] of [[{},401],[participant,403],[{...owner,origin:'https://untrusted.example'},403],[{...owner,'x-csrf-token':'wrong'},403],[{cookie:owner.cookie!,'x-csrf-token':owner['x-csrf-token']!},403]] as [Record<string,string>,number][]){
      expect((await save(state,payload,headers)).statusCode).toBe(status);
    }
    expect(await snapshot(state)).toEqual(before);
    expect((await save(state,payload)).statusCode).toBe(200);
    expect((await save(state,payload,participant)).statusCode).toBe(403);
    expect((await save(state,payload,{})).statusCode).toBe(401);
  });

  it('serializes concurrent revisions and refuses stale edits without overwriting the winner',async()=>{
    const state=await newSpace();const first=input();const second=input({components:components().map(c=>({...c,title:'Second layout'}))});
    const responses=await Promise.all([save(state,first),save(state,second)]);
    expect(responses.map(r=>r.statusCode).sort()).toEqual([200,409]);
    const winner=responses.find(r=>r.statusCode===200)!.json<Snapshot>();
    expect(responses.find(r=>r.statusCode===409)!.json().error.code).toBe('DEFINITION_CONFLICT');
    expect(await snapshot(state)).toEqual(winner);
    const stale=await save(state,input());expect(stale.statusCode).toBe(409);
    expect(await snapshot(state)).toEqual(winner);
    expect(await context.store.events(state.space.id,0)).toHaveLength(1);
  });

  it('deduplicates parallel and later retries and rejects different payloads sharing an ID',async()=>{
    const state=await newSpace();const payload=input();
    const responses=await Promise.all([save(state,payload),save(state,payload)]);
    expect(responses.map(r=>r.statusCode)).toEqual([200,200]);
    expect(responses[0]!.json()).toEqual(responses[1]!.json());
    const changed=await save(state,{...payload,layout:'flow'});expect(changed.statusCode).toBe(409);expect(changed.json().error.code).toBe('REQUEST_ID_CONFLICT');
    const next=await save(state,input({baseDefinitionVersion:2,layout:'split'}));expect(next.statusCode,next.body).toBe(200);
    const replayed=await save(state,payload);expect(replayed.statusCode).toBe(200);
    expect(replayed.json()).toEqual(next.json());
    expect(await context.store.events(state.space.id,0)).toHaveLength(2);
  });

  it('rejects unknown bindings, incompatible actions, unbounded sizes/config and forbidden schema changes atomically',async()=>{
    const state=await newSpace();const before=await snapshot(state);const base=input();
    const invalids=[
      {...base,entitySchema:state.definition!.entitySchema},
      {...base,actions:[]},
      {...base,components:[]},
      {...base,components:Array.from({length:25},(_,index)=>({...components()[0]!,id:`c${index}`}))},
      {...base,components:[{...components()[0]!,fields:['missing']}]},
      {...base,components:[{...components()[0]!,actionIds:['add']}]},
      {...base,components:[{...components()[0]!,size:{columns:13}}]},
      {...base,components:[{...components()[0]!,size:{columns:4,minHeight:961}}]},
      {...base,components:[{...components()[0]!,config:{css:'position:fixed'}}]},
      {...base,components:[{...components()[0]!,config:{durationSeconds:10}}]},
      {...base,components:[components()[0]!,components()[0]!]},
    ];
    for(const payload of invalids){const result=await save(state,payload);expect(result.statusCode,result.body).toBe(422);expect(await snapshot(state)).toEqual(before);}
    expect(await context.store.request(context.store.db,state.space.id,state.ownerId,base.requestId)).toBeNull();
    // A rejected attempt consumes neither request ID nor revision.
    expect((await save(state,base)).statusCode).toBe(200);
  });

  it('requires an already enabled tool at the referenced version and never executes or enables it',async()=>{
    const state=await newSpace();const before=await snapshot(state);
    const spec=toolSpecSchema.parse({toolId:'fixture',toolVersion:1,name:'Fixture',description:'No network test tool',endpointId:'fixture',method:'GET',sideEffects:'none',parameters:[],responseMap:{label:'label'},timeoutMs:1000});
    const tool=componentSchema.parse({id:'query',type:'tool-result',version:1,toolRef:{toolId:'fixture',toolVersion:1}});
    const payload=input({components:[...components(),tool]});
    const missing=await save(state,payload);expect(missing.statusCode).toBe(422);expect(missing.json().error.code).toBe('TOOL_NOT_ENABLED');
    await context.store.putTool(state.space.id,{spec,enabled:false,verifiedAt:new Date().toISOString(),invocationCount:0});
    expect((await save(state,payload)).statusCode).toBe(422);expect(await snapshot(state)).toEqual(before);
    await context.store.putTool(state.space.id,{spec,enabled:true,verifiedAt:new Date().toISOString(),invocationCount:0});
    const wrongVersion=input({components:[{...tool,toolRef:{toolId:'fixture',toolVersion:2}}]});expect((await save(state,wrongVersion)).statusCode).toBe(422);
    expect((await save(state,payload)).statusCode).toBe(200);
    expect((await context.store.getTools(state.space.id))[0]!.invocationCount).toBe(0);
    expect((await snapshot(state,{})).definition!.appSpec.components.map(c=>c.id)).not.toContain('query');
  });

  it('preserves layout when omitted and rejects presentation changes to blank or inaccessible spaces',async()=>{
    const state=await newSpace();const payload=input();delete payload.layout;
    const saved=await save(state,payload);expect(saved.statusCode,saved.body).toBe(200);expect(saved.json<Snapshot>().definition!.appSpec.layout).toBe('gallery');
    const blank=await newSpace();blank.definition=null;await context.store.db.transaction(tx=>context.store.saveSpace(blank,tx));
    const empty=await save(blank,input());expect(empty.statusCode).toBe(409);expect(empty.json().error.code).toBe('SPACE_UNCONFIGURED');
    const hidden=await newSpace();hidden.space.visibility='private';hidden.space.participation='members';await context.store.db.transaction(tx=>context.store.saveSpace(hidden,tx));
    expect((await save(hidden,input(),participant)).statusCode).toBe(404);
    expect((await save({...hidden,space:{...hidden.space,slug:'missing-space'}},input())).statusCode).toBe(404);
  });

  it('replays definition.published to another anonymous client without any record data',async()=>{
    const state=await newSpace();expect((await save(state,input())).statusCode).toBe(200);
    const response=await fetch(`${url}/api/spaces/${state.space.slug}/events?after=0`,{signal:AbortSignal.timeout(5000)});
    expect(response.status).toBe(200);const reader=response.body!.getReader();let event='';
    try{while(!event.includes('definition.published')){const next=await reader.read();if(next.done)break;event+=new TextDecoder().decode(next.value);}}finally{await reader.cancel();}
    expect(event).toContain('event: definition.published');expect(event).toContain('"definitionVersion":2');expect(event).not.toContain('Retained book');expect(event).not.toContain('Fixture author');
    expect((await snapshot(state,{})).definition!.appSpec.components[0]!.size).toEqual({columns:8,minHeight:360});
  });

  it('projects private bindings safely for the complete module catalog, retaining valid public presentation',async()=>{
    const state=await newSpace();const schema=state.definition!.entitySchema;
    schema.fields.push({id:'privateText',label:'Private',type:'text',public:false,required:false},{id:'privateNumber',label:'Private number',type:'number',public:false,required:false},{id:'privateEnum',label:'Private enum',type:'enum',options:['Hidden'],public:false,required:false},{id:'privateDate',label:'Private date',type:'date',public:false,required:false});
    state.records[0]!.values.privateText='PRIVATE_VALUE';state.records[0]!.values.privateNumber=999;
    const publicTable=components()[0]!;
    for(const manifest of COMPONENT_MANIFESTS){
      const module=componentSchema.parse({id:'privateModule',type:manifest.id,version:1,fields:['privateText'],...(manifest.bindings.includes('valueField')?{valueField:'privateNumber'}:{}),...(manifest.bindings.includes('groupBy')?{groupBy:'privateEnum'}:{}),...(manifest.bindings.includes('dateField')?{dateField:'privateDate'}:{}),...(manifest.id==='tool-result'?{toolRef:{toolId:'fixture',toolVersion:1}}:{})});
      state.definition!.appSpec.components=[publicTable,module];
      for(const user of [null,{id:'user-local-participant',name:'Participant'}]){
        const result=projection(state,user);expect(result.definition!.appSpec.components.map(c=>c.id),manifest.id).toEqual(['table']);
        expect(JSON.stringify(result),manifest.id).not.toMatch(/PRIVATE_VALUE|privateText|privateNumber|privateEnum|privateDate/);
        expect(()=>validateDefinition(result.definition),manifest.id).not.toThrow();
      }
    }
    // Explicit private metric/category/date bindings never fall back to a public field.
    for(const binding of [{type:'metric-grid',valueField:'privateNumber'},{type:'timeline',dateField:'privateDate'},{type:'tag-cloud',groupBy:'privateEnum'}]){
      state.definition!.appSpec.components=[publicTable,componentSchema.parse({id:'hidden-summary',version:1,fields:['title'],...binding})];
      expect(projection(state,null).definition!.appSpec.components.map(c=>c.id)).toEqual(['table']);
    }
    // Ordinary collections retain their public fields and presentation scalars.
    state.definition!.appSpec.components=[{...publicTable,fields:['title','privateText'],sort:{field:'privateText',direction:'asc'},emphasis:{field:'privateText',equals:'PRIVATE_VALUE',style:'highlight'}}];
    const publicView=projection(state,null);expect(publicView.definition!.appSpec.components[0]).toMatchObject({fields:['title'],size:publicTable.size,config:publicTable.config});
    expect(JSON.stringify(publicView)).not.toMatch(/PRIVATE_VALUE|privateText/);
    expect(projection(state,{id:state.ownerId,name:'Owner'}).records[0]!.values.privateText).toBe('PRIVATE_VALUE');
    // A local tool with no record binding remains useful for the public audience.
    state.definition!.appSpec.components=[components()[1]!];expect(projection(state,null).definition!.appSpec.components).toEqual([components()[1]!]);
  });

  it('restores saved dimensions, configuration, replay and records after a real disk database restart',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'livingforma-presentation-'));let disk:Context|undefined;
    try{
      disk=await buildApp({db:await createDatabase({dataDir:directory}),origin,localDemo:true,planner});
      const headers=await login(disk,'owner');const state=await newSpace(disk);const payload=input();
      const saved=await save(state,payload,headers,disk);expect(saved.statusCode,saved.body).toBe(200);const expected=saved.json<Snapshot>();
      await disk.app.close();disk=undefined;
      disk=await buildApp({db:await createDatabase({dataDir:directory}),origin,localDemo:true,planner});
      expect(await snapshot(state,headers,disk)).toEqual(expected);
      const retried=await save(state,payload,headers,disk);expect(retried.statusCode,retried.body).toBe(200);expect(retried.json()).toEqual(expected);
      expect(await disk.store.events(state.space.id,0)).toHaveLength(1);
      expect(planner).not.toHaveBeenCalled();
    }finally{await disk?.app.close();await rm(directory,{recursive:true,force:true});}
  },30_000);
});
