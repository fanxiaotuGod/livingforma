import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, type SpaceState } from '@livingforma/db';
import { componentSchema, readingDefinition, type GenerationJob, type Proposal, type SiteGenerator } from '@livingforma/contracts';
import { buildApp } from './app';
import { validateRaster } from './assets';

const origin='http://localhost:5173';
type Context=Awaited<ReturnType<typeof buildApp>>;
let ctx:Context,owner:Record<string,string>,participant:Record<string,string>;
let generator:SiteGenerator=async()=>{throw new Error('No fixture configured.');};
let clientNumber=10;
const calls=vi.fn<SiteGenerator>(input=>generator(input));
const fixture=(current=readingDefinition()):Proposal=>({entitySchema:current.entitySchema,appSpec:{...current.appSpec,components:[componentSchema.parse({id:'site',type:'generated-site',version:1,fields:current.entitySchema.fields.filter(f=>f.public).map(f=>f.id),actionIds:current.appSpec.actions.filter(a=>a.type!=='tool.invoke').map(a=>a.id)})],generated:{format:'html-v1',bridgeVersion:1,html:'<main><h1>Fixture website</h1><button id="count">Count</button></main>',css:'body { font-family: system-ui; }',js:'let count=0; document.getElementById("count").onclick=()=>{document.getElementById("count").textContent=String(++count)}; lf.reportReady();',assetIds:[]}},summary:'Generated a fixture website.',capabilityGaps:[],source:'gemini'});
async function login(context=ctx,persona:'owner'|'participant'='owner'){
  const r=await context.app.inject({method:'POST',url:'/auth/local',headers:{origin},payload:{persona}});expect(r.statusCode,r.body).toBe(200);
  return {origin,cookie:r.headers['set-cookie']!.toString().split(';')[0]!,'x-csrf-token':r.json().csrfToken};
}
async function space(context=ctx){
  const definition=readingDefinition();definition.entitySchema.fields.push({id:'private_note',label:'Private note',type:'text',required:false,public:false,defaultValue:'PRIVATE_DEFAULT_SENTINEL'});
  const time=new Date().toISOString(),state:SpaceState={space:{id:`sp_${randomUUID()}`,slug:`generated-${randomUUID().slice(0,8)}`,title:'Generated fixture',timezone:'America/Vancouver',visibility:'public',participation:'authenticated'},ownerId:'user-local-owner',members:[],definition,records:[{id:'kept-record',values:{title:'A retained book',author:'Fixture author',private_note:'PRIVATE_RECORD_SENTINEL'},version:2,createdAt:time,updatedAt:time}],stateVersion:3,eventCursor:0};
  await context.store.db.transaction(async tx=>{await context.store.insertSpace(state,tx);await context.store.event(state,'definition.published',tx);});return state;
}
const endpoint=(state:SpaceState,id?:string)=>`/api/spaces/${state.space.slug}/generations${id?`/${id}`:''}`;
async function start(state:SpaceState,context=ctx,headers=owner,requestId=randomUUID()){
  const response=await context.app.inject({method:'POST',url:endpoint(state),remoteAddress:`127.0.0.${++clientNumber}`,headers,payload:{prompt:'Create an interactive custom reading website.',baseDefinitionVersion:state.definition?.definitionVersion??0,requestId}});expect(response.statusCode,response.body).toBe(202);return response.json<GenerationJob>();
}
async function waitFor(state:SpaceState,id:string,stages:string[],context=ctx,headers=owner){
  let job:GenerationJob|undefined;await vi.waitFor(async()=>{const r=await context.app.inject({url:endpoint(state,id),headers});expect(r.statusCode,r.body).toBe(200);job=r.json();expect(stages).toContain(job!.stage);},{timeout:5000,interval:20});return job!;
}
async function report(state:SpaceState,job:GenerationJob,ok=true,context=ctx,headers=owner){return context.app.inject({method:'POST',url:`${endpoint(state,job.id)}/preview`,headers,payload:{sourceRevision:job.sourceRevision,ok,errors:ok?[]:['The Count button throws a TypeError.']}});}
async function publish(state:SpaceState,job:GenerationJob,context=ctx,headers=owner,requestId=randomUUID()){return context.app.inject({method:'POST',url:`${endpoint(state,job.id)}/publish`,headers,payload:{sourceRevision:job.sourceRevision,requestId}});}
beforeAll(async()=>{process.env.ENABLE_LOCAL_DEMO='true';process.env.NODE_ENV='test';ctx=await buildApp({db:await createDatabase(),origin,localDemo:true,siteGenerator:calls});owner=await login();participant=await login(ctx,'participant');},30000);
afterAll(async()=>{await ctx?.app.close();});

