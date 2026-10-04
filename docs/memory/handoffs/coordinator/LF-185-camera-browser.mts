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

if(process.env.RUN_LIVE_CAMERA !== 'yes') throw new Error('Set RUN_LIVE_CAMERA=yes only after reviewing the remaining shared allowance.');
process.loadEnvFile('.env');
const origin='http://localhost:5173', slug='space-3c242042';
const expectStop=process.env.EXPECT_QUOTA_STOP==='yes';
const out=`docs/memory/handoffs/coordinator/LF-185-camera-${expectStop?'quota':'live'}-evidence.json`;
const evidence:any={at:new Date().toISOString(),scope:'Real localhost UI/API, Neon, Gemini and ElevenLabs. Virtual devices and temporary server test session; Google separately verified in LF150.',checks:[]};
const db=await createDatabase({url:process.env.DATABASE_URL}),store=new Store(db),auth=createAuthStore(store);
const before=await store.getSpace(slug);if(!before?.definition)throw new Error('Missing live habit space');
const ledger=async()=>({gemini:(await db.query<any>('SELECT data FROM lf_provider_budgets WHERE provider=$1',['gemini'])).rows[0]?.data,media:(await db.query<any>('SELECT bucket,period,data FROM lf_media_budgets ORDER BY bucket')).rows});
evidence.before=await ledger();
if(expectStop ? evidence.before.gemini.requests!==30 || evidence.before.gemini.day!==new Date().toISOString().slice(0,10) : evidence.before.gemini.day===new Date().toISOString().slice(0,10)&&evidence.before.gemini.requests>=30)throw new Error('Review the natural daily allowance before running. No quota reset is permitted.');
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
 await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeVisible();
 await expect(viewer.getByText('Only the space owner can start this camera scene. Your camera and microphone are off.')).toBeVisible();
 expect((await snap()).definition.definitionVersion).toBe(2);expect((await snap()).records).toEqual(before.records);
 evidence.published={version:2,skin:before.definition.appSpec.skin,componentTypes:before.definition.appSpec.components.map(c=>c.type),schema:before.definition.entitySchema,records:before.records};
 evidence.checks.push('Previously submitted voice draft is durably published as v2; Owner and independent visitor render camera while retaining habit schema/records.');
 await page.getByRole('button',{name:'Start camera',exact:true}).click();
 await expect(page.getByText('Local preview',{exact:true})).toBeVisible();
 await expect.poll(()=>page.locator('video').evaluate((v:HTMLVideoElement)=>v.videoWidth)).toBeGreaterThan(0);
 const observed=page.waitForResponse(r=>r.url().endsWith('/observe'),{timeout:65000});
 await page.getByRole('button',{name:'Describe this view',exact:true}).click();
 const response=await observed,result=await response.json();
 evidence.observation={status:response.status(),text:result.text,visionMs:result.visionMs,speechMs:result.speechMs,audioBytes:result.audioBase64?Buffer.from(result.audioBase64,'base64').length:0,error:result.error,speechError:result.speechError};await save();
 if(expectStop){expect(response.status()).toBe(503);expect(result.error.code).toBe('FREE_QUOTA_EXHAUSTED');await expect(page.getByRole('alert')).toContainText('No paid fallback');evidence.checks.push('Exhausted durable quota blocks observation before any new provider request; explicit preview stays controllable.');}
 else{expect(response.ok()).toBe(true);expect(result.audioMimeType).toBe('audio/mpeg');await expect(page.locator('.camera-description')).toContainText(result.text);await expect.poll(async()=>(await inspect(page)).plays).toBeGreaterThan(0);evidence.checks.push('Actual virtual-camera JPEG passes API to real Gemini, real ElevenLabs TTS returns, and browser audio playback starts.');}
 await page.screenshot({path:`docs/memory/handoffs/coordinator/LF-185-camera-${expectStop?'quota':'live'}.png`,fullPage:true});
 await viewer.screenshot({path:'docs/memory/handoffs/coordinator/LF-185-camera-visitor.png',fullPage:true});
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.getByText('Camera is off',{exact:true})).toBeVisible();
 evidence.ownerDevices=await inspect(page);evidence.visitorDevices=await inspect(viewer);
 expect(evidence.ownerDevices.tracks.every((t:any)=>t.state==='ended')).toBe(true);expect(evidence.ownerDevices.audio.every((a:any)=>a.paused&&!a.src)).toBe(true);expect(evidence.visitorDevices.calls).toBe(0);expect(evidence.visitorDevices.plays).toBe(0);
 if(result.text)expect(await viewer.locator('body').innerText()).not.toContain(result.text);
 await page.getByRole('link',{name:'Reading Journal',exact:true}).click();await expect(page.getByRole('heading',{level:1})).toContainText('Reading');
 await page.getByRole('link',{name:'Small Rituals',exact:true}).click();await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeVisible();expect((await snap()).records).toEqual(before.records);
 await page.reload();await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeVisible();expect((await inspect(page)).calls).toBe(0);
 evidence.checks.push('Stop ends all local tracks/audio; visitor never starts sensors or receives description; switching spaces and reload preserve business data with camera off.');
 expect(pageErrors).toEqual([]);evidence.pageErrors=pageErrors;evidence.status='passed';
} catch(error){evidence.status='failed';evidence.failure=(error as Error).message;throw error;}
finally{evidence.after=await ledger();await auth.deleteSession(tokenHash);evidence.temporarySessionRemoved=!(await auth.getSession(tokenHash));await save();await browser.close();await db.close();}
