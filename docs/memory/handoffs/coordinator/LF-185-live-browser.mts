/** Opt-in live integration. Uses real providers and the existing durable Neon budget.
 * Synthetic virtual devices, and a short-lived server-issued test session for the
 * previously Google-verified Owner. Does not repeat or claim a Google roundtrip.
 * Never automatically retry: one STT, one proposal, one vision/TTS observation.
 */
import { chromium, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createDatabase, Store } from '../../../../packages/db/src/index';
import { hashToken } from '../../../../packages/auth/src/index';
import { createAuthStore } from '../../../../apps/api/src/auth-store';

if(process.env.RUN_LIVE_MEDIA !== 'yes') throw new Error('Set RUN_LIVE_MEDIA=yes only after reviewing the remaining shared allowance.');
process.loadEnvFile('.env');
const origin='http://localhost:5173', slug='space-3c242042';
const out='docs/memory/handoffs/coordinator/LF-185-live-browser-evidence.json';
const evidence:any={at:new Date().toISOString(),scope:'Real localhost UI/API, Neon, Gemini and ElevenLabs. Virtual devices and temporary server test session; Google separately verified in LF150.',checks:[]};
const db=await createDatabase({url:process.env.DATABASE_URL}),store=new Store(db),auth=createAuthStore(store);
const before=await store.getSpace(slug);if(!before?.definition)throw new Error('Missing live habit space');
const ledger=async()=>({gemini:(await db.query<any>('SELECT data FROM lf_provider_budgets WHERE provider=$1',['gemini'])).rows[0]?.data,media:(await db.query<any>('SELECT bucket,period,data FROM lf_media_budgets ORDER BY bucket')).rows});
evidence.before=await ledger();
if(evidence.before.gemini.requests!==28)throw new Error('Budget changed: review before running live test.');
const raw=randomBytes(32).toString('base64url'),csrfToken=randomBytes(32).toString('base64url'),tokenHash=hashToken(raw);
await auth.createSession({tokenHash,userId:before.ownerId,csrfToken,expiresAt:new Date(Date.now()+600_000).toISOString()});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-audio-capture=/tmp/livingforma-voice-input.wav','--use-file-for-fake-video-capture=/tmp/livingforma-scene.y4m']});
const owner=await browser.newContext({permissions:['microphone','camera'],viewport:{width:1440,height:1100}}),visitor=await browser.newContext({viewport:{width:1100,height:900}});
for(const context of [owner,visitor])await context.addInitScript(()=>{
 const observed:any={calls:0,tracks:[],audio:[],plays:0};(window as any).__mediaEvidence=observed;
 const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 navigator.mediaDevices.getUserMedia=async options=>{observed.calls++;const stream=await original(options);observed.tracks.push(...stream.getTracks());return stream;};
 const NativeAudio=window.Audio;
 window.Audio=function(...args:any[]){const audio=new NativeAudio(...args);observed.audio.push(audio);audio.addEventListener('playing',()=>observed.plays++);return audio;} as any;
});
await owner.addCookies([{name:'lf-session',value:raw,url:origin,httpOnly:true,sameSite:'Lax'}]);
const page=await owner.newPage(),viewer=await visitor.newPage();page.setDefaultTimeout(15000);viewer.setDefaultTimeout(15000);
const pageErrors:string[]=[];for(const p of [page,viewer])p.on('pageerror',error=>pageErrors.push(error.message));
const snap=async()=>(await owner.request.get(`${origin}/api/spaces/${slug}/snapshot`)).json();
const inspect=async(p:typeof page)=>p.evaluate(()=>{const d=(window as any).__mediaEvidence;return {calls:d.calls,tracks:d.tracks.map((t:MediaStreamTrack)=>({kind:t.kind,state:t.readyState})),plays:d.plays,audio:d.audio.map((a:HTMLAudioElement)=>({paused:a.paused,src:a.getAttribute('src')}))};});
async function save(){await writeFile(out,JSON.stringify(evidence,null,2));}
try{
 await page.goto(`${origin}/s/${slug}`);await viewer.goto(`${origin}/s/${slug}`);
 await expect(page.getByRole('button',{name:'Open the space designer'})).toBeVisible();
 await expect(viewer.getByRole('button',{name:'Open the space designer'})).toHaveCount(0);
 expect((await snap()).role).toBe('owner');evidence.checks.push('Server session maps to existing Google Owner; independent visitor has no orb.');
 await page.getByRole('button',{name:'Open the space designer'}).click();
 const draft=page.getByRole('textbox',{name:'Describe how to change your space'});await draft.fill('');
 await page.getByRole('button',{name:'Speak your idea'}).click();
 await expect(page.getByRole('button',{name:/Finish recording/})).toBeVisible();
 await page.waitForTimeout(2700);
 const transcription=page.waitForResponse(r=>r.url().endsWith('/transcribe'));
 await page.getByRole('button',{name:/Finish recording/}).click();
 const stt=await transcription;evidence.transcription={status:stt.status(),...await stt.json()};await save();expect(stt.ok()).toBe(true);
 await expect(draft).toHaveValue(/sage/i,{timeout:30000});
 const transcript=await draft.inputValue();evidence.transcriptDraft=transcript;
 expect((await snap()).definition.definitionVersion).toBe(before.definition.definitionVersion);
 expect((await inspect(page)).tracks.every((t:any)=>t.state==='ended')).toBe(true);
 evidence.checks.push('Actual browser recording converted to WAV, real STT populated editable draft; no auto-publication and microphone released.');
 const prompt=transcript+'\nAlso add one camera component at the top of this habit tracker: id scene-camera, type camera, version 1, variant default, fields [], actionIds [], span full, title A view of the world. Preserve every existing field, action and component with the same IDs. Keep the habit list and completion calendar visible. Do not bind record fields to the camera. Only change the skin to sage and add this camera; no schema changes or external tools. Counters that count habits must omit valueField.';
 await draft.fill(prompt);
 const published=page.waitForResponse(r=>r.url().endsWith('/proposals'),{timeout:45000});
 await page.getByRole('button',{name:'Apply changes'}).click();
 const publication=await published,publicationBody=await publication.json();evidence.publication={status:publication.status(),source:publicationBody.proposal?.source,summary:publicationBody.proposal?.summary,error:publicationBody.error};await save();expect(publication.ok()).toBe(true);
 await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeVisible({timeout:30000});
 await expect(viewer.getByText('Only the space owner can start this camera scene. Your camera and microphone are off.')).toBeVisible();
 const after=await snap();expect(after.definition.appSpec.skin).toBe('sage');expect(after.records).toEqual(before.records);expect(page.url()).toBe(`${origin}/s/${slug}`);
 expect(after.definition.entitySchema).toEqual(before.definition.entitySchema);expect(after.definition.appSpec.components.some((c:any)=>c.type==='camera')).toBe(true);
 expect((await inspect(viewer)).calls).toBe(0);evidence.checks.push('Explicit Apply publishes real Gemini camera/sage composition; SSE visitor updates, original record IDs/values/schema/URL remain.');
 evidence.definitionVersion=after.definition.definitionVersion;await save();
 await page.getByRole('button',{name:'Start camera',exact:true}).click();
 await expect(page.getByText('Local preview',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Describe this view',exact:true})).toBeEnabled();
 await expect.poll(()=>page.locator('video').evaluate((v:HTMLVideoElement)=>v.videoWidth)).toBeGreaterThan(0);
 expect((await ledger()).gemini.requests).toBe(29);
 const observed=page.waitForResponse(r=>r.url().endsWith('/observe'),{timeout:65000});
 await page.getByRole('button',{name:'Describe this view',exact:true}).click();
 const response=await observed,result=await response.json();
 evidence.observation={status:response.status(),sequence:result.sequence,text:result.text,visionMs:result.visionMs,speechMs:result.speechMs,audioMimeType:result.audioMimeType,audioBytes:result.audioBase64?Buffer.from(result.audioBase64,'base64').length:0,speechError:result.speechError,error:result.error};await save();expect(response.ok()).toBe(true);expect(result.audioMimeType).toBe('audio/mpeg');
 await expect(page.locator('.camera-description')).toContainText(result.text);
 await expect.poll(async()=>(await inspect(page)).plays).toBeGreaterThan(0);
 await page.screenshot({path:'docs/memory/handoffs/coordinator/LF-185-live-camera.png',fullPage:true});
 await viewer.screenshot({path:'docs/memory/handoffs/coordinator/LF-185-live-visitor.png',fullPage:true});
 await page.getByRole('button',{name:'Stop',exact:true}).click();
 await expect(page.getByText('Camera is off',{exact:true})).toBeVisible();
 evidence.ownerDevices=await inspect(page);evidence.visitorDevices=await inspect(viewer);
 expect(evidence.ownerDevices.tracks.every((t:any)=>t.state==='ended')).toBe(true);expect(evidence.ownerDevices.audio.every((a:any)=>a.paused&&!a.src)).toBe(true);
 expect(evidence.visitorDevices.calls).toBe(0);expect(evidence.visitorDevices.plays).toBe(0);
 expect(await viewer.locator('body').innerText()).not.toContain(result.text);expect((await snap()).records).toEqual(before.records);
 evidence.checks.push('Explicit virtual camera preview, real vision + TTS and actual browser playback; Stop ends tracks/audio, visitor receives no media or description.');
 await page.reload();await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeVisible();expect((await inspect(page)).calls).toBe(0);expect((await snap()).records).toEqual(before.records);
 const limit=await owner.request.post(`${origin}/api/spaces/${slug}/proposals`,{headers:{origin,'x-csrf-token':csrfToken},data:{requestId:randomUUID(),prompt:'Change the skin to rose',baseDefinitionVersion:after.definition.definitionVersion}});
 const limitBody=await limit.json();expect(limit.status()).toBe(503);expect(limitBody.error.code).toBe('FREE_QUOTA_EXHAUSTED');expect((await snap()).definition).toEqual(after.definition);
 evidence.quotaStop={status:limit.status(),code:limitBody.error.code};evidence.checks.push('Reload never reopens sensors; exhausted shared budget fails closed and retains last definition.');
 expect(pageErrors).toEqual([]);evidence.pageErrors=pageErrors;evidence.status='passed';
}catch(error){evidence.status='failed';evidence.failure=(error as Error).message;throw error;}
finally{evidence.after=await ledger();await auth.deleteSession(tokenHash);evidence.temporarySessionRemoved=!(await auth.getSession(tokenHash));await save();await browser.close();await db.close();}