describe('durable isolated generation (offline fixtures)',()=>{
  it('replays the same job, protects drafts, and atomically publishes checked source with history and retained records',async()=>{
    const state=await space();generator=async input=>{expect(JSON.stringify(input)).not.toContain('PRIVATE_RECORD_SENTINEL');expect(JSON.stringify(input)).not.toContain('PRIVATE_DEFAULT_SENTINEL');input.onProgress?.({stage:'writing',message:'untrusted provider commentary',source:{html:'<p>Source checkpoint</p>'}});return fixture(input.current!);};
    const before=calls.mock.calls.length,job=await start(state);let candidate=await waitFor(state,job.id,['preview']);
    expect(candidate.events.map(e=>e.sequence)).toEqual(candidate.events.map((_,i)=>i+1));expect(JSON.stringify(candidate.events)).not.toContain('untrusted provider commentary');
    const duplicate=await ctx.app.inject({method:'POST',url:endpoint(state),headers:owner,payload:{prompt:job.prompt,baseDefinitionVersion:1,requestId:job.requestId}});expect(duplicate.statusCode).toBe(200);expect(duplicate.json().id).toBe(job.id);expect(calls.mock.calls.length-before).toBe(1);
    expect((await ctx.store.getSpace(state.space.slug))!.definition!.definitionVersion).toBe(1);
    expect((await publish(state,candidate)).statusCode).toBe(409);
    const preview=await ctx.app.inject({url:`/api/generated-frame?space=${state.space.slug}&generation=${job.id}&revision=1&channel=0123456789abcdef`,headers:owner});expect(preview.statusCode,preview.body).toBe(200);
    expect(preview.headers['content-security-policy']).toContain("sandbox allow-scripts");expect(preview.headers['content-security-policy']).not.toContain('nonce');expect(preview.headers['content-security-policy']).toContain("script-src 'unsafe-inline'");expect(preview.headers['x-frame-options']).toBeUndefined();expect(preview.body).not.toContain('PRIVATE_RECORD_SENTINEL');expect(preview.body).toContain('lf:connect');
    expect((await ctx.app.inject({url:`/api/generated-frame?space=${state.space.slug}&generation=${job.id}&revision=1&channel=0123456789abcdef`})).statusCode).toBe(401);
    expect((await ctx.app.inject({url:`/api/generated-frame?space=${state.space.slug}&version=2&channel=0123456789abcdef`})).statusCode).toBe(404);
    const checked=await report(state,candidate);expect(checked.statusCode,checked.body).toBe(200);candidate=checked.json();const id=randomUUID();
    const published=await publish(state,candidate,ctx,owner,id);expect(published.statusCode,published.body).toBe(200);expect(published.json().job.stage).toBe('published');expect(published.json().snapshot.definition.definitionVersion).toBe(2);
    const after=(await ctx.store.getSpace(state.space.slug))!;expect(after.records[0]!.id).toBe('kept-record');expect(after.records[0]!.values.private_note).toBe('PRIVATE_RECORD_SENTINEL');expect(after.definition!.entitySchema.fields.find(field=>field.id==='private_note')!.defaultValue).toBe('PRIVATE_DEFAULT_SENTINEL');
    expect((await publish(state,candidate,ctx,owner,id)).statusCode).toBe(200);expect((await ctx.store.getSpace(state.space.slug))!.eventCursor).toBe(after.eventCursor);
    const versions=await ctx.app.inject({url:`/api/spaces/${state.space.slug}/versions`,headers:owner});expect(versions.json().versions.map((v:{definitionVersion:number})=>v.definitionVersion)).toEqual([2,1]);
    const publicFrame=await ctx.app.inject({url:`/api/generated-frame?space=${state.space.slug}&version=2&channel=0123456789abcdef`});expect(publicFrame.statusCode).toBe(200);expect(publicFrame.body).not.toContain('PRIVATE_RECORD_SENTINEL');
    const page=await ctx.app.inject({url:'/api/health'});expect(page.headers['content-security-policy']).toContain('frame-src http://localhost:5173/api/generated-frame;');
  });
  it('rejects roles, wrong CSRF/origin, stale bases and conflicting generation request IDs',async()=>{
    const state=await space();generator=async input=>fixture(input.current!);
    const payload={prompt:'A custom site',baseDefinitionVersion:1,requestId:randomUUID()};
    for(const [headers,code] of [[{},401],[participant,403],[{...owner,origin:'https://other.example'},403],[{...owner,'x-csrf-token':'invalid'},403]] as const){const r=await ctx.app.inject({method:'POST',url:endpoint(state),remoteAddress:`127.0.0.${++clientNumber}`,headers,payload});expect(r.statusCode,r.body).toBe(code);}
    expect((await ctx.app.inject({method:'POST',url:endpoint(state),headers:owner,payload:{...payload,baseDefinitionVersion:8}})).statusCode).toBe(409);
    const job=await start(state);await waitFor(state,job.id,['preview']);const conflict=await ctx.app.inject({method:'POST',url:endpoint(state),headers:owner,payload:{...payload,requestId:job.requestId}});expect(conflict.statusCode).toBe(409);
    expect((await ctx.app.inject({url:endpoint(state,job.id),headers:participant})).statusCode).toBe(403);
    expect((await ctx.app.inject({url:`/api/spaces/${state.space.slug}/versions`,headers:participant})).statusCode).toBe(403);
  });
  it('repairs one browser failure, binds reports to the exact source and rejects a second failure',async()=>{
    const state=await space();let attempt=0;generator=async input=>{attempt++;if(attempt===2)expect(input.repair?.errors).toEqual(['The Count button throws a TypeError.']);return fixture(input.current!);};
    const job=await start(state),first=await waitFor(state,job.id,['preview']);expect((await report(state,first,false)).statusCode).toBe(200);
    const repaired=await waitFor(state,job.id,['preview']);expect(repaired.sourceRevision).toBe(2);expect(repaired.repairCount).toBe(1);
    expect((await report(state,first)).statusCode).toBe(409);const failed=await report(state,repaired,false);expect(failed.json().stage).toBe('failed');expect(attempt).toBe(2);expect((await ctx.store.getSpace(state.space.slug))!.definition!.definitionVersion).toBe(1);
  });
  it('repairs a static source failure once without ever serving the invalid candidate',async()=>{
    const state=await space();let attempts=0;generator=async input=>{const proposal=fixture(input.current!);if(++attempts===1)proposal.appSpec.generated!.js='const = invalid';else expect(input.repair?.errors[0]).toContain('JavaScript syntax');return proposal;};
    const job=await start(state),candidate=await waitFor(state,job.id,['preview']);expect(candidate.repairCount).toBe(1);expect(candidate.sourceRevision).toBe(2);expect(attempts).toBe(2);
  });
  it('reserves concurrent request IDs once and keeps earlier published sources immutable during evolution',async()=>{
    const state=await space();let entered=0,resolve!:(p:Proposal)=>void;generator=async()=>{entered++;return new Promise(r=>{resolve=r;});};const payload={prompt:'Create a custom interactive site.',baseDefinitionVersion:1,requestId:randomUUID()};
    const requests=await Promise.all([1,2].map(()=>ctx.app.inject({method:'POST',url:endpoint(state),remoteAddress:'127.0.0.200',headers:owner,payload})));expect(requests.map(r=>r.statusCode).sort()).toEqual([200,202]);expect(requests[0]!.json().id).toBe(requests[1]!.json().id);await vi.waitFor(()=>expect(entered).toBe(1));resolve(fixture(state.definition!));
    const first=await waitFor(state,requests[0]!.json().id,['preview']);await report(state,first);expect((await publish(state,first)).statusCode).toBe(200);
    const previous=(await ctx.store.getSpace(state.space.slug))!;generator=async input=>{const next=fixture(input.current!);next.appSpec.generated!.html='<main>Revised custom website</main>';return next;};const second=await start(previous),candidate=await waitFor(previous,second.id,['preview']);await report(previous,candidate);expect((await publish(previous,candidate)).statusCode).toBe(200);
    const current=(await ctx.store.getSpace(state.space.slug))!;expect(current.definition!.definitionVersion).toBe(3);expect(current.space.slug).toBe(previous.space.slug);expect(current.records).toEqual(previous.records);
    const old=await ctx.app.inject({url:`/api/generated-frame?space=${state.space.slug}&version=2&channel=0123456789abcdef`});expect(old.body).toContain('Fixture website');expect(old.body).not.toContain('Revised custom website');
  });
  it('cancels pending work and suppresses a provider that ignores abort',async()=>{
    const state=await space();let resolve!:(p:Proposal)=>void,entered=false;generator=async()=>{entered=true;return new Promise(r=>{resolve=r;});};const job=await start(state);await vi.waitFor(()=>expect(entered).toBe(true));
    const cancel=await ctx.app.inject({method:'POST',url:`${endpoint(state,job.id)}/cancel`,headers:owner});expect(cancel.json().stage).toBe('cancelled');resolve(fixture(state.definition!));await new Promise(r=>setTimeout(r,50));expect((await ctx.app.inject({url:endpoint(state,job.id),headers:owner})).json().stage).toBe('cancelled');
  });
  it('revokes original-session generation and rejects a second login even for the same owner',async()=>{
    const state=await space(),headers=await login();let entered=false,resolve!:(p:Proposal)=>void;generator=async()=>{entered=true;return new Promise(r=>{resolve=r;});};const job=await start(state,ctx,headers);await vi.waitFor(()=>expect(entered).toBe(true));
    const logout=await ctx.app.inject({method:'POST',url:'/auth/logout',headers});expect(logout.statusCode).toBe(200);resolve(fixture(state.definition!));const fresh=await login();expect((await ctx.app.inject({url:endpoint(state,job.id),headers:fresh})).statusCode).toBe(404);expect((await ctx.app.inject({url:endpoint(state,job.id),headers})).statusCode).toBe(401);
    await vi.waitFor(async()=>expect((await ctx.store.db.query<{data:{job:GenerationJob}}>('SELECT data FROM lf_generations WHERE id=$1',[job.id])).rows[0]!.data.job.stage).toBe('failed'));expect((await ctx.store.getSpace(state.space.slug))!.definition!.definitionVersion).toBe(1);
  });
  it('rejects a checked candidate after another definition publication',async()=>{
    const state=await space();generator=async input=>fixture(input.current!);const job=await start(state),candidate=await waitFor(state,job.id,['preview']);await report(state,candidate);
    await ctx.store.db.transaction(async tx=>{const current=(await ctx.store.getSpace(state.space.slug,tx,true))!;current.definition!.definitionVersion++;current.definition!.summary='A concurrent publication';await ctx.store.event(current,'definition.published',tx);});
    expect((await publish(state,candidate)).statusCode).toBe(409);expect((await ctx.store.getSpace(state.space.slug))!.definition!.summary).toBe('A concurrent publication');
  });
  it('replays durable SSE and closes the stream when its session is revoked',async()=>{
    const state=await space(),streamHeaders=await login();generator=async input=>fixture(input.current!);const job=await start(state,ctx,streamHeaders),candidate=await waitFor(state,job.id,['preview'],ctx,streamHeaders);
    const url=await ctx.app.listen({host:'127.0.0.1',port:0});const headers=await login(); // This browser cannot take over an earlier session's draft.
    expect((await ctx.app.inject({url:`${endpoint(state,job.id)}/events?after=0`,headers})).statusCode).toBe(404);
    const controller=new AbortController(),response=await fetch(`${url}${endpoint(state,job.id)}/events?after=1`,{headers:streamHeaders,signal:controller.signal});expect(response.status).toBe(200);const reader=response.body!.getReader();let text='';while(!text.includes('event: generation')){const part=await reader.read();text+=new TextDecoder().decode(part.value);}expect(text).not.toContain('id: 1\n');expect(text).toContain('event: generation');
    const last=candidate.events.at(-1)!.sequence;expect((await ctx.app.inject({url:`${endpoint(state,job.id)}/events?after=${last+1}`,headers:streamHeaders})).statusCode).toBe(409);
    expect((await ctx.app.inject({method:'POST',url:'/auth/logout',headers:streamHeaders})).statusCode).toBe(200);
    const done=await Promise.race([(async()=>{while(!(await reader.read()).done){}return true;})(),new Promise(resolve=>setTimeout(()=>resolve(false),2000))]);expect(done).toBe(true);controller.abort();
  });
});

