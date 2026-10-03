import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { MediaBudgetStore } from '@livingforma/contracts';
import { boundedBody, createMediaAdapter, validateJpeg, validateWav, MEDIA_ALLOWANCE_PERIOD } from './media';
const wav=()=>new Uint8Array(readFileSync(new URL('../fixtures/voice-command.wav',import.meta.url)));
const jpeg=()=>new Uint8Array(readFileSync(new URL('../fixtures/scene-test.jpg',import.meta.url)));
const allowance=()=>new Response(JSON.stringify({character_count:0,character_limit:131000,can_extend_character_limit:false,allowed_to_extend_character_limit:false}),{headers:{'Content-Type':'application/json'}});
const signal=()=>new AbortController().signal;
function setup(fetcher:(url:string,init?:RequestInit)=>Promise<Response>,budget?:MediaBudgetStore){
 vi.stubEnv('ELEVENLABS_API_KEY','test-fixture-only');vi.stubEnv('ELEVENLABS_ALLOWANCE_VERIFIED','true');
 const reservations:Parameters<MediaBudgetStore['reserve']>[0][]=[];
 const adapter=createMediaAdapter({budgetStore:budget??{reserve:async input=>{reservations.push(input);}},fetch:(async(input,init)=>fetcher(String(input),init)) as typeof fetch});return {adapter,reservations};
}
afterEach(()=>vi.unstubAllEnvs());
describe('strict media input bounds',()=>{
 it('derives real WAV duration and rejects compression, truncation, stereo, extra chunks, and long recordings',()=>{
  const bytes=wav();expect(validateWav(bytes,'audio/wav').seconds).toBeLessThan(20);expect(()=>validateWav(bytes,'audio/webm')).toThrow();
  for(const mutate of [(b:Buffer)=>b.writeUInt16LE(2,22),(b:Buffer)=>b.writeUInt16LE(3,20),(b:Buffer)=>b.writeUInt32LE(48000,24)]){const b=Buffer.from(bytes);mutate(b);expect(()=>validateWav(b,'audio/wav')).toThrow();}
  expect(()=>validateWav(bytes.slice(0,-2),'audio/wav')).toThrow();const long=Buffer.alloc(44+21*32000);Buffer.from(bytes).copy(long,0,0,44);long.writeUInt32LE(long.length-8,4);long.writeUInt32LE(long.length-44,40);expect(()=>validateWav(long,'audio/wav')).toThrow(/20 seconds/);
  const extra=Buffer.concat([bytes,Buffer.from('JUNK\x00\x00\x00\x00')]);extra.writeUInt32LE(extra.length-8,4);expect(()=>validateWav(extra,'audio/wav')).toThrow(/Unsupported WAV chunk/);
 });
 it('validates JPEG dimensions, magic and size before observation',()=>{
  expect(()=>validateJpeg(jpeg(),'image/jpeg')).not.toThrow();expect(()=>validateJpeg(new Uint8Array(400001),'image/jpeg')).toThrow();expect(()=>validateJpeg(jpeg(),'image/png')).toThrow();expect(()=>validateJpeg(jpeg().slice(0,-2),'image/jpeg')).toThrow();
 });
});
describe('included allowance, durable reservations, and truthful fallback',()=>{
 it('sends validated WAV to Scribe and returns only a draft transcript with latency',async()=>{
  let posted=false;const {adapter,reservations}=setup(async(url,init)=>{if(url.endsWith('/subscription'))return allowance();posted=true;expect(url.endsWith('/speech-to-text')).toBe(true);expect(init?.body).toBeInstanceOf(FormData);expect((init!.body as FormData).get('model_id')).toBe('scribe_v2');return Response.json({text:'Change the skin to sage.',words:[{text:'private metadata not returned'}]});});
  const result=await adapter.transcribe({audio:wav(),mimeType:'audio/wav',signal:signal()});expect(result.text).toBe('Change the skin to sage.');expect(result.durationMs).toBeGreaterThanOrEqual(0);expect(Object.keys(result).sort()).toEqual(['durationMs','text']);expect(posted).toBe(true);expect(reservations[0]).toMatchObject({bucket:'elevenlabs-stt-seconds',period:MEDIA_ALLOWANCE_PERIOD,units:Math.ceil(validateWav(wav(),'audio/wav').seconds),limit:60,minuteRequestLimit:3});
 });
 it('reserves UTF-16 characters and uses a fixed voice/model with bounded MP3',async()=>{
  const {adapter,reservations}=setup(async(url,init)=>{if(url.endsWith('/subscription'))return allowance();expect(url).toContain('SAz9YHcvj6GT2YYXdXww');expect(JSON.parse(init?.body as string)).toMatchObject({model_id:'eleven_flash_v2_5',text:'A red mug.'});return new Response(new Uint8Array(128),{headers:{'Content-Type':'audio/mpeg'}});});
  const result=await adapter.speak({text:'A red mug.',signal:signal()});expect(result.audio.length).toBe(128);expect(reservations[0]).toMatchObject({bucket:'elevenlabs-tts-characters',units:10,limit:1000});
 });
 it('makes no generation call if verified allowance or durable quota fails',async()=>{
  let posts=0;const {adapter}=setup(async(url)=>{if(url.endsWith('/subscription'))return allowance();posts++;return new Response();},{reserve:async()=>{throw new Error('exhausted');}});
  await expect(adapter.speak({text:'A mug.',signal:signal()})).rejects.toThrow(/budget/);expect(posts).toBe(0);vi.stubEnv('ELEVENLABS_ALLOWANCE_VERIFIED','false');await expect(adapter.speak({text:'A mug.',signal:signal()})).rejects.toThrow(/verified/);expect(posts).toBe(0);
 });
 it('rejects an overage-enabled account before reserving or generating',async()=>{
  const {adapter,reservations}=setup(async()=>Response.json({character_count:0,character_limit:100,can_extend_character_limit:true,allowed_to_extend_character_limit:true}));await expect(adapter.speak({text:'A mug.',signal:signal()})).rejects.toThrow(/allowance/);expect(reservations).toHaveLength(0);
 });
 it('rejects malformed allowance and unexpected audio format without exposing provider data',async()=>{
  const malformed=setup(async()=>Response.json(null));await expect(malformed.adapter.speak({text:'A mug.',signal:signal()})).rejects.toThrow(/allowance/);expect(malformed.reservations).toHaveLength(0);
  const format=setup(async url=>url.endsWith('/subscription')?allowance():new Response(new Uint8Array(100),{headers:{'Content-Type':'audio/wav'}}));await expect(format.adapter.speak({text:'A mug.',signal:signal()})).rejects.toThrow(/unexpected format/);expect(format.reservations).toHaveLength(1);
 });
 it('rejects cancelled or invalid input before any network access',async()=>{
  let requests=0;const {adapter,reservations}=setup(async()=>{requests++;return allowance();});const controller=new AbortController();controller.abort();
  await expect(adapter.transcribe({audio:wav(),mimeType:'audio/wav',signal:controller.signal})).rejects.toThrow();await expect(adapter.transcribe({audio:wav(),mimeType:'audio/webm',signal:signal()})).rejects.toThrow();expect(requests).toBe(0);expect(reservations).toHaveLength(0);
 });
 it('discards a late provider result after cancellation without refunding its reservation',async()=>{
  let resolvePost!:(r:Response)=>void;let started!:(v?:unknown)=>void;const ready=new Promise(resolve=>{started=resolve;});const controller=new AbortController();
  const {adapter,reservations}=setup(async(url)=>{if(url.endsWith('/subscription'))return allowance();started();return new Promise(resolve=>{resolvePost=resolve;});});
  const pending=adapter.speak({text:'A mug.',signal:controller.signal});await ready;controller.abort();resolvePost(new Response(new Uint8Array(50),{headers:{'Content-Type':'audio/mpeg'}}));await expect(pending).rejects.toThrow();expect(reservations).toHaveLength(1);
 });
 it('sanitizes provider failures and rejects output beyond limits',async()=>{
  const {adapter,reservations}=setup(async(url)=>url.endsWith('/subscription')?allowance():new Response('secret fixture response',{status:429}));await expect(adapter.speak({text:'A mug.',signal:signal()})).rejects.toThrow('The speech service limit has been reached. Please use text.');expect(reservations).toHaveLength(1);
  await expect(boundedBody(new Response(new Uint8Array(201)),200,signal())).rejects.toThrow(/too large/);await expect(adapter.speak({text:'x'.repeat(301),signal:signal()})).rejects.toThrow(/300/);
 });
 it('never returns a late vision description and forwards no command authority',async()=>{
  const controller=new AbortController();const adapter=createMediaAdapter({budgetStore:{reserve:async()=>{}},describe:async()=>{controller.abort();return {text:'A red mug.',durationMs:1};}});await expect(adapter.describe({image:jpeg(),mimeType:'image/jpeg',signal:controller.signal})).rejects.toThrow();
 });
});
