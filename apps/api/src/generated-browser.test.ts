import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { chromium, type Browser } from '@playwright/test';
import type { GeneratedArtifact } from '@livingforma/contracts';
import { GENERATED_FRAME_CSP, GENERATED_FRAME_PERMISSIONS, renderGeneratedFrame } from './generated-frame';

let browser:Browser,server:Server,origin:string;
let outbound=0;
let source:GeneratedArtifact={format:'html-v1',bridgeVersion:1,html:'<main><h1>Sandbox fixture</h1><div id="work"></div></main>',css:'body{font:16px system-ui}',js:'',assetIds:[]};
beforeAll(async()=>{
  server=createServer((request,response)=>{
    response.setHeader('Content-Type',request.url==='/host.js'?'text/javascript':'text/html');
    if(request.url?.startsWith('/api/generated-frame')){response.setHeader('Content-Security-Policy',GENERATED_FRAME_CSP);response.setHeader('Permissions-Policy',GENERATED_FRAME_PERMISSIONS);response.end(renderGeneratedFrame(source,'browser-audit-1234'));}
    else if(request.url==='/host.js')response.end(`window.audit={origins:[],reports:[]};addEventListener('message',event=>{if(event.data?.type!=='lf:connect')return;audit.origins.push(event.origin);const port=event.ports[0];port.onmessage=e=>{audit.reports.push(e.data);port.postMessage({id:e.data.id,ok:true,result:{records:[],schema:{fields:[]},actions:[],role:'visitor',permissions:{canWrite:false},preview:true}})};port.start()});`);
    else if(request.url==='/'){response.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self'; frame-src ${origin}/api/generated-frame`);response.end('<script src="/host.js"></script><iframe src="/api/generated-frame" sandbox="allow-scripts"></iframe>');}
    else if(request.url==='/favicon.ico')response.writeHead(204).end();
    else {outbound++;response.end('Unexpected receiver request');}
  });await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  browser=await chromium.launch({channel:'chrome',headless:true});
},30000);
afterAll(async()=>{await browser?.close();await new Promise<void>(resolve=>server?.close(()=>resolve()));});

it('runs normal DOM interaction and bridge in an opaque frame with Trusted Types',async()=>{
  source.js=`(async()=>{const state=await lf.ready;const work=document.getElementById('work');work.innerHTML='<button id="count">Count 0</button><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';let count=0;document.getElementById('count').onclick=()=>document.getElementById('count').textContent='Count '+(++count);document.body.dataset.records=String(state.records.length);lf.reportReady();})();`;
  const page=await browser.newPage();try{await page.goto(origin);const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'Count 0'}).click();expect(await frame.getByRole('button',{name:'Count 1'}).count()).toBe(1);expect(await frame.locator('circle').count()).toBe(1);expect(await frame.locator('body').getAttribute('data-records')).toBe('0');expect(await page.evaluate(()=> (window as unknown as {audit:{origins:string[]}}).audit.origins)).toEqual(['null']);}finally{await page.close();}
});

