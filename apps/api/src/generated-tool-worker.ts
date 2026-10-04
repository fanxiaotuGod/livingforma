/** Trusted worker entry point. Only QuickJS evaluates tool source. */
import { parentPort, workerData } from 'node:worker_threads';
import { getQuickJS, type QuickJSDeferredPromise } from 'quickjs-emscripten';
import type { GENERATED_TOOL_LIMITS } from '@livingforma/contracts';

const port=parentPort!;
const input=workerData as {source:string;input:Record<string,unknown>;limits:typeof GENERATED_TOOL_LIMITS};
const limits=Object.freeze(input.limits);
const engine=await getQuickJS(),runtime=engine.newRuntime();
runtime.setMemoryLimit(limits.heapBytes);runtime.setMaxStackSize(limits.stackBytes);
let deadline=Infinity;runtime.setInterruptHandler(()=>Date.now()>deadline);
const vm=runtime.newContext(),pending=new Map<number,QuickJSDeferredPromise>();let sequence=0,closed=false,executing=false;
function pump(){if(closed)return;const result=runtime.executePendingJobs(32);if(result.error){result.error.dispose();finish(false);}else if(result.value===32)setImmediate(pump);}
function finish(ok:boolean,value?:string){if(closed)return;closed=true;port.postMessage(ok?{type:'result',value}:{type:'error'});port.removeAllListeners('message');for(const promise of pending.values())promise.dispose();pending.clear();vm.dispose();runtime.dispose();port.close();}
const bridge=vm.newFunction('__broker',(method,arg)=>{
  const name=vm.getString(method),text=vm.getString(arg);
  if(!['readRecords','callConnector'].includes(name)||text.length>limits.maxPayloadBytes||sequence>=limits.maxBrokerCalls)throw new Error('Tool capability limit exceeded.');
  const id=++sequence,promise=vm.newPromise();pending.set(id,promise);port.postMessage({type:'broker',id,method:name,input:JSON.parse(text)});return promise.handle;
});
vm.setProp(vm.global,'__broker',bridge);bridge.dispose();
port.on('message',(message:{type:string;id:number;value?:unknown;ok?:boolean})=>{
  if(!closed&&message.type==='execute'&&!executing){executing=true;deadline=Date.now()+limits.timeoutMs;execute();return;}
  if(closed||message.type!=='brokerResult')return;const promise=pending.get(message.id);if(!promise)return;
  const value=vm.newString(message.ok?JSON.stringify(message.value):'The requested capability is unavailable.');
  if(message.ok)promise.resolve(value);else promise.reject(value);value.dispose();pump();
});
function execute(){try{
  // Serialization goes through JSON both ways; no host objects/functions enter the guest.
  const code=`(async()=>{const broker=globalThis.__broker;delete globalThis.__broker;const api=Object.freeze({readRecords:async input=>JSON.parse(await broker('readRecords',JSON.stringify(input))),callConnector:async input=>JSON.parse(await broker('callConnector',JSON.stringify(input)))});${input.source}\nreturn JSON.stringify(await run(JSON.parse(${JSON.stringify(JSON.stringify(input.input))}),api));})()`;
  const result=vm.evalCode(code,'generated-tool.js');
  if(result.error){result.error.dispose();finish(false);}else{
    const handle=result.value;
    void vm.resolvePromise(handle).then(result=>{handle.dispose();if(result.error){result.error.dispose();finish(false);}else{const output=vm.getString(result.value);result.value.dispose();finish(true,output);}}).catch(()=>finish(false));pump();
  }
}catch{finish(false);}}
// No generated code runs until the trusted parent acknowledges readiness and starts its execution clock.
port.postMessage({type:'ready'});
