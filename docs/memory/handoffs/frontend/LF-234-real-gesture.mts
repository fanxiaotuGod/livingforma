import {chromium, expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const origin='http://localhost:4347',slug='space-cef5f3a3',root='docs/memory/handoffs/frontend';
const ids={original:'rec_a8ed2e6a-fcd7-4974-bc3c-90e8ff28b8eb',blue:'rec_f702e59e-69a8-4b19-99cd-e245a38fe5b2',sunset:'rec_7680bdff-a9e1-45cc-9787-19e99fcc44ab'};
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1365,height:1000},reducedMotion:'reduce'});
const evidence:any={at:new Date().toISOString(),auth:'Explicit normal /auth/local Owner test session; not a new Google OAuth claim.',candidate:'Existing real-Pi PhotoDrift published by coordinator; this test performs no source generation or provider calls.',steps:[],pageErrors:[]};
const compact=(snapshot:any)=>({definitionVersion:snapshot.definition.definitionVersion,stateVersion:snapshot.stateVersion,eventCursor:snapshot.eventCursor,records:snapshot.records.map((record:any)=>({id:record.id,values:record.values,version:record.version}))});
try {
 const login=await context.request.post(`${origin}/auth/local`,{headers:{origin},data:{persona:'owner'}});expect(login.status()).toBe(200);
 const snapshot=async()=>{const response=await context.request.get(`${origin}/api/spaces/${slug}/snapshot`);expect(response.status()).toBe(200);return response.json()};
 const before=await snapshot(); evidence.before=compact(before);expect(before.definition.definitionVersion).toBe(2);expect(before.records).toHaveLength(3);
 const record=(state:any,id:string)=>state.records.find((record:any)=>record.id===id);
 expect(record(before,ids.original).values.decision).toBe('favorite');expect(record(before,ids.blue).values.decision).toBe('');expect(record(before,ids.sunset).values.decision).toBe('');
 const page=await context.newPage();page.on('pageerror',error=>evidence.pageErrors.push(error.message));const writes:any[]=[];page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/actions'))writes.push({url:new URL(request.url()).pathname,body:request.postDataJSON()})});
 await page.goto(`${origin}/s/${slug}`);await page.locator('.generated-frame-status [role=status]').filter({hasText:'Website ready'}).waitFor();
 const frame=page.frames().find(frame=>frame.url().includes('/api/generated-frame'))!;
 await page.screenshot({path:`${root}/LF-234-real-gesture-before.png`,fullPage:true});
 async function swipe(id:string,direction:'left'|'right',expected:string){
  const card=frame.locator('.photo-card');await card.waitFor();await card.scrollIntoViewIfNeeded();await expect(card.locator('img')).toHaveJSProperty('complete',true);await expect.poll(()=>card.locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  const bounds=await card.boundingBox();if(!bounds)throw new Error('Card unavailable');const x=bounds.x+bounds.width/2,y=bounds.y+Math.min(160,bounds.height/2),endX=x+(direction==='left'?-180:180);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(endX,y+5,{steps:20});await page.mouse.up();
  await expect.poll(async()=>record(await snapshot(),id).values.decision,{timeout:10000,intervals:[500]}).toBe(expected);
  const after=await snapshot();evidence.steps.push({id,direction,expected,input:'Native Playwright Chrome mouse pointer gesture; no handler/lf/API mutation injection.',coordinates:{x,y,endX},snapshot:compact(after)});
 }
 await swipe(ids.blue,'left','pass');await expect(frame.locator('.photo-caption')).toHaveText('Synthetic sunset');
 await swipe(ids.sunset,'right','favorite');
 const after=await snapshot();evidence.after=compact(after);expect(after.definition.definitionVersion).toBe(before.definition.definitionVersion);expect(after.records).toHaveLength(3);expect(record(after,ids.original)).toEqual(record(before,ids.original));
 for(const id of [ids.blue,ids.sunset]){expect(record(after,id).values.assetId).toBe(record(before,id).values.assetId);expect(record(after,id).version).toBe(record(before,id).version+1)}
 expect(page.url()).toBe(`${origin}/s/${slug}`);await frame.locator('#tab-favorites').click();await expect(frame.locator('.fav-card')).toHaveCount(2);await page.screenshot({path:`${root}/LF-234-real-gesture-after.png`,fullPage:true});evidence.writes=writes;expect(writes).toHaveLength(2);expect(evidence.pageErrors).toHaveLength(0);evidence.passed=true;
} catch(error) {evidence.error=String(error);throw error} finally {evidence.resourcesClosed=true;await context.close();await browser.close();await writeFile(`${root}/LF-234-real-gesture-results.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2))}