describe('bounded raster assets',()=>{
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXuoAAAAASUVORK5CYII=';
  it('keeps drafts private and exposes only published references in the same space',async()=>{
    const state=await space();const r=await ctx.app.inject({method:'POST',url:`/api/spaces/${state.space.slug}/assets`,headers:owner,payload:{mimeType:'image/png',dataBase64:png}});expect(r.statusCode,r.body).toBe(201);const asset=r.json();const url=`/api/spaces/${state.space.slug}/assets/${asset.assetId}`;
    expect((await ctx.app.inject({url})).statusCode).toBe(404);expect((await ctx.app.inject({url,headers:participant})).statusCode).toBe(404);expect((await ctx.app.inject({url,headers:owner})).json()).toEqual(asset);
    const other=await space();expect((await ctx.app.inject({url:`/api/spaces/${other.space.slug}/assets/${asset.assetId}`,headers:owner})).statusCode).toBe(404);
    await ctx.store.db.transaction(async tx=>{const current=(await ctx.store.getSpace(state.space.slug,tx,true))!;current.records[0]!.values.private_note=asset.assetId;await ctx.store.saveSpace(current,tx);});expect((await ctx.app.inject({url})).statusCode).toBe(404);
    await ctx.store.db.transaction(async tx=>{const current=(await ctx.store.getSpace(state.space.slug,tx,true))!;current.records[0]!.values.title=asset.assetId;await ctx.store.saveSpace(current,tx);});expect((await ctx.app.inject({url})).json()).toEqual(asset);
  });
  it('rejects SVG, mismatched signatures, oversized dimensions and exhausted per-space quota',async()=>{
    expect(()=>validateRaster('image/svg+xml',Buffer.from('<svg/>').toString('base64'))).toThrow();expect(()=>validateRaster('image/jpeg',png)).toThrow();const oversized=Buffer.from(png,'base64');oversized.writeUInt32BE(5000,16);expect(()=>validateRaster('image/png',oversized.toString('base64'))).toThrow();
    const state=await space();await ctx.store.db.query('INSERT INTO lf_assets(id,space_id,user_id,mime_type,bytes,data_base64) VALUES($1,$2,$3,$4,$5,$6)',[`asset_${randomUUID()}`,state.space.id,'user-local-owner','image/png',20*1024*1024,png]);
    const r=await ctx.app.inject({method:'POST',url:`/api/spaces/${state.space.slug}/assets`,headers:owner,payload:{mimeType:'image/png',dataBase64:png}});expect(r.statusCode).toBe(413);expect(r.json().error.code).toBe('ASSET_QUOTA');
  });
});

