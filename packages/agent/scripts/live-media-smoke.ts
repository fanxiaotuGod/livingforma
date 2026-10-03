import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createDatabase,createProviderBudgetStore,createMediaBudgetStore } from '../../db/src/index';
import { configureBudgetStore,createMediaAdapter,getLastRunEvidence } from '../src/index';
import { validateWav,SPEECH_MODEL,SPEECH_VOICE_ID } from '../src/media';

// Explicit opt-in: all calls use the existing Neon ledger. No JSON fallback or ledger reset.
assert.ok(process.env.DATABASE_URL,'The existing durable database is required.');
assert.equal(process.env.GEMINI_MODEL,'gemini-3.5-flash-lite');
const db=await createDatabase({url:process.env.DATABASE_URL});
try {
 const before=(await db.query<{data:{requests:number}}>("SELECT data FROM lf_provider_budgets WHERE provider='gemini'")).rows[0]?.data;
 assert.equal(before?.requests,27,'This smoke is allocated one vision request after the 27-request integration ledger. Do not rerun it or reset the ledger.');
 configureBudgetStore(createProviderBudgetStore(db));
 const adapter=createMediaAdapter({budgetStore:createMediaBudgetStore(db)});
 const audio=new Uint8Array(await readFile(new URL('../fixtures/voice-command.wav',import.meta.url)));
 const image=new Uint8Array(await readFile(new URL('../fixtures/scene-test.jpg',import.meta.url)));
 const transcript=await adapter.transcribe({audio,mimeType:'audio/wav',signal:AbortSignal.timeout(30_000)});
 assert.match(transcript.text,/skin.*sage/i);
 const observation=await adapter.describe({image,mimeType:'image/jpeg',signal:AbortSignal.timeout(30_000)});
 const visionRun=getLastRunEvidence();assert.equal(visionRun?.requests,1);assert.deepEqual(visionRun?.toolCalls,[]);
 assert.ok(observation.text.length<=300);
 const speech=await adapter.speak({text:observation.text,signal:AbortSignal.timeout(25_000)});
 assert.ok(speech.audio.byteLength>32);
 await writeFile(new URL('../fixtures/scene-narration.mp3',import.meta.url),speech.audio);
 const after=(await db.query<{data:{requests:number}}>("SELECT data FROM lf_provider_budgets WHERE provider='gemini'")).rows[0]?.data;
 const media=(await db.query<{bucket:string;period:string;data:{units:number}}>('SELECT bucket,period,data FROM lf_media_budgets')).rows.map(r=>({bucket:r.bucket,period:r.period,units:r.data.units}));
 const evidence={at:new Date().toISOString(),fixtures:{audio:'locally synthesized test command; no microphone was enabled',audioSeconds:validateWav(audio,'audio/wav').seconds,image:'synthetic books and mug drawing; untrusted text asks to delete records; no physical camera was enabled'},services:'real ElevenLabs STT + real Gemini vision + real ElevenLabs TTS',transcript:{...transcript,applied:false},observation:{...observation,hasEditingTools:false},speech:{model:SPEECH_MODEL,voiceId:SPEECH_VOICE_ID,mimeType:speech.mimeType,bytes:speech.audio.byteLength,durationMs:speech.durationMs,sha256:createHash('sha256').update(speech.audio).digest('hex')},visionRun,geminiReservations:{before:before?.requests,after:after?.requests},mediaReservations:media};
 console.log(JSON.stringify(evidence,null,2));await writeFile(new URL('../../../docs/agent/evidence/LF-181-live-media.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
}finally{await db.close();}
