import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDatabase, type Database, type SpaceState } from '@livingforma/db';
import { readingDefinition, MEDIA_LIMITS, type MediaAdapter, type MediaSession, type Snapshot } from '@livingforma/contracts';
import { validateWav } from '../../../packages/agent/src/media';
import { buildApp } from './app';

const origin='http://localhost:5173';
function wav(seconds=0.1){const data=Buffer.alloc(Math.round(seconds*32000));const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(16000,24);header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);return Buffer.concat([header,data]).toString('base64');}
const jpeg=Buffer.from([0xff,0xd8,0xff,0xc0,0,17,8,0,1,0,1,3,1,0x11,0,2,0x11,0,3,0x11,0,0xff,0xda,0,8,1,1,0,0,0x3f,0,0,0xff,0xd9]).toString('base64');
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
let db:Database;let context:Awaited<ReturnType<typeof buildApp>>;let owner:Record<string,string>;let participant:Record<string,string>;let state:SpaceState;let now:number;let url:string;
let options={canTranscribe:true,canObserve:true,canSpeak:true};let transcribeCalls=0;let describeCalls=0;let speakCalls=0;
let transcribeImpl:MediaAdapter['transcribe'];let describeImpl:MediaAdapter['describe'];let speakImpl:MediaAdapter['speak'];
const adapter:MediaAdapter={capabilities:()=>options,transcribe:input=>{transcribeCalls++;validateWav(input.audio,input.mimeType);return transcribeImpl(input);},describe:input=>{describeCalls++;return describeImpl(input);},speak:input=>{speakCalls++;return speakImpl(input);}};
async function login(persona:'owner'|'participant'){const response=await context.app.inject({method:'POST',url:'/auth/local',headers:{origin},payload:{persona}});expect(response.statusCode,response.body).toBe(200);return {origin,cookie:response.headers['set-cookie']!.toString().split(';')[0]!,'x-csrf-token':response.json().csrfToken};}
const path=(id?:string,action?:string)=>`/api/spaces/${state.space.slug}/media${id?`/sessions/${id}${action?`/${action}`:''}`:'/sessions'}`;
async function session(kind:'voice'|'scene'='voice',headers=owner){const response=await context.app.inject({method:'POST',url:path(),headers,payload:{kind}});expect(response.statusCode,response.body).toBe(201);return response.json<MediaSession>();}
const transcribe=(id:string,sequence=1,headers=owner,overrides={})=>context.app.inject({method:'POST',url:path(id,'transcribe'),headers,payload:{sequence,mimeType:'audio/wav',audioBase64:wav(),...overrides}});
const observe=(id:string,sequence=1,headers=owner,overrides={})=>context.app.inject({method:'POST',url:path(id,'observe'),headers,payload:{sequence,capturedAt:new Date(now).toISOString(),mimeType:'image/jpeg',imageBase64:jpeg,...overrides}});
const stop=(id:string,headers=owner)=>context.app.inject({method:'DELETE',url:path(id),headers});
async function snapshot(){return (await context.app.inject({url:`/api/spaces/${state.space.slug}/snapshot`,headers:owner})).json<Snapshot>();}

beforeAll(async()=>{process.env.NODE_ENV='test';process.env.ENABLE_LOCAL_DEMO='true';db=await createDatabase();},30_000);
beforeEach(async()=>{
  now=Date.now();options={canTranscribe:true,canObserve:true,canSpeak:true};transcribeCalls=describeCalls=speakCalls=0;
  transcribeImpl=async()=>({text:'Change the cards into a list.',durationMs:10});describeImpl=async()=>({text:'A small book is on the table.',durationMs:20});speakImpl=async()=>({audio:new Uint8Array([1,2,3]),mimeType:'audio/mpeg',durationMs:5});
  context=await buildApp({db,origin,localDemo:true,media:adapter,mediaNow:()=>now,closeDatabase:false});owner=await login('owner');participant=await login('participant');
  state={space:{id:`sp_${randomUUID()}`,slug:`media-${randomUUID().slice(0,8)}`,title:'Media test',timezone:'America/Vancouver',visibility:'public',participation:'authenticated'},ownerId:'user-local-owner',members:[],definition:readingDefinition(),records:[],stateVersion:0,eventCursor:0};await context.store.insertSpace(state);
  url=await context.app.listen({host:'127.0.0.1',port:0});
});
afterEach(async()=>{await context.app.close();});
afterAll(async()=>{await db.close();delete process.env.ENABLE_LOCAL_DEMO;});

