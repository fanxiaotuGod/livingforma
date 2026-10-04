// Run from repository root. Offline fixtures only; no API, provider, or business writes.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root=process.cwd(), load=p=>import(pathToFileURL(`${root}/${p}`).href);
const {createServer}=await load('apps/web/node_modules/vite/dist/node/index.js');
const {createElement}=await load('apps/web/node_modules/react/index.js');
const {renderToStaticMarkup}=await load('apps/web/node_modules/react-dom/server.node.js');
const {chromium}=await load('node_modules/@playwright/test/index.mjs');
const prefix=`${root}/docs/memory/handoffs/frontend/LF-201-31e546d8`;
const server=await createServer({configFile:false,root:`${root}/apps/web`,server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]},ssr:{noExternal:['@livingforma/contracts']}});
let browser;
try {
 const {collectionModules,collectionCsvCell,collectionExportRows}=await server.ssrLoadModule('/src/modules/collections.tsx');
 const columns=[{id:'title',label:'Title',type:'text'},{id:'actual',label:'Actual',type:'number'},{id:'budget',label:'Budget',type:'number'},{id:'date',label:'Date',type:'date'},{id:'dates',label:'Dates',type:'dates'},{id:'group',label:'Category',type:'enum',options:['Work','Home']},{id:'done',label:'Done',type:'boolean'}];
 const rows=[{id:'1',version:1,values:{title:'Alpha work stream',actual:20,budget:40,date:'2026-10-03',dates:['2026-10-03'],group:'Work',done:true,secret:'MUST NOT EXPORT'}},{id:'2',version:1,values:{title:'Beta longer record with details',actual:40,budget:30,date:'2026-10-05',dates:[],group:'Home',done:false}},{id:'3',version:1,values:{title:'Unbroken'.repeat(12),date:'2026-99-99'}}];
 const snapshot={space:{timezone:'America/Vancouver'},records:rows,permissions:{canWrite:false,actionIds:[]},definition:{entitySchema:{fields:columns},appSpec:{actions:[]}}};
 const rendered=[],checks=[],layouts=[];
 for(const [type,Component] of Object.entries(collectionModules)) {
  const spec={id:type,type,fields:columns.map(f=>f.id),dateField:type==='habit-matrix'?'dates':'date',valueField:'actual',groupBy:'group',actionIds:[],config:{target:50}};
  const props={snapshot,spec,mutate:()=>{throw Error('Unexpected mutation')},onLogin:()=>{},onSelect:()=>{},csrf:null};
  const html=renderToStaticMarkup(createElement(Component,props));assert.ok(html.length>50,type);assert.ok(!html.includes('NaN'),type);
  for(const emptySnapshot of [{...snapshot,records:[]},{...snapshot,definition:{entitySchema:{fields:[]},appSpec:{actions:[]}}}])assert.ok(renderToStaticMarkup(createElement(Component,{...props,snapshot:emptySnapshot})).length>20,type);
  rendered.push({type,html});
 }
 assert.equal(rendered.length,16);checks.push('16 renderers × populated, empty, missing-binding states; malformed dates ignored');
 for(const input of ['=SUM(A1:A2)',' +cmd','-1','@SUM(A1)','\t=1','\n=2'])assert.ok(collectionCsvCell(input).startsWith('"\''),input);
 assert.equal(collectionCsvCell('normal "quoted"'),'"normal ""quoted"""');assert.equal(collectionCsvCell(null),'""');
 assert.deepEqual(collectionExportRows(rows,[columns[0]]),rows.map(r=>({title:r.values.title})));checks.push('CSV formula/control-prefix neutralization, quote escaping, selected-column-only JSON');
 const base=await readFile(`${root}/apps/web/src/styles.css`,'utf8'), own=await readFile(`${root}/apps/web/src/modules/collections.css`,'utf8');
 const runtime=await readFile(`${root}/apps/web/src/modules/runtime.css`,'utf8').catch(()=>'.module-stack{display:grid;gap:14px}.module-row{display:flex;flex-wrap:wrap;gap:8px}.module-hint{font-size:12px;color:var(--muted)}.module-field{display:grid;gap:8px;font-size:12px}.module-field input{max-width:100%;min-width:0;height:40px}.module-button{min-height:40px;padding:8px 12px;background:var(--accent-soft);border-radius:8px}');
 browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({reducedMotion:'reduce'}), errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [width,moduleWidth] of [[320,288],[390,358],[1440,280],[1440,1100]]) {
  await page.setViewportSize({width,height:1000});
  await page.setContent(`<style>${base}\n${runtime}\n${own}\nbody{padding:16px}.fixture-frame{container:module / inline-size;width:${moduleWidth}px;max-width:100%;min-width:0;margin-bottom:30px;padding:16px;background:var(--paper);border:1px solid var(--line);border-radius:14px}.fixture-frame>h2{font-size:18px;overflow-wrap:anywhere}</style>${rendered.map(r=>`<section class="fixture-frame" data-type="${r.type}"><h2>${r.type}</h2>${r.html}</section>`).join('')}`);
  const measure=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,overflow:[...document.querySelectorAll('.fixture-frame')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>({type:e.dataset.type,width:e.clientWidth,scroll:e.scrollWidth}))}));
  assert.ok(measure.page<=width,JSON.stringify(measure));assert.equal(measure.overflow.length,0,JSON.stringify(measure));layouts.push({width,moduleWidth,...measure});
  const summary=page.locator('[data-type="record-accordion"] summary').first();await summary.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-type="record-accordion"] details').first().getAttribute('open'),'');
  if(width===320)await page.locator('[data-type="priority-matrix"]').screenshot({path:`${prefix}-mobile.png`});
  if(moduleWidth===1100)await page.locator('[data-type="week-board"]').screenshot({path:`${prefix}-desktop.png`});
 }
 assert.deepEqual(errors,[]);checks.push('All 16 modules contain overflow at 320px/390px and 280px/1100px desktop containers, including long unbroken text');checks.push('Native accordion opens with Enter in all four widths');
 const evidence={date:new Date().toISOString(),scope:'Offline synthetic fixtures, SSR/static browser layout only; no API/provider calls. Dynamic React interactions and integrated layout persistence are verified separately.',checks,layouts,errors};await writeFile(`${prefix}-evidence.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
} finally {await browser?.close();await server.close();}
