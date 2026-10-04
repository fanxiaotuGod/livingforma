import { GENERATED_BRIDGE_LIMITS, type GeneratedArtifact } from '@livingforma/contracts';

export const GENERATED_FRAME_CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts; require-trusted-types-for 'script'; trusted-types lf-parser lf-source default";
export const GENERATED_FRAME_PERMISSIONS='camera=(), microphone=(), geolocation=(), display-capture=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), midi=(), clipboard-read=(), clipboard-write=(), publickey-credentials-get=(), screen-wake-lock=(), accelerometer=(), gyroscope=(), magnetometer=()';

/** Trusted first script. Source remains browser data and never executes on the API host. */
function bootstrap(artifact:GeneratedArtifact,channel:string){return `(()=>{'use strict';
const channel=${JSON.stringify(channel)}, artifact=${JSON.stringify(artifact).replace(/</g,'\\u003c')}, send=window.parent.postMessage.bind(window.parent), pair=new MessageChannel(), port=pair.port1;
const pending=new Map(), listeners=new Set(); let serial=0,state;
const denied=()=>{throw new Error('This browser capability is unavailable in generated websites.');};
for(const name of ['fetch','XMLHttpRequest','WebSocket','EventSource','WebTransport','RTCPeerConnection','webkitRTCPeerConnection','RTCDataChannel','Worker','SharedWorker','BroadcastChannel','open']){
  try{Object.defineProperty(window,name,{value:denied,writable:false,configurable:false});}catch{}
}
try{Object.defineProperty(navigator,'sendBeacon',{value:denied,writable:false,configurable:false});}catch{}
// Prevent creating a fresh frame realm that could recover blocked constructors.
for(const name of ['createElement','createElementNS']){const original=Document.prototype[name];Object.defineProperty(Document.prototype,name,{value:function(...args){const tag=String(args[name==='createElement'?0:1]).toLowerCase().split(':').pop();if(['iframe','frame','object','embed','applet'].includes(tag))return denied();return original.apply(this,args);},writable:false,configurable:false});}
const request=(method,params={})=>new Promise((resolve,reject)=>{
  if(pending.size>=32){reject(new Error('Too many pending requests.'));return;}
  const id=String(++serial),payload={id,method,params};
  if(JSON.stringify(payload).length>65536){reject(new Error('This request is too large.'));return;}
  const timeout=method==='pickImage'||method==='remove'?${GENERATED_BRIDGE_LIMITS.humanRequestMs}:${GENERATED_BRIDGE_LIMITS.requestMs};
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error('The host did not respond.'));},timeout);
  pending.set(id,{resolve,reject,timer});port.postMessage(payload);
});
port.onmessage=event=>{const message=event.data;if(!message||typeof message!=='object')return;
  if(message.type==='state'){state=message.state;for(const callback of listeners){try{callback(state);}catch{}}return;}
  if(typeof message.id!=='string'||typeof message.ok!=='boolean')return;const p=pending.get(message.id);if(!p)return;pending.delete(message.id);clearTimeout(p.timer);
  if(message.ok)p.resolve(message.result);else p.reject(Object.assign(new Error(String(message.error?.message||'The request was refused.').slice(0,500)),{code:message.error?.code}));
};port.start();
let reports=0;const reportError=message=>{if(reports++<8)void request('reportError',{message:String(message).slice(0,500)}).catch(()=>{});};
addEventListener('error',event=>reportError(event.message||'A script could not run.'));
addEventListener('unhandledrejection',event=>reportError(event.reason instanceof Error?event.reason.message:'An operation failed.'));
const ready=request('ready').then(value=>(state=value));ready.catch(()=>{});
const lf=Object.freeze({ready,subscribe(callback){if(typeof callback!=='function')throw new TypeError('A callback is required.');listeners.add(callback);if(state)callback(state);return()=>listeners.delete(callback);},
  create:values=>request('create',{values}),update:(recordId,values)=>request('update',{recordId,values}),remove:recordId=>request('remove',{recordId}),checkIn:(recordId,fieldId)=>request('checkIn',{recordId,fieldId}),pickImage:()=>request('pickImage'),image:assetId=>request('image',{assetId}),runTool:(toolId,toolVersion,input)=>request('runTool',{toolId,toolVersion,input}),reportReady:()=>request('reportReady')});
Object.defineProperty(window,'lf',{value:lf,writable:false,configurable:false});
send({type:'lf:connect',channel,version:1},'*',[pair.port2]);
addEventListener('pagehide',()=>{port.close();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('This website was closed.'));}pending.clear();listeners.clear();},{once:true});
// Generated markup never reaches the HTML parser before this support check.
// These private policies cannot be retrieved or recreated by generated code.
if(!window.trustedTypes||typeof window.trustedTypes.createPolicy!=='function'){
  const message='This generated website requires a browser with Trusted Types support. Please use a current Chromium-based browser.';
  document.body.textContent=message;reportError(message);return;
}
const parserPolicy=trustedTypes.createPolicy('lf-parser',{createHTML:value=>value});
const parseTrusted=parserPolicy.createHTML.bind(parserPolicy), parseHTML=DOMParser.prototype.parseFromString.bind(new DOMParser());
const bindCall=fn=>Function.prototype.call.bind(fn);
// Capture native DOM accessors before untrusted code can alter any prototypes.
const getter=(prototype,key)=>bindCall(Object.getOwnPropertyDescriptor(prototype,key).get);
const first=getter(Node.prototype,'firstChild'),next=getter(Node.prototype,'nextSibling'),parent=getter(Node.prototype,'parentNode'),nodeType=getter(Node.prototype,'nodeType');
const body=getter(Document.prototype,'body');
const localName=getter(Element.prototype,'localName'),namespace=getter(Element.prototype,'namespaceURI'),innerHTML=getter(Element.prototype,'innerHTML');
const templateContent=getter(HTMLTemplateElement.prototype,'content');
const remove=bindCall(Node.prototype.removeChild),getNames=bindCall(Element.prototype.getAttributeNames),getAttribute=bindCall(Element.prototype.getAttribute),removeAttribute=bindCall(Element.prototype.removeAttribute);
const lower=bindCall(String.prototype.toLowerCase),test=bindCall(RegExp.prototype.test),setHas=bindCall(Set.prototype.has);
const htmlTags=new Set('a abbr address article aside b bdi bdo blockquote br button caption code col colgroup data datalist dd del details dfn dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr i img input kbd label legend li main mark menu meter nav ol optgroup option output p picture pre progress q s samp section select small source span strong sub summary sup table tbody td template textarea tfoot th thead time tr u ul var wbr'.split(' '));
const svgTags=new Set('svg g defs path circle ellipse rect line polyline polygon text tspan title desc lineargradient radialgradient stop clippath mask pattern symbol use'.split(' '));
const attributes=new Set('id class title role style hidden tabindex dir lang name type value placeholder disabled checked selected readonly required multiple min max step maxlength minlength rows cols for width height alt loading decoding colspan rowspan scope datetime open start reversed size autocomplete accept list form controls viewbox fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset fill-rule clip-rule d points x y x1 x2 y1 y2 cx cy r rx ry transform opacity fill-opacity stroke-opacity preserveaspectratio offset stop-color stop-opacity gradientunits gradienttransform patternunits patterntransform clip-path mask text-anchor dominant-baseline font-size'.split(' '));
const htmlNamespace='http://www.w3.org/1999/xhtml',svgNamespace='http://www.w3.org/2000/svg';
function clean(root){
  let node=first(root);
  while(node){const following=next(node);
    if(nodeType(node)===1){const tag=lower(localName(node)),ns=namespace(node),allowed=ns===htmlNamespace?setHas(htmlTags,tag):ns===svgNamespace&&setHas(svgTags,tag);
      if(!allowed){remove(parent(node),node);node=following;continue;}
      const names=getNames(node);
      for(let i=0;i<names.length;i++){const raw=names[i],name=lower(raw),value=getAttribute(node,raw)||'';
        let allow=setHas(attributes,name)||test(/^(aria-|data-)[a-z0-9_-]+$/,name);
        if(name==='href'||name==='xlink:href')allow=test(/^#[a-zA-Z0-9_-]*$/,value);
        if(name==='src')allow=tag==='img'&&test(/^(data:image\\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+|blob:[a-zA-Z0-9:/._-]+)$/,value);
        if(!allow||test(/^on/i,name)||name==='srcdoc')removeAttribute(node,raw);
      }
      if(tag==='template'&&ns===htmlNamespace)clean(templateContent(node));else clean(node);
    }else if(nodeType(node)!==3)remove(parent(node),node);
    node=following;
  }
}
const defaultPolicy=trustedTypes.createPolicy('default',{createHTML(value){
  if(value.length>500000)throw new Error('This HTML update is too large.');
  const parsed=parseHTML(parseTrusted(value),'text/html'),root=body(parsed);clean(root);return innerHTML(root);
}});
const sourcePolicy=trustedTypes.createPolicy('lf-source',{createScript:value=>value});
// Deny registering customized built-ins that could construct a fresh frame realm.
try{Object.defineProperty(CustomElementRegistry.prototype,'define',{value:denied,writable:false,configurable:false});Object.defineProperty(customElements,'define',{value:denied,writable:false,configurable:false});}catch{}
const style=document.createElement('style');style.textContent=artifact.css;document.head.appendChild(style);
document.body.innerHTML=defaultPolicy.createHTML(artifact.html);
const script=document.createElement('script');script.text=sourcePolicy.createScript(artifact.js);document.body.appendChild(script);
})();`;}

export function renderGeneratedFrame(artifact:GeneratedArtifact,channel:string){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script>${bootstrap(artifact,channel)}</script></body></html>`;
}