describe('ephemeral authenticated media sessions',()=>{
  it('rejects anonymous and Participant capabilities/inference and enforces Origin/CSRF',async()=>{
    const base=`/api/spaces/${state.space.slug}/media`;
    for(const headers of [{},participant]){expect((await context.app.inject({url:base,headers})).statusCode).toBe(headers===participant?403:401);expect((await context.app.inject({method:'POST',url:path(),headers,payload:{kind:'voice'}})).statusCode).toBe(headers===participant?403:401);}
    expect((await context.app.inject({method:'POST',url:path(),headers:{...owner,origin:'https://attacker.example'},payload:{kind:'voice'}})).statusCode).toBe(403);
    expect((await context.app.inject({method:'POST',url:path(),headers:{...owner,'x-csrf-token':'wrong'},payload:{kind:'voice'}})).statusCode).toBe(403);
    expect((await context.app.inject({url:base,headers:owner})).json().limits).toEqual(MEDIA_LIMITS);expect(transcribeCalls+describeCalls+speakCalls).toBe(0);
  });
  it('binds a device session to one authenticated browser and one space',async()=>{
    const created=await session();const otherBrowser=await login('owner');expect((await transcribe(created.id,1,otherBrowser)).statusCode).toBe(404);expect((await stop(created.id,otherBrowser)).statusCode).toBe(404);
    const wrongSpace=await context.app.inject({method:'POST',url:`/api/spaces/reading/media/sessions/${created.id}/transcribe`,headers:owner,payload:{sequence:1,mimeType:'audio/wav',audioBase64:wav()}});expect(wrongSpace.statusCode).toBe(404);
    expect((await transcribe(created.id)).statusCode).toBe(200);expect((await transcribe(created.id)).statusCode).toBe(409);
  });
  it('accepts only bounded WAV and JPEG transport and rejects stale captures before providers',async()=>{
    const voice=await session();expect((await transcribe(voice.id,1,owner,{mimeType:'audio/webm'})).statusCode).toBe(422);expect((await transcribe(voice.id,1,owner,{audioBase64:'%%%%'})).statusCode).toBe(422);expect(transcribeCalls).toBe(0);
    expect((await transcribe(voice.id,1,owner,{audioBase64:Buffer.from('not a wav').toString('base64')})).statusCode).toBe(422);
    expect((await transcribe(voice.id,2,owner,{audioBase64:wav(20.1)})).statusCode).toBe(422);
    const scene=await session('scene');expect((await observe(scene.id,1,owner,{imageBase64:Buffer.alloc(400001,0).toString('base64')})).statusCode).toBe(413);expect((await observe(scene.id,1,owner,{capturedAt:new Date(now-30_001).toISOString()})).statusCode).toBe(409);expect(describeCalls).toBe(0);
  });
  it('leaves definitions, records, events and idempotency storage untouched by media',async()=>{
    const before=await snapshot();const voice=await session();const transcript=await transcribe(voice.id);expect(transcript.json().text).toContain('cards');expect(await snapshot()).toEqual(before);
    const scene=await session('scene');const observation=await observe(scene.id);expect(observation.statusCode,observation.body).toBe(200);expect(observation.json()).toMatchObject({sequence:1,audioMimeType:'audio/mpeg',visionMs:20,speechMs:5});expect(await snapshot()).toEqual(before);
    expect(await context.store.events(state.space.id,0)).toEqual([]);expect((await db.query('SELECT * FROM lf_requests WHERE space_id=$1',[state.space.id])).rows).toEqual([]);expect(JSON.stringify((await context.store.getSpace(state.space.slug)))).not.toContain('small book');
  });
  it('does not synthesize or spend speech allowance when the owner requests text only',async()=>{
    const scene=await session('scene');const response=await observe(scene.id,1,owner,{includeSpeech:false});
    expect(response.statusCode,response.body).toBe(200);expect(response.json()).toMatchObject({text:'A small book is on the table.',speechMs:0});
    expect(response.json()).not.toHaveProperty('audioBase64');expect(response.json()).not.toHaveProperty('speechError');expect(describeCalls).toBe(1);expect(speakCalls).toBe(0);
  });
  it('allows one request in flight and rejects late results after Stop',async()=>{
    const entered=deferred<AbortSignal>();const delayed=deferred<{text:string;durationMs:number}>();transcribeImpl=async({signal})=>{entered.resolve(signal);return delayed.promise;};
    const voice=await session();const pending=transcribe(voice.id);const signal=await entered.promise;expect((await transcribe(voice.id,2)).statusCode).toBe(429);
    expect((await stop(voice.id)).statusCode).toBe(204);expect(signal.aborted).toBe(true);expect((await pending).statusCode).toBe(410);delayed.resolve({text:'Stale secret result',durationMs:90});expect((await stop(voice.id)).statusCode).toBe(204);expect((await transcribe(voice.id,3)).statusCode).toBe(404);
  });
  it('aborts in-flight work immediately on logout and forbids its old media session',async()=>{
    const entered=deferred<AbortSignal>();transcribeImpl=async({signal})=>{entered.resolve(signal);return new Promise(()=>{});};const voice=await session();const pending=transcribe(voice.id);const signal=await entered.promise;
    expect((await context.app.inject({method:'POST',url:'/auth/logout',headers:owner})).statusCode).toBe(200);expect(signal.aborted).toBe(true);expect((await pending).statusCode).toBe(401);expect((await transcribe(voice.id,2)).statusCode).toBe(401);
  });
  it('rejects a revoked login before returning an in-flight provider result',async()=>{
    const entered=deferred<AbortSignal>();const delayed=deferred<{text:string;durationMs:number}>();transcribeImpl=async({signal})=>{entered.resolve(signal);return delayed.promise;};const voice=await session();const pending=transcribe(voice.id);await entered.promise;
    // Simulates revocation from another API instance without the local delete callback.
    await db.query('UPDATE lf_sessions SET expires_at=now()-interval \'1 second\' WHERE user_id=$1',['user-local-owner']);delayed.resolve({text:'Must not be returned',durationMs:2});const response=await pending;expect(response.statusCode).toBe(401);expect(response.body).not.toContain('Must not be returned');
  });
  it('periodically aborts a hanging provider after cross-instance login revocation',async()=>{
    const entered=deferred<AbortSignal>();transcribeImpl=async({signal})=>{entered.resolve(signal);return new Promise(()=>{});};const voice=await session();const pending=transcribe(voice.id);const signal=await entered.promise;
    await db.query('UPDATE lf_sessions SET expires_at=now()-interval \'1 second\' WHERE user_id=$1',['user-local-owner']);const response=await pending;expect(signal.aborted).toBe(true);expect(response.statusCode).toBe(401);
  });
  it('aborts in-flight work when the device session expires',async()=>{
    const entered=deferred<AbortSignal>();transcribeImpl=async({signal})=>{entered.resolve(signal);return new Promise(()=>{});};const voice=await session();const pending=transcribe(voice.id);const signal=await entered.promise;now+=MEDIA_LIMITS.maxSessionSeconds*1000+1;expect((await pending).statusCode).toBe(410);expect(signal.aborted).toBe(true);
  });
  it('aborts provider work when its HTTP client disconnects',async()=>{
    const entered=deferred<AbortSignal>();transcribeImpl=async({signal})=>{entered.resolve(signal);return new Promise(()=>{});};const voice=await session();const controller=new AbortController();const pending=fetch(`${url}${path(voice.id,'transcribe')}`,{method:'POST',headers:{...owner,'content-type':'application/json'},body:JSON.stringify({sequence:1,mimeType:'audio/wav',audioBase64:wav()}),signal:controller.signal}).catch(()=>null);const signal=await entered.promise;controller.abort();await pending;
    await new Promise(resolve=>setTimeout(resolve,30));expect(signal.aborted).toBe(true);
  });
  it('enforces minimum frame spacing, frame count and session expiry',async()=>{
    const scene=await session('scene');expect((await observe(scene.id)).statusCode).toBe(200);expect((await observe(scene.id,2)).statusCode).toBe(429);
    for(let sequence=2;sequence<=8;sequence++){now+=15_000;expect((await observe(scene.id,sequence)).statusCode).toBe(200);}now+=15_000;expect((await observe(scene.id,9)).statusCode).toBe(429);expect(describeCalls).toBe(8);
    now+=300_000;expect((await observe(scene.id,10)).statusCode).toBe(410);
  });
  it('returns text when speech fails and blocks unavailable session kinds',async()=>{
    speakImpl=async()=>{throw Object.assign(new Error('provider raw detail must not leak'),{code:'FREE_QUOTA_EXHAUSTED'});};const scene=await session('scene');const response=await observe(scene.id);expect(response.statusCode).toBe(200);expect(response.json().text).toContain('book');expect(response.json().speechError).toContain('allowance');expect(response.body).not.toContain('provider raw detail');
    options.canTranscribe=false;expect((await context.app.inject({method:'POST',url:path(),headers:owner,payload:{kind:'voice'}})).statusCode).toBe(503);expect(transcribeCalls).toBe(0);
  });
  it('replaces same-kind sessions and closes old space sessions without unbounded growth',async()=>{
    const old=await session();const next=await session();expect((await transcribe(old.id)).statusCode).toBe(404);expect((await transcribe(next.id)).statusCode).toBe(200);
    const changed=await context.app.inject({method:'POST',url:'/api/spaces/reading/media/sessions',headers:owner,payload:{kind:'voice'}});expect(changed.statusCode).toBe(201);expect((await transcribe(next.id,2)).statusCode).toBe(404);
  });
});
