/** LF238: independent ordinary forms, exact hosted candidate replay, actual local QuickJS. */
import {chromium,expect,type Page,type FrameLocator} from '@playwright/test';
import {createServer,type Server} from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildApp} from '../../../apps/api/src/app';
import {createDatabase} from '../../../packages/db/src/index';
import {proposalSchema,type GeneratedArtifact,type SiteGenerator} from '../../../packages/contracts/src/index';
import {renderGeneratedFrame,GENERATED_FRAME_CSP,GENERATED_FRAME_PERMISSIONS} from '../../../apps/api/src/generated-frame';

process.env.NODE_ENV='test';process.env.ENABLE_LOCAL_DEMO='true';
const reportDir=resolve('docs/qa/generated-forms'),origin='http://localhost:4351',slug='qa-serving-studio';
const proposal=proposalSchema.parse(JSON.parse(await readFile(new URL('./serving-studio-proposal.json',import.meta.url),'utf8')));
const expectedHashes={html:'922b6596b8722e6d021fd343f221ece8b8180b261fa189cb4e84449fa5924a2b',css:'a0b4d200ce6c58f45953881ad98b978ccd732e31fc91fe3d2112278c1465c8ac',js:'28bd7bb15c8de6d148d20e1354a4515d9c3d98485f24d5be486fa7cf198a55e2'};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const sourceHashes=Object.fromEntries(Object.entries(expectedHashes).map(([key,value])=>{expect(hash(proposal.appSpec.generated![key as 'html'|'css'|'js'])).toBe(value);return[key,value];}));
const checks:{name:string;status:'passed';details?:unknown}[]=[],errors:string[]=[],posts:string[]=[];
let generatorCalls=0,outbound=0,fixtureServer:Server|undefined,api:Awaited<ReturnType<typeof buildApp>>|undefined;
const directory=await mkdtemp(join(tmpdir(),'lf-qa-forms-'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const owner=await browser.newContext({viewport:{width:1440,height:1080}}),anonymous=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
const page=await owner.newPage(),publicPage=await anonymous.newPage();
for(const tab of[page,publicPage]){tab.setDefaultTimeout(20000);tab.on('pageerror',error=>errors.push(error.message));tab.on('request',request=>{if(request.method()==='POST')posts.push(new URL(request.url()).pathname);});}
const live=(tab=page)=>tab.frameLocator('iframe[title="Generated website"]'),preview=()=>page.frameLocator('iframe[title="Generated website preview"]');
const toolPosts=()=>posts.filter(path=>path.endsWith('/scale_ingredient/invoke')).length;
const actionPosts=()=>posts.filter(path=>path.endsWith('/actions')).length;
async function check(name:string,run:()=>Promise<unknown>){const details=await run();checks.push({name,status:'passed',...(details===undefined?{}:{details})});console.log('PASS',name);}
async function fillRecipe(frame:FrameLocator,quantity='150'){await frame.getByLabel('Ingredient Name',{exact:true}).fill('Flour');await frame.getByLabel('Quantity (grams)',{exact:true}).fill(quantity);await frame.getByLabel('Original Servings',{exact:true}).fill('4');await frame.getByLabel('Target Servings',{exact:true}).fill('6');}
async function steady(){await page.waitForTimeout(80);}
async function noOverflow(tab:Page,frame:FrameLocator){expect(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await frame.locator('body').evaluate(body=>body.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);}
const fixture:GeneratedArtifact={format:'html-v1',bridgeVersion:1,assetIds:[],css:'body{font:16px system-ui}label,button{display:block;margin:12px}',
 html:'<form id="main"><label>Required<input id="required" required value="ready"></label><button id="primary"><span>Submit primary</span></button><button type="button" id="other">Other action</button><button disabled>Disabled action</button><fieldset disabled><button>Disabled fieldset</button></fieldset><button id="cancel">Cancelled action</button><label>Notes<textarea></textarea></label></form><button id="outside" form="main">Outside submit</button><form id="single"><label>Single input<input value="ready"></label></form><form id="multiple"><label>First input<input value="ready"></label><input value="second"></form>',
 js:'(async()=>{await lf.ready;const events=[];document.addEventListener("submit",event=>{events.push({form:event.target.id,submitter:event.submitter?.id??null,bubbles:event.bubbles,cancelable:event.cancelable});event.preventDefault();document.body.dataset.submits=JSON.stringify(events);});document.getElementById("cancel").onclick=event=>event.preventDefault();document.body.dataset.submits="[]";lf.reportReady();})();'};
try{
 await mkdir(reportDir,{recursive:true});
 await check('Ordinary click and input Enter deliver one local event with the actual submitter and no navigation',async()=>{
  fixtureServer=createServer((request,response)=>{response.setHeader('content-type',request.url==='/host.js'?'text/javascript':'text/html');
   if(request.url==='/api/generated-frame'){response.setHeader('Content-Security-Policy',GENERATED_FRAME_CSP);response.setHeader('Permissions-Policy',GENERATED_FRAME_PERMISSIONS);response.end(renderGeneratedFrame(fixture,'qa-local-form-fixture'));}
   else if(request.url==='/host.js')response.end('addEventListener("message",event=>{if(event.data?.type!=="lf:connect")return;const port=event.ports[0];port.onmessage=e=>port.postMessage({id:e.data.id,ok:true,result:{records:[],permissions:{canWrite:false},preview:true}});port.start();});');
   else if(request.url==='/'){response.setHeader('Content-Security-Policy',`default-src 'self';script-src 'self';frame-src http://127.0.0.1:4352/api/generated-frame`);response.end('<script src="/host.js"></script><iframe sandbox="allow-scripts" src="/api/generated-frame"></iframe>');}
   else if(request.url==='/favicon.ico')response.writeHead(204).end();else{outbound++;response.end('Unexpected navigation');}});
  await new Promise<void>(resolve=>fixtureServer!.listen(4352,'127.0.0.1',resolve));await page.goto('http://127.0.0.1:4352/');const frame=page.frameLocator('iframe');await frame.locator('body[data-submits]').waitFor();
  const events=()=>frame.locator('body').getAttribute('data-submits').then(value=>JSON.parse(value!));
  await frame.getByText('Submit primary',{exact:true}).click();await expect.poll(events).toEqual([{form:'main',submitter:'primary',bubbles:true,cancelable:true}]);await steady();expect(await events()).toHaveLength(1);
  await frame.getByLabel('Required',{exact:true}).press('Enter');await expect.poll(events).toHaveLength(2);expect((await events())[1].submitter).toBe('primary');
  await frame.getByRole('button',{name:'Outside submit',exact:true}).click();await expect.poll(events).toHaveLength(3);expect((await events())[2].submitter).toBe('outside');
  expect(await page.locator('iframe').getAttribute('sandbox')).toBe('allow-scripts');expect(GENERATED_FRAME_CSP).toContain("sandbox allow-scripts;");expect(GENERATED_FRAME_CSP).toContain("form-action 'none'");expect(GENERATED_FRAME_CSP).toContain("connect-src 'none'");expect(outbound).toBe(0);
  return{events:await events(),navigationRequests:outbound,fixture:'Auth-free explicitly authored local DOM fixture'};
 });
 await check('Required values, disabled/button controls, cancelled click and textarea retain ordinary behavior',async()=>{
  const frame=page.frameLocator('iframe'),events=()=>frame.locator('body').getAttribute('data-submits').then(value=>JSON.parse(value!));const before=(await events()).length;
  await frame.getByLabel('Required',{exact:true}).fill('');await frame.getByRole('button',{name:'Submit primary',exact:true}).click();await frame.getByLabel('Required',{exact:true}).press('Enter');await steady();expect(await events()).toHaveLength(before);
  expect(await frame.getByLabel('Required',{exact:true}).evaluate(input=>(input as HTMLInputElement).validity.valueMissing)).toBe(true);await frame.getByLabel('Required',{exact:true}).fill('ready');
  for(const name of['Disabled action','Disabled fieldset']){const button=frame.getByRole('button',{name,exact:true});expect(await button.isDisabled()).toBe(true);const box=(await button.boundingBox())!;await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}
  await frame.getByRole('button',{name:'Other action',exact:true}).click();await frame.getByRole('button',{name:'Cancelled action',exact:true}).click();await frame.getByLabel('Notes',{exact:true}).press('Enter');await frame.getByLabel('First input',{exact:true}).press('Enter');await steady();expect(await events()).toHaveLength(before);expect(await frame.getByLabel('Notes',{exact:true}).inputValue()).toBe('\n');
  await frame.getByLabel('Single input',{exact:true}).press('Enter');await expect.poll(events).toHaveLength(before+1);expect((await events()).at(-1)).toEqual({form:'single',submitter:null,bubbles:true,cancelable:true});expect(outbound).toBe(0);
  await page.screenshot({path:join(reportDir,'ordinary-dom.png')});await page.goto('about:blank');await new Promise<void>(resolve=>fixtureServer!.close(()=>resolve()));fixtureServer=undefined;
  return{blockedActivations:7,textarea:'Newline retained',singleInputSubmitter:null,navigationRequests:outbound};
 });
 const generator:SiteGenerator=async()=>{generatorCalls++;return structuredClone(proposal);};
 api=await buildApp({db:await createDatabase({dataDir:directory}),origin,localDemo:true,siteGenerator:generator,staticDir:resolve('apps/web/dist')});await api.app.listen({host:'127.0.0.1',port:4351});
 const auth=await owner.request.post(`${origin}/auth/local`,{headers:{origin},data:{persona:'owner'}});expect(auth.status()).toBe(200);const session=await auth.json();
 const created=await owner.request.post(`${origin}/api/spaces`,{headers:{origin,'x-csrf-token':session.csrfToken},data:{title:'QA replay of real Serving Studio',slug}});expect(created.status()).toBe(201);
 await page.goto(`${origin}/s/${slug}`);await publicPage.goto(`${origin}/s/${slug}`);const retainedUrl=page.url();
 await check('Unmodified actual hosted candidate passes local real host/QuickJS fixtures and read-only browser preview',async()=>{
  await page.getByRole('button',{name:'Open the space designer'}).click();await page.getByRole('textbox',{name:'Describe your website'}).fill('Replay the original already generated Serving Studio candidate; explicitly offline, no model call.');await page.locator('form').filter({has:page.getByRole('textbox',{name:'Describe your website'})}).getByRole('button').click();
  await expect(preview().getByRole('heading',{name:'Serving Studio',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Publish website',exact:true})).toBeEnabled();await fillRecipe(preview());const before=toolPosts();await preview().getByRole('button',{name:'Calculate',exact:true}).click();await expect(preview().locator('#result-value')).toHaveText('Publish required');expect(toolPosts()).toBe(before);
  const rows=await api!.store.db.query<{data:{job:{stage:string;proposal:typeof proposal;toolReports:{report:{ok:boolean;results:unknown[]}}[]}}}>('SELECT data FROM lf_generations');const job=rows.rows[0].data.job;expect(job.stage).toBe('checked');expect(job.proposal.appSpec.generated).toEqual(proposal.appSpec.generated);expect(job.toolReports[0].report.ok).toBe(true);expect(job.toolReports[0].report.results).toHaveLength(2);expect(await api!.store.getCodeTools((await api!.store.getSpace(slug))!.space.id)).toEqual([]);
  await page.getByRole('button',{name:'Publish website',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(live().getByRole('heading',{name:'Serving Studio',exact:true})).toBeVisible();await expect(live(publicPage).getByRole('heading',{name:'Serving Studio',exact:true})).toBeVisible();
  const state=(await api!.store.getSpace(slug))!,registered=(await api!.store.getCodeTools(state.space.id))[0];expect(state.definition!.appSpec.generated).toEqual(proposal.appSpec.generated);expect(registered.spec).toEqual(proposal.codeToolProposals![0]);expect(registered.invocationCount).toBe(0);return{originalBrowserSourceSHA256:sourceHashes,originalToolSourceSHA256:hash(registered.spec.source),actualFixtureResults:registered.testReport.results};
 });
 await check('Actual candidate required/min constraints block requests and disabled Save cannot act',async()=>{
  const before=toolPosts();await fillRecipe(live());await live().getByLabel('Ingredient Name',{exact:true}).fill('');await live().getByRole('button',{name:'Calculate',exact:true}).click();await steady();expect(toolPosts()).toBe(before);
  await live().getByLabel('Ingredient Name',{exact:true}).fill('Flour');await live().getByLabel('Original Servings',{exact:true}).fill('0');await live().getByRole('button',{name:'Calculate',exact:true}).click();await live().getByLabel('Original Servings',{exact:true}).press('Enter');await steady();expect(toolPosts()).toBe(before);expect(await live().getByRole('button',{name:'Save Result',exact:true}).isDisabled()).toBe(true);
  const save=(await live().getByRole('button',{name:'Save Result',exact:true}).boundingBox())!;const actions=actionPosts();await page.mouse.click(save.x+save.width/2,save.y+save.height/2);await steady();expect(actionPosts()).toBe(actions);return{toolPOSTs:0,recordPOSTs:0};
 });
 await check('Real Calculate click invokes exactly one QuickJS tool and Save persists225 without another submit',async()=>{
  await fillRecipe(live());const before=toolPosts();await live().getByRole('button',{name:'Calculate',exact:true}).click();await expect(live().locator('#result-value')).toHaveText('225 g');await steady();expect(toolPosts()-before).toBe(1);
  const state=(await api!.store.getSpace(slug))!,tool=(await api!.store.getCodeTools(state.space.id))[0];expect(tool.invocationCount).toBe(1);expect(tool.spec.source).toBe(proposal.codeToolProposals![0].source);const actions=actionPosts();await live().getByRole('button',{name:'Save Result',exact:true}).click();await expect(live().locator('#saved-list-container')).toContainText('225g');await expect(live(publicPage).locator('#saved-list-container')).toContainText('225g');expect(actionPosts()-actions).toBe(1);expect(toolPosts()-before).toBe(1);
  const saved=(await api!.store.getSpace(slug))!.records;expect(saved).toHaveLength(1);expect(saved[0].values).toEqual({ingredient:'Flour',quantity:150,original:4,target:6,scaled:225});await page.screenshot({path:join(reportDir,'saved-225-desktop.png')});await publicPage.screenshot({path:join(reportDir,'saved-225-anonymous-phone.png')});return{toolPOSTs:1,recordPOSTs:1,record:saved[0]};
 });
 await check('Real input Enter invokes once for a fresh input, and reload retains source records and URL',async()=>{
  await fillRecipe(live(),'160');const before=toolPosts();await live().getByLabel('Target Servings',{exact:true}).press('Enter');await expect(live().locator('#result-value')).toHaveText('240 g');await steady();expect(toolPosts()-before).toBe(1);
  const saved=structuredClone((await api!.store.getSpace(slug))!.records);await page.reload();await expect(live().locator('#saved-list-container')).toContainText('225g');expect(page.url()).toBe(retainedUrl);expect((await api!.store.getSpace(slug))!.records).toEqual(saved);expect((await api!.store.getSpace(slug))!.definition!.appSpec.generated).toEqual(proposal.appSpec.generated);
  await page.setViewportSize({width:390,height:844});await noOverflow(page,live());await noOverflow(publicPage,live(publicPage));await page.screenshot({path:join(reportDir,'saved-225-owner-phone.png')});await page.setViewportSize({width:1440,height:1080});return{input:{quantity:160,originalServings:4,targetServings:6},actualResult:240,toolPOSTs:1,retainedRecords:saved.length};
 });
 await check('Identity change discards a completed tool response delayed only in local transport',async()=>{
  let received=false,release!:(()=>void);const before=toolPosts();await owner.route(`**/api/spaces/${slug}/code-tools/scale_ingredient/invoke`,async route=>{const response=await route.fetch();expect(response.status()).toBe(200);received=true;await new Promise<void>(resolve=>release=resolve);await route.fulfill({response}).catch(()=>{});});
  try{await fillRecipe(live(),'170');await live().getByRole('button',{name:'Calculate',exact:true}).click();await expect.poll(()=>received).toBe(true);expect((await api!.store.getCodeTools((await api!.store.getSpace(slug))!.space.id))[0].invocationCount).toBe(3);await owner.request.post(`${origin}/auth/local`,{headers:{origin},data:{persona:'participant'}});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('button',{name:'Open the space designer'})).toHaveCount(0);release();await expect(page.locator('.generated-frame-status [role=status]')).toHaveText('Website ready');await fillRecipe(live());await live().getByRole('button',{name:'Calculate',exact:true}).click();await expect(live().locator('#result-value')).toHaveText('Publish required');await steady();expect(toolPosts()-before).toBe(1);expect(await page.getByText('Tool completed.',{exact:false}).count()).toBe(0);expect((await api!.store.getSpace(slug))!.records).toHaveLength(1);
  }finally{release?.();await owner.unroute(`**/api/spaces/${slug}/code-tools/scale_ingredient/invoke`);}
  return{serverInvocation:'Completed QuickJS before account change',delayedTransport:'Explicit offline fixture',lateResult:'Discarded',participantToolPOSTs:0};
 });
 expect(errors).toEqual([]);expect(generatorCalls).toBe(1);await writeFile(join(reportDir,'results.json'),JSON.stringify({at:new Date().toISOString(),scope:'Independent installed Chrome, real host/PGlite/SSE/opaque frame/MessageChannel and actual QuickJS. The hosted AI candidate is copied unchanged and replayed by an explicit offline SiteGenerator; local identity is a test fixture. No new model, Google, Neon or production mutation.',originalSource:{publicURL:'https://livingforma.tech/s/space-ee2617ac',release:'22f78d2d977049c0c8193705ca6194fed58c3a25',sourceRevision:1,hashes:sourceHashes},checks,offlineReplayCalls:generatorCalls,protectedPOSTs:posts,pageerrors:errors},null,2)+'\n');
}catch(error){await writeFile(join(reportDir,`failed-${Date.now()}.json`),JSON.stringify({at:new Date().toISOString(),error:String(error),checks,errors,posts,frames:await Promise.all(page.frames().filter(frame=>frame.parentFrame()).map(async frame=>({url:frame.url(),body:await frame.locator('body').innerText().catch(()=>'(detached)')})))},null,2));await page.screenshot({path:join(reportDir,`failed-${Date.now()}.png`),fullPage:true}).catch(()=>{});throw error;
}finally{await owner.close();await anonymous.close();await browser.close();if(fixtureServer)await new Promise<void>(resolve=>fixtureServer!.close(()=>resolve()));await api?.app.close();await rm(directory,{recursive:true,force:true});}
