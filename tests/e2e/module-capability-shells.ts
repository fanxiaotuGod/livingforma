/** Render actual CameraScene and ToolResult in a separate local PGlite server.
 * Camera is never started. Tool metadata/test are explicit local fixtures;
 * transcribe/describe/speak/invoke throw if accidentally requested.
 */
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../../apps/api/src/app';
import {createDatabase} from '../../packages/db/src/index';
import {toolSpecSchema,componentSchema,type ToolAdapter,type MediaAdapter,type Snapshot} from '../../packages/contracts/src/index';
const origin='http://localhost:4319',out='docs/qa/module-expansion';await mkdir(out,{recursive:true});process.env.ENABLE_LOCAL_DEMO='true';process.env.NODE_ENV='test';
let toolCalls=0,mediaCalls=0;
const tools:ToolAdapter={validate:x=>toolSpecSchema.parse(x),test:async()=>({ok:true,message:'Local metadata fixture only'}),invoke:async()=>{toolCalls++;throw new Error('No tool invocation authorized by this layout test.');}};
const media:MediaAdapter={capabilities:()=>({canObserve:true,canTranscribe:true,canSpeak:true}),transcribe:async()=>{mediaCalls++;throw new Error('No provider call authorized.');},describe:async()=>{mediaCalls++;throw new Error('No provider call authorized.');},speak:async()=>{mediaCalls++;throw new Error('No provider call authorized.');}};
const app=await buildApp({db:await createDatabase(),origin,localDemo:true,tools,media,staticDir:resolve('apps/web/dist')});await app.app.listen({host:'127.0.0.1',port:4319});
const browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'}),page=await ctx.newPage();
const errors:string[]=[],results:Record<string,unknown>[]=[],mediaStarts:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/media/sessions'))mediaStarts.push(r.method()+' '+r.url());});
try{
  const login=await ctx.request.post(`${origin}/auth/local`,{headers:{origin},data:{persona:'owner'}});expect(login.status()).toBe(200);const csrf=(await login.json()).csrfToken,headers={origin,'x-csrf-token':csrf};
  const spec=toolSpecSchema.parse({toolId:'qa-query',toolVersion:1,name:'Look up fixture records',description:'Explicit local metadata fixture; never invoked',endpointId:'fixture',method:'GET',sideEffects:'none',parameters:[{name:'search',type:'string',required:true},{name:'year',type:'number',required:false}],responseMap:{title:'title'},timeoutMs:1000});
  const registered=await ctx.request.post(`${origin}/api/spaces/reading/tools`,{headers,data:{spec,enable:true}});expect(registered.status(),await registered.text()).toBe(200);
  const current=await (await ctx.request.get(`${origin}/api/spaces/reading/snapshot`)).json() as Snapshot;
  const components=[componentSchema.parse({id:'qa-camera',type:'camera',version:1,size:{columns:3}}),componentSchema.parse({id:'qa-query',type:'tool-result',version:1,size:{columns:3},toolRef:{toolId:'qa-query',toolVersion:1}})];
  const published=await ctx.request.post(`${origin}/api/spaces/reading/presentation`,{headers,data:{requestId:randomUUID(),baseDefinitionVersion:current.definition!.definitionVersion,components}});expect(published.status(),await published.text()).toBe(200);
  for(const width of [320,1440]){
    await page.setViewportSize({width,height:960});await page.goto(`${origin}/s/reading`,{waitUntil:'domcontentloaded'});const camera=page.locator('[data-module-type="camera"]'),tool=page.locator('[data-module-type="tool-result"]');await expect(camera.getByRole('button',{name:'Start camera',exact:true})).toBeEnabled();await expect(tool.getByRole('button',{name:'Look up fixture records',exact:false})).toBeEnabled();
    const geometry=await camera.locator('.camera-preview').evaluate(el=>{const r=el.getBoundingClientRect(),f=el.closest('[data-module-type]')!.getBoundingClientRect();return {preview:{width:r.width,height:r.height,top:r.top,bottom:r.bottom,contained:r.left>=f.left&&r.right<=f.right},children:[...el.querySelectorAll('.camera-preview-empty>svg,.camera-preview-empty>h3,.camera-preview-empty>p')].map(c=>{const b=c.getBoundingClientRect();return {tag:c.tagName,text:c.textContent,top:b.top,bottom:b.bottom,height:b.height,clipped:b.top<r.top||b.bottom>r.bottom||b.left<r.left||b.right>r.right};})};});
    const documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);const pass=documentWidth===width&&geometry.preview.contained&&!geometry.children.some(c=>c.clipped||c.height<1);results.push({type:'camera',width,status:pass?'pass':'fail',documentWidth,geometry});console.log(pass?'PASS':'FAIL','actual camera shell',width,JSON.stringify(geometry));
    const toolGeometry=await tool.evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,controls:[...el.querySelectorAll('input,button')].map(c=>{const b=c.getBoundingClientRect();return {tag:c.tagName,width:b.width,height:b.height,contained:b.left>=r.left&&b.right<=r.right&&b.width>0&&b.height>0};})};});const toolPass=documentWidth===width&&toolGeometry.controls.every(c=>c.contained);results.push({type:'tool-result',width,status:toolPass?'pass':'fail',documentWidth,geometry:toolGeometry});console.log(toolPass?'PASS':'FAIL','actual tool shell',width);
    await camera.screenshot({path:`${out}/actual-camera-${width}.png`});await tool.screenshot({path:`${out}/actual-tool-${width}.png`});
  }
  expect(mediaStarts).toEqual([]);expect(mediaCalls).toBe(0);expect(toolCalls).toBe(0);expect(errors).toEqual([]);
}finally{await writeFile(`${out}/capability-shells.json`,JSON.stringify({at:new Date().toISOString(),scope:'Actual CameraScene and ToolResult on separate4319 local PGlite; fixture capabilities and enabled tool metadata only; zero device starts/provider/tool invokes',results,mediaStarts,mediaCalls,toolCalls,errors},null,2));await browser.close();await app.app.close();}
if(results.some(r=>r.status==='fail')||errors.length||mediaCalls||toolCalls||mediaStarts.length)process.exitCode=1;