it('recovers disk jobs/history/assets and marks interrupted work failed without another provider call',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'lf-generated-'));let local:Context|undefined;
  try{
    local=await buildApp({db:await createDatabase({dataDir:directory}),origin,localDemo:true,siteGenerator:async input=>fixture(input.current!)});const headers=await login(local),state=await space(local);const job=await start(state,local,headers);const candidate=await waitFor(state,job.id,['preview'],local,headers);await report(state,candidate,true,local,headers);expect((await publish(state,candidate,local,headers)).statusCode).toBe(200);
    const upload=await local.app.inject({method:'POST',url:`/api/spaces/${state.space.slug}/assets`,headers,payload:{mimeType:'image/png',dataBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXuoAAAAASUVORK5CYII='}});expect(upload.statusCode).toBe(201);const asset=upload.json();
    await local.store.db.query("UPDATE lf_generations SET data=jsonb_set(data,'{job,stage}','\"writing\"'::jsonb) WHERE id=$1",[job.id]);await local.app.close();local=undefined;
    const provider=vi.fn<SiteGenerator>(async()=>{throw new Error('Restart must not regenerate.');});local=await buildApp({db:await createDatabase({dataDir:directory}),origin,localDemo:true,siteGenerator:provider});const recovered=await local.app.inject({url:endpoint(state,job.id),headers});expect(recovered.json().stage).toBe('failed');expect(recovered.json().error).toContain('restart');expect(provider).not.toHaveBeenCalled();
    expect((await local.app.inject({url:`/api/spaces/${state.space.slug}/versions`,headers})).json().versions).toHaveLength(2);expect((await local.app.inject({url:`/api/generated-frame?space=${state.space.slug}&version=2&channel=0123456789abcdef`})).statusCode).toBe(200);expect((await local.app.inject({url:`/api/spaces/${state.space.slug}/assets/${asset.assetId}`,headers})).json()).toEqual(asset);
  }finally{await local?.app.close();await rm(directory,{recursive:true,force:true});}
},30000);
