import { expect,it,vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { GENERATED_TOOL_LIMITS, validateGeneratedTool, type GeneratedToolSpec } from '@livingforma/contracts';
import { createGeneratedToolAdapter } from './generated-tool-runtime';
export const arithmetic=():GeneratedToolSpec=>validateGeneratedTool({kind:'code-js-v1',toolId:'multiply',toolVersion:1,name:'Multiply',description:'Custom arithmetic.',source:'function run(input, api) { return {answer: input.value * 7}; }',inputSchema:{type:'object',properties:{value:{type:'number'}},required:['value'],additionalProperties:false},outputSchema:{type:'object',properties:{answer:{type:'number'}},required:['answer'],additionalProperties:false},sideEffects:'none',capabilities:{publicRecordFields:[],connectors:[]},tests:[{name:'Positive',input:{value:3},expected:{answer:21}},{name:'Negative',input:{value:-2},expected:{answer:-14}}]});
const adapter=createGeneratedToolAdapter();const broker={async readRecords(){return [];},async callConnector(){return {};}};
it('executes new arithmetic logic and reports actual fixture comparisons',async()=>{expect((await adapter.test(arithmetic())).ok).toBe(true);expect(await adapter.invoke(arithmetic(),{value:8},{broker})).toEqual({answer:56});const wrong=arithmetic();wrong.tests[0]!.expected={answer:22};expect((await adapter.test(wrong)).ok).toBe(false);},20000);
it('resolves async public-record and connector fixtures in the isolated runtime',async()=>{
 const spec=arithmetic();spec.source='async function run(input, api) {const rows=await api.readRecords({fields:["points"]}); const rate=await api.callConnector({toolId:"rate",toolVersion:1,input:{}});return {answer:rows.reduce((sum,row)=>sum+row.values.points,0)*rate.factor};}';spec.capabilities={publicRecordFields:['points'],connectors:[{toolId:'rate',toolVersion:1}]};for(const test of spec.tests){test.records=[{id:'a',version:1,values:{points:3}},{id:'b',version:1,values:{points:4}}];test.connectorResults=[{toolId:'rate',toolVersion:1,input:{},result:{factor:2}}];test.expected={answer:14};}expect((await adapter.test(spec)).ok).toBe(true);
},15000);
it('validates input/output and terminates unfinished work within the deadline',async()=>{
 await expect(adapter.invoke(arithmetic(),{wrong:8},{broker})).rejects.toThrow();const wrong=arithmetic();wrong.source='function run(input,api){return {wrong:1}}';await expect(adapter.invoke(wrong,{value:1},{broker})).rejects.toThrow('output schema');
 const slow=arithmetic();slow.source='function run(input,api){let sum=0;for(let i=0;i<1e14;i++)sum+=i;return {answer:sum}}';await expect(adapter.invoke(slow,{value:1},{broker})).rejects.toThrow();expect(await adapter.invoke(arithmetic(),{value:2},{broker})).toEqual({answer:14});
},15000);
it('cancels pending async work and denies undeclared ordinary data access',async()=>{
 const spec=arithmetic();spec.source='async function run(input,api){await api.readRecords({fields:["private"]});return {answer:1}}';await expect(adapter.invoke(spec,{value:1},{broker})).rejects.toThrow();
 const controller=new AbortController();controller.abort();await expect(adapter.invoke(arithmetic(),{value:1},{broker,signal:controller.signal})).rejects.toThrow('cancelled');
});
it('admits one worker across adapter instances, rejects busy work immediately and releases capacity after completion',async()=>{
 const spec=arithmetic();spec.capabilities.publicRecordFields=['points'];spec.source='async function run(input,api){await api.readRecords({fields:["points"]});return {answer:1}}';
 let reads=0,release!:(rows:[])=>void;const broker={async readRecords(){reads++;return new Promise<[]>(resolve=>{release=resolve;});},async callConnector(){return {};}};
 const job=adapter.invoke(spec,{value:1},{broker});await vi.waitFor(()=>expect(reads).toBe(1));
 const another=createGeneratedToolAdapter(),started=performance.now();await expect(another.invoke(arithmetic(),{value:2},{broker})).rejects.toMatchObject({statusCode:429,code:'TOOL_BUSY'});expect(performance.now()-started).toBeLessThan(500);expect(reads).toBe(1);
 // A busy fixture run is service contention, never a fabricated failing test report.
 await expect(another.test(arithmetic())).rejects.toMatchObject({code:'TOOL_BUSY'});
 release([]);expect(await job).toEqual({answer:1});expect(await another.invoke(arithmetic(),{value:2},{broker})).toEqual({answer:14});
},10000);

// Trusted protocol fixtures isolate parent clocks from real CPU speed. The tests above run real QuickJS.
async function phaseFixture(run:(context:{create:typeof createGeneratedToolAdapter;workers:ProtocolWorker[];advance:(ms:number)=>Promise<void>;setClock:(ms:number)=>void})=>Promise<void>){
 const workers:ProtocolWorker[]=[];let clock=0;
 class FakeWorker extends ProtocolWorker{constructor(_url:URL,options:{workerData:unknown}){super(options.workerData);workers.push(this);}}
 vi.resetModules();vi.doMock('node:worker_threads',()=>({Worker:FakeWorker}));vi.useFakeTimers();const now=vi.spyOn(performance,'now').mockImplementation(()=>clock);
 try{const {createGeneratedToolAdapter:create}=await import('./generated-tool-runtime');await run({create,workers,advance:async ms=>{clock+=ms;await vi.advanceTimersByTimeAsync(ms);},setClock:ms=>{clock=ms;}});}
 finally{now.mockRestore();vi.useRealTimers();vi.doUnmock('node:worker_threads');vi.resetModules();}
}
class ProtocolWorker extends EventEmitter{
 sent:unknown[]=[];terminations=0;
 constructor(readonly workerData:unknown){super();}
 postMessage(message:unknown){this.sent.push(message);}
 async terminate(){this.terminations++;return 0;}
}
it('bounds cold initialization independently and never starts guest code after its startup deadline',async()=>phaseFixture(async({create,workers,advance})=>{
 // A startup infrastructure failure must reject testing, not become a source fixture failure/repair.
 const settled=Promise.allSettled([create().test(arithmetic())]);const worker=workers[0]!;
 expect(worker.workerData).toMatchObject({limits:GENERATED_TOOL_LIMITS});await advance(7999);expect(worker.sent).toEqual([]);expect(worker.terminations).toBe(0);
 await advance(1);expect((await settled)[0]).toMatchObject({status:'rejected',reason:{statusCode:503,code:'TOOL_STARTUP_TIMEOUT'}});expect(worker.terminations).toBe(1);expect(worker.sent).toEqual([]);expect(vi.getTimerCount()).toBe(0);
}));
it('starts the four-second guest clock only after trusted readiness within the twelve-second total bound',async()=>phaseFixture(async({create,workers,advance})=>{
 const settled=Promise.allSettled([create().invoke(arithmetic(),{value:1},{broker})]);const worker=workers[0]!;
 await advance(7000);worker.emit('message',{type:'ready'});expect(worker.sent).toEqual([{type:'execute'}]);await advance(3999);expect(worker.terminations).toBe(0);
 await advance(1);expect((await settled)[0]).toMatchObject({status:'rejected',reason:{code:'TOOL_LIMIT_EXCEEDED',message:'Tool execution exceeded its time limit.'}});expect(worker.terminations).toBe(1);expect(vi.getTimerCount()).toBe(0);
}));
it('checks absolute startup and total deadlines even when throttling delays timer delivery',async()=>phaseFixture(async({create,workers,setClock})=>{
 const first=Promise.allSettled([create().invoke(arithmetic(),{value:1},{broker})]);setClock(8001);workers[0]!.emit('message',{type:'ready'});
 expect((await first)[0]).toMatchObject({status:'rejected',reason:{code:'TOOL_STARTUP_TIMEOUT'}});expect(workers[0]!.sent).toEqual([]);
 const second=Promise.allSettled([create().invoke(arithmetic(),{value:1},{broker})]);workers[1]!.emit('message',{type:'ready'});setClock(20002);workers[1]!.emit('message',{type:'result',value:'{"answer":7}'});
 expect((await second)[0]).toMatchObject({status:'rejected',reason:{code:'TOOL_LIMIT_EXCEEDED',message:'Tool startup and execution exceeded their total time limit.'}});expect(workers[1]!.terminations).toBe(1);expect(vi.getTimerCount()).toBe(0);
}));
it('cancels startup without executing guest code and releases the process-wide slot for a fresh request',async()=>phaseFixture(async({create,workers})=>{
 const controller=new AbortController(),first=Promise.allSettled([create().invoke(arithmetic(),{value:1},{broker,signal:controller.signal})]);controller.abort();
 expect((await first)[0]).toMatchObject({status:'rejected',reason:{code:'TOOL_ABORTED'}});expect(workers[0]!.sent).toEqual([]);expect(workers[0]!.terminations).toBe(1);
 const second=create().invoke(arithmetic(),{value:2},{broker});workers[1]!.emit('message',{type:'ready'});workers[1]!.emit('message',{type:'result',value:'{"answer":14}'});
 expect(await second).toEqual({answer:14});expect(workers[1]!.terminations).toBe(1);expect(vi.getTimerCount()).toBe(0);
}));
it('releases the single worker capacity after cancellation while an ordinary broker read is pending',async()=>{
 const spec=arithmetic();spec.capabilities.publicRecordFields=['points'];spec.source='async function run(input,api){await api.readRecords({fields:["points"]});return {answer:1}}';
 let reads=0;const controller=new AbortController(),broker={async readRecords(){reads++;return new Promise<never>(()=>{});},async callConnector(){return {};}};
 const job=adapter.invoke(spec,{value:1},{broker,signal:controller.signal});const settled=Promise.allSettled([job]);await vi.waitFor(()=>expect(reads).toBe(1));controller.abort();expect((await settled)[0]).toMatchObject({status:'rejected',reason:{code:'TOOL_ABORTED'}});expect(await createGeneratedToolAdapter().invoke(arithmetic(),{value:2},{broker})).toEqual({answer:14});
},10000);