it('blocks fresh-realm srcdoc, HTML sinks, script/event sinks and private policy recovery',async()=>{
  // Deliberately bypass source validation to exercise the actual browser containment.
  source.js=`const result={};const check=(name,fn)=>{try{result[name]=fn()}catch(error){result[name]='blocked:'+error.name}};
  check('cookie',()=>document.cookie);check('storage',()=>globalThis['local'+'Storage'].length);check('rtc',()=>new globalThis['RTC'+'PeerConnection']());
  check('inner',()=>{const d=document.createElement('div');d.innerHTML='<iframe></iframe>';return d.querySelector('iframe')?'UNSAFE':'removed'});
  check('srcdoc',()=>{const d=document.createElement('div');d.innerHTML='<iframe></iframe>';const f=d.firstChild;f.srcdoc='<script>parent.postMessage({unsafe:true},"*")<'+ '/script>';document.body.appendChild(d);return 'UNSAFE'});
  check('parser',()=>new DOMParser().parseFromString('<iframe srcdoc="bad"></iframe>','text/html').querySelector('iframe')?'UNSAFE':'removed');
  check('range',()=>document.createRange().createContextualFragment('<iframe></iframe>').querySelector('iframe')?'UNSAFE':'removed');
  check('unsafeHTML',()=>{const d=document.createElement('div');if(!d.setHTMLUnsafe)return 'unsupported';d.setHTMLUnsafe('<iframe></iframe>');return d.querySelector('iframe')?'UNSAFE':'removed'});
  check('template',()=>{const d=document.createElement('div');d.innerHTML='<template><iframe></iframe><svg><foreignObject><iframe/></foreignObject></svg></template>';return d.querySelector('template').content.querySelector('iframe,foreignObject')?'UNSAFE':'removed'});
  check('script',()=>{const s=document.createElement('script');s.textContent='globalThis.unsafe=true';document.body.appendChild(s);return 'UNSAFE'});
  check('scriptURL',()=>{const s=document.createElement('script');s.src='/receiver';document.body.appendChild(s);return 'UNSAFE'});
  check('handler',()=>{const b=document.createElement('button');b.setAttribute('onclick','globalThis.unsafe=true');return 'UNSAFE'});
  check('newPolicy',()=>{trustedTypes.createPolicy('evil',{createHTML:s=>s});return 'UNSAFE'});
  check('sourcePolicy',()=>{trustedTypes.createPolicy('lf-source',{createScript:s=>s});return 'UNSAFE'});
  check('defaultScript',()=>{trustedTypes.defaultPolicy.createScript('globalThis.unsafe=true');return 'UNSAFE'});
  check('prototypeTamper',()=>{const old=Set.prototype.has;Set.prototype.has=()=>true;try{const d=document.createElement('div');d.innerHTML='<iframe></iframe>';return d.querySelector('iframe')?'UNSAFE':'removed'}finally{Set.prototype.has=old}});
  check('attributes',()=>{const d=document.createElement('div');d.innerHTML='<button onclick="globalThis.unsafe=true">Click</button><a href="javascript:alert(1)">X</a>';return d.querySelector('[onclick],[href]')?'UNSAFE':'removed'});
  check('customFrame',()=>{class Fresh extends HTMLIFrameElement{};CustomElementRegistry.prototype.define.call(customElements,'fresh-frame',Fresh,{extends:'iframe'});document.body.appendChild(new Fresh());return 'UNSAFE'});
  check('write',()=>{document.write('<iframe></iframe>');return document.querySelector('iframe')?'UNSAFE':'removed'});
  document.body.dataset.results=JSON.stringify(result);lf.reportReady();`;
  const page=await browser.newPage();try{await page.goto(origin);const frame=page.frameLocator('iframe');await frame.locator('body[data-results]').waitFor();const result=JSON.parse((await frame.locator('body').getAttribute('data-results'))!);expect(Object.keys(result)).toHaveLength(19);for(const value of Object.values(result))expect(value).not.toBe('UNSAFE');expect(result.cookie).toBe('blocked:SecurityError');expect(result.storage).toBe('blocked:SecurityError');expect(result.inner).toBe('removed');expect(result.prototypeTamper).toBe('removed');expect(result.rtc).toMatch(/^blocked:/);}finally{await page.close();}
});

it('blocks outbound image/script/fetch and self-navigation under served parent and child CSP',async()=>{
  source.js=`const image=document.createElement('img');image.src='${'RECEIVER'}/image';document.body.appendChild(image);try{globalThis['f'+'etch']('${'RECEIVER'}/fetch')}catch{}try{const script=document.createElement('script');script.src='${'RECEIVER'}/script';document.body.appendChild(script)}catch{}document.body.dataset.test='ready';lf.reportReady();`;
  source.js=source.js.replaceAll('RECEIVER',origin);const page=await browser.newPage();try{const before=outbound;await page.goto(origin);const frame=page.frames().find(frame=>frame.url().includes('/api/generated-frame'))!;await frame.locator('body[data-test]').waitFor();await frame.evaluate((url)=>{window.location.href=url;},`${origin}/receiver`);await new Promise(resolve=>setTimeout(resolve,250));expect(outbound).toBe(before);expect(frame.url()).not.toContain('/receiver');}finally{await page.close();}
});

it('fails closed without native Trusted Types and never executes or parses artifact markup',async()=>{
  source.html='<main id="artifact-marker">This must not render.</main>';source.js='document.body.dataset.executed="yes";lf.reportReady();';
  const page=await browser.newPage();try{await page.addInitScript(()=>Object.defineProperty(window,'trustedTypes',{value:undefined,configurable:false}));await page.goto(origin);const frame=page.frameLocator('iframe');await frame.getByText('This generated website requires a browser with Trusted Types support.',{exact:false}).waitFor();expect(await frame.locator('#artifact-marker').count()).toBe(0);expect(await frame.locator('body').getAttribute('data-executed')).toBeNull();}finally{await page.close();source.html='<main><h1>Sandbox fixture</h1><div id="work"></div></main>';}
});
