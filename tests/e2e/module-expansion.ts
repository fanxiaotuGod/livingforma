/** LF204 independent Chromium geometry/render matrix. Uses local gallery sample data only.
 * Run: pnpm exec tsx tests/e2e/module-expansion.ts
 * Optional MODULE_QA_TYPES / MODULE_QA_VARIANTS comma-separated filters for defect retests.
 */
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {COMPONENT_MANIFESTS} from '../../packages/contracts/src/index';

const origin='http://localhost:5173',out='docs/qa/module-expansion';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const variants=[{name:'mobile320',width:320},{name:'mobile390',width:390},{name:'tablet768',width:768},{name:'desktop1440',width:1440},{name:'narrow1440',width:1440,columns:3}];
const selected=variants.filter(v=>!process.env.MODULE_QA_VARIANTS||process.env.MODULE_QA_VARIANTS.split(',').includes(v.name));
const modules=COMPONENT_MANIFESTS.filter(m=>!process.env.MODULE_QA_TYPES||process.env.MODULE_QA_TYPES.split(',').includes(m.id));
const results:Record<string,unknown>[]=[],errors:{type:string;variant:string;error:string}[]=[];
try{
  for(const variant of selected){
    const ctx=await browser.newContext({viewport:{width:variant.width,height:960},reducedMotion:'reduce'});
    // tsx/esbuild marks named closures; supply its harmless helper in the browser
    // for serialized geometry callbacks (not part of the application runtime).
    await ctx.addInitScript('window.__name = fn => fn;');
    const page=await ctx.newPage();page.setDefaultTimeout(10_000);let current='';
    page.on('pageerror',e=>errors.push({type:current,variant:variant.name,error:e.message}));
    for(const module of modules){
      current=module.id;const errorStart=errors.length;
      try{
        await page.goto(`${origin}/modules?type=${module.id}${variant.columns?`&columns=${variant.columns}`:''}`,{waitUntil:'networkidle'});
        const frame=page.locator(`[data-module-type="${module.id}"]`);await expect(frame).toHaveCount(1);await expect(frame).toBeVisible();
        await expect(frame.locator('.module-content')).not.toBeEmpty();
        const geometry=await frame.evaluate(root=>{
          const r=root.getBoundingClientRect();
          const visible=(el:Element)=>{const s=getComputedStyle(el),b=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&b.width>1&&b.height>1&&!el.closest('.sr-only')};
          const scrollContainer=(el:Element)=>{for(let p=el.parentElement;p&&p!==root;p=p.parentElement){if(['auto','scroll'].includes(getComputedStyle(p).overflowX))return true;}return false};
          const escaped=[...root.querySelectorAll('.module-content *')].filter(el=>visible(el)&&!scrollContainer(el)&&el.getBoundingClientRect().right>r.right+1).map(el=>({tag:el.tagName,className:el.getAttribute('class'),right:Math.round(el.getBoundingClientRect().right),text:el.textContent?.trim().slice(0,90)}));
          const clipped=[...root.querySelectorAll<HTMLElement>('.module-content button,.module-content p,.module-content h2,.module-content h3,.module-content output,.module-content label')].filter(el=>visible(el)&&!scrollContainer(el)&&el.clientWidth>0&&el.scrollWidth>el.clientWidth+2&&['hidden','clip'].includes(getComputedStyle(el).overflowX)).map(el=>({tag:el.tagName,className:el.className,scroll:el.scrollWidth,width:el.clientWidth,text:el.innerText.slice(0,90)}));
          return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,moduleWidth:Math.round(r.width),moduleRight:Math.round(r.right),escaped:escaped.slice(0,8),clipped:clipped.slice(0,8),text:root.querySelector('.module-content')?.textContent?.slice(0,150)};
        });
        const pass=geometry.documentWidth<=variant.width+1&&!geometry.escaped.length&&!geometry.clipped.length&&errors.length===errorStart;
        results.push({type:module.id,variant:variant.name,status:pass?'pass':'fail',geometry});
        if(!pass){console.log('FAIL',module.id,variant.name,JSON.stringify(geometry));await frame.screenshot({path:`${out}/defect-${module.id}-${variant.name}.png`});}
      }catch(e){results.push({type:module.id,variant:variant.name,status:'fail',error:(e as Error).message});console.log('FAIL',module.id,variant.name,(e as Error).message.split('\n')[0]);}
    }
    console.log('MATRIX',variant.name,results.filter(r=>r.variant===variant.name&&r.status==='pass').length,'/',modules.length);
    await writeFile(`${out}/matrix${process.env.MODULE_QA_TYPES||process.env.MODULE_QA_VARIANTS?'-retest':''}.json`,JSON.stringify({at:new Date().toISOString(),scope:'Chromium local sample gallery. Camera/tool-result are explicit device/service placeholders, not real provider verification.',results,errors},null,2));
    await ctx.close();
  }
}finally{await browser.close();}
console.log('TOTAL',results.filter(r=>r.status==='pass').length,'/',results.length,'pageErrors',errors.length);
if(results.some(r=>r.status==='fail')||errors.length)process.exitCode=1;
