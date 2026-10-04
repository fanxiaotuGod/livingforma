import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='docs/qa/module-expansion';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const cases=[{type:'form',variant:'compact',selector:'.field input'},{type:'calendar-grid',variant:'compact',selector:'.calendar'},{type:'kanban',variant:'compact',selector:'.kanban-column'},{type:'detail',variant:'hero',selector:'.detail-summary'}];
const results:Record<string,unknown>[]=[],errors:string[]=[];
try{for(const width of [320,1440]){
  const ctx=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const item of cases){try{
    await page.goto(`http://localhost:5173/modules?type=${item.type}&columns=3`,{waitUntil:'networkidle'});const frame=page.locator(`[data-module-type="${item.type}"]`);await expect(frame).toBeVisible();
    const before=await frame.locator(item.selector).first().evaluate(el=>({padding:getComputedStyle(el).padding,minHeight:getComputedStyle(el).minHeight,background:getComputedStyle(el).backgroundColor}));
    await page.getByRole('button',{name:'Customize layout',exact:true}).click();await frame.getByRole('button',{name:/^Configure/}).click();await frame.getByRole('combobox',{name:'Module appearance',exact:true}).selectOption(item.variant);await frame.getByRole('button',{name:/^Configure/}).click();
    const after=await frame.locator(item.selector).first().evaluate(el=>({padding:getComputedStyle(el).padding,minHeight:getComputedStyle(el).minHeight,background:getComputedStyle(el).backgroundColor}));expect(after).not.toEqual(before);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await frame.screenshot({path:`${out}/variant-${item.type}-${width}.png`});results.push({type:item.type,variant:item.variant,viewport:width,status:'pass',before,after});console.log('PASS',item.type,item.variant,width);
  }catch(e){results.push({type:item.type,variant:item.variant,viewport:width,status:'fail',error:(e as Error).message});console.log('FAIL',item.type,item.variant,width,(e as Error).message);}}
  await ctx.close();
}}finally{await browser.close();await writeFile(`${out}/variants.json`,JSON.stringify({at:new Date().toISOString(),scope:'Real CSS behavior, mobile320 + desktop1440 with3-column containers',results,errors},null,2));}
if(results.some(r=>r.status==='fail')||errors.length)process.exitCode=1;
