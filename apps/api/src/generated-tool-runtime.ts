import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { GENERATED_TOOL_LIMITS as limits, isBoundedJson, validateGeneratedTool, validateToolJson, type GeneratedToolAdapter, type GeneratedToolBroker, type GeneratedToolSpec, type JsonObject } from '@livingforma/contracts';
import { fingerprint, ApiProblem } from './domain';

let active=0;
const problem=(code:string,message:string)=>new ApiProblem(code==='TOOL_BUSY'?429:code==='TOOL_STARTUP_TIMEOUT'?503:422,code,message);
export function createGeneratedToolAdapter():GeneratedToolAdapter{
  async function invoke(spec:GeneratedToolSpec,input:JsonObject,options:{broker:GeneratedToolBroker;signal?:AbortSignal}):Promise<JsonObject>{
    validateGeneratedTool(spec);validateToolJson(spec.inputSchema,input);
    if(options.signal?.aborted)throw problem('TOOL_ABORTED','Tool execution was cancelled.');
    if(active>=limits.maxConcurrent)throw problem('TOOL_BUSY','The tool runtime is busy. Start a new request after the current run finishes.');active++;
    let worker:Worker|undefined;
    try{return await new Promise<JsonObject>((resolve,reject)=>{
      const started=performance.now(),startupDeadline=started+limits.startupTimeoutMs,totalDeadline=started+limits.totalTimeoutMs;
      // Production has a separate compiled entry. Development registers tsx before importing TS.
      const compiled=new URL('./generated-tool-worker.js',import.meta.url),source=new URL('./generated-tool-worker.ts',import.meta.url);
      // Only this trusted host selects limits. Avoid initializing every shared schema/parser in each cold worker.
      const workerData={source:spec.source,input,limits};
      worker=existsSync(compiled)?new Worker(compiled,{workerData,execArgv:[]}):new Worker(new URL(`data:text/javascript,${encodeURIComponent(`import {register} from ${JSON.stringify(pathToFileURL(createRequire(import.meta.url).resolve('tsx/esm/api')).href)};register();await import(${JSON.stringify(source.href)});`)}`),{workerData,execArgv:[]});
      let settled=false,calls=0,ready=false,executionDeadline=Infinity,executionTimer:ReturnType<typeof setTimeout>|undefined;
      const finish=(error?:unknown,value?:JsonObject)=>{if(settled)return;settled=true;clearTimeout(startupTimer);clearTimeout(totalTimer);clearTimeout(executionTimer);options.signal?.removeEventListener('abort',abort);error?reject(error):resolve(value!);};
      const abort=()=>finish(problem('TOOL_ABORTED','Tool execution was cancelled.'));
      const startupTimer=setTimeout(()=>finish(problem('TOOL_STARTUP_TIMEOUT','The isolated tool engine could not start within its time limit.')),Math.max(0,startupDeadline-performance.now()));startupTimer.unref();
      const totalTimer=setTimeout(()=>finish(problem('TOOL_LIMIT_EXCEEDED','Tool startup and execution exceeded their total time limit.')),Math.max(0,totalDeadline-performance.now()));totalTimer.unref();
      options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
      worker.on('error',()=>finish(problem('TOOL_EXECUTION_FAILED','The isolated tool could not finish.')));
      worker.on('exit',()=>{if(!settled)finish(problem('TOOL_EXECUTION_FAILED','The isolated tool stopped before returning a result.'));});
      worker.on('message',async(message:{type:string;id:number;method:string;input:unknown;value:string})=>{
        if(settled)return;
        // Check absolute deadlines as well as timers: CPU throttling may delay timer delivery.
        const now=performance.now();if(now>=totalDeadline){finish(problem('TOOL_LIMIT_EXCEEDED','Tool startup and execution exceeded their total time limit.'));return;}
        if(!ready&&now>=startupDeadline){finish(problem('TOOL_STARTUP_TIMEOUT','The isolated tool engine could not start within its time limit.'));return;}
        if(ready&&now>=executionDeadline){finish(problem('TOOL_LIMIT_EXCEEDED','Tool execution exceeded its time limit.'));return;}
        if(message.type==='ready'){
          if(ready){finish(problem('TOOL_EXECUTION_FAILED','The isolated tool returned an invalid startup sequence.'));return;}
          ready=true;clearTimeout(startupTimer);executionDeadline=Math.min(now+limits.timeoutMs,totalDeadline);
          executionTimer=setTimeout(()=>finish(problem('TOOL_LIMIT_EXCEEDED','Tool execution exceeded its time limit.')),Math.max(0,executionDeadline-performance.now()));executionTimer.unref();
          worker!.postMessage({type:'execute'});return;
        }
        if(!ready){finish(problem('TOOL_EXECUTION_FAILED','The isolated tool returned data before startup completed.'));return;}
        if(message.type==='result'){try{const value=JSON.parse(message.value);validateToolJson(spec.outputSchema,value);finish(undefined,value);}catch{finish(problem('TOOL_OUTPUT_INVALID','The tool returned a result outside its output schema.'));}return;}
        if(message.type==='error'){finish(problem('TOOL_EXECUTION_FAILED','The isolated tool could not finish.'));return;}
        if(message.type!=='broker'||++calls>limits.maxBrokerCalls||!isBoundedJson(message.input)){finish(problem('TOOL_CAPABILITY_DENIED','The tool exceeded its capability limits.'));return;}
        try{
          let value:unknown;const arg=message.input as Record<string,unknown>;
          if(message.method==='readRecords'){
            if(!Array.isArray(arg.fields)||arg.fields.some(field=>typeof field!=='string'||!spec.capabilities.publicRecordFields.includes(field))||arg.fields.length>40||arg.limit!==undefined&&(!Number.isInteger(arg.limit)||Number(arg.limit)<1||Number(arg.limit)>100))throw new Error();
            value=await options.broker.readRecords({fields:arg.fields as string[],limit:Number(arg.limit??100)});
          }else if(message.method==='callConnector'){
            if(!spec.capabilities.connectors.some(c=>c.toolId===arg.toolId&&c.toolVersion===arg.toolVersion)||!isBoundedJson(arg.input)||!arg.input||Array.isArray(arg.input)||typeof arg.input!=='object')throw new Error();
            value=await options.broker.callConnector(arg as {toolId:string;toolVersion:number;input:JsonObject});
          }else throw new Error();
          if(!isBoundedJson(value))throw new Error();if(!settled)worker!.postMessage({type:'brokerResult',id:message.id,ok:true,value});
        }catch{if(!settled)worker!.postMessage({type:'brokerResult',id:message.id,ok:false});}
      });
    });}finally{await worker?.terminate();active--;}
  }
  return {validate:validateGeneratedTool,invoke,async test(spec,signal){
    validateGeneratedTool(spec);const results=[];
    for(const fixture of spec.tests){let ok=false;try{const result=await invoke(spec,fixture.input,{signal,broker:{
      async readRecords({fields,limit}){return (fixture.records??[]).slice(0,limit??100).map(record=>({id:record.id,version:record.version,values:Object.fromEntries(fields.filter(field=>Object.hasOwn(record.values,field)).map(field=>[field,record.values[field]!]))}));},
      async callConnector(input){const match=fixture.connectorResults?.find(result=>result.toolId===input.toolId&&result.toolVersion===input.toolVersion&&fingerprint(result.input)===fingerprint(input.input));if(!match)throw new Error('A connector fixture is required.');return match.result;},
    }});ok=fingerprint(result)===fingerprint(fixture.expected);}catch(error){if(error instanceof ApiProblem&&['TOOL_BUSY','TOOL_STARTUP_TIMEOUT'].includes(error.code))throw error;if(signal?.aborted)throw problem('TOOL_ABORTED','Tool testing was cancelled.');}
      results.push({name:fixture.name,ok,message:ok?'Fixture output matched.':'The fixture did not produce the expected output within its limits.'});
    }return {ok:results.every(result=>result.ok),results};
  }};
}
