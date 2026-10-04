import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { FastifyInstance,FastifyRequest,FastifyReply } from 'fastify';
import type { AuthApi,StoredSession } from '@livingforma/auth';
import { generatedToolInvocationSchema,generatedToolManifest,generatedToolSpecSchema,isBoundedJson,validateGeneratedTool,validateToolJson,type Definition,type GeneratedToolAdapter,type GeneratedToolGenerator,type GeneratedToolSpec,type GeneratedToolTestReport,type JsonObject,type Proposal,type RegisteredGeneratedTool,type ToolAdapter,type ToolResult,type User } from '@livingforma/contracts';
import type { Store,SqlConnection,SpaceState } from '@livingforma/db';
import { ApiProblem,fail,fingerprint,requireOwner } from './domain';
import { createGeneratedToolAdapter } from './generated-tool-runtime';

type Identity={user:User;sessionHash:string;csrfToken:string};
type Report={toolId:string;toolVersion:number;name:string;report:GeneratedToolTestReport};
type Pending={digest:string;status:'pending'|'ok'|'failed';result?:ToolResult;startedAt:number};
export type CodeToolsController=Awaited<ReturnType<typeof registerCodeTools>>;
const sourceDigest=(spec:GeneratedToolSpec)=>createHash('sha256').update(spec.source).digest('hex');
const sensitive=/(?:Bearer\s+[A-Za-z0-9._-]{12,}|AIza[\w-]{20,}|(?:api[_-]?key|client[_-]?secret|csrf[_-]?token|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9_-]{12,})/i;
function safeCurrent(current:Definition|null){if(!current)return null;const result=structuredClone(current);for(const field of result.entitySchema.fields)if(!field.public)delete field.defaultValue;return result;}
export function assertToolBinding(state:SpaceState,input:{definitionVersion?:number;componentId?:string;actionId?:string},toolId:string,toolVersion:number,kind:'generated'|'catalog',required=true){
  if(!required&&input.definitionVersion===undefined&&input.componentId===undefined&&input.actionId===undefined)return;
  if(!state.definition||input.definitionVersion!==state.definition.definitionVersion)fail(409,'DEFINITION_CONFLICT','This website changed. Refresh before running its tool.');
  const component=state.definition.appSpec.components.find(c=>c.id===input.componentId);
  if(component?.type!=='generated-site'||!component.actionIds.includes(input.actionId??'')||!state.definition.appSpec.actions.some(a=>a.id===input.actionId&&a.type==='tool.invoke')||!component.toolBindings?.some(b=>b.actionId===input.actionId&&b.toolId===toolId&&b.toolVersion===toolVersion&&b.kind===kind))fail(403,'TOOL_BINDING_FORBIDDEN','This action is not bound to the published tool.');
}

export async function registerCodeTools(app:FastifyInstance,options:{store:Store;auth:AuthApi;adapter?:GeneratedToolAdapter;generator?:GeneratedToolGenerator;connectors?:ToolAdapter}){
  const {store,auth,generator,connectors}=options,adapter=options.adapter??createGeneratedToolAdapter();
  const flights=new Map<AbortController,Identity>();
  // A reserved call is not automatically repeated after interruption or restart.
  await store.db.query("UPDATE lf_code_tool_requests SET data=jsonb_set(data,'{status}','\"failed\"') WHERE data->>'status'='pending'");
  async function identity(request:FastifyRequest):Promise<Identity>{
    const session=await auth.getSession(request);if(!session.user||!session.csrfToken)fail(401,'LOGIN_REQUIRED','Please sign in to use this tool.');
    const stored=(await store.db.query<{token_hash:string}>('SELECT token_hash FROM lf_sessions WHERE user_id=$1 AND data->>\'csrfToken\'=$2 AND expires_at>now()',[session.user.id,session.csrfToken])).rows[0];if(!stored)fail(401,'SESSION_EXPIRED','Your sign-in session has expired.');return {user:session.user,sessionHash:stored.token_hash,csrfToken:session.csrfToken};
  }
  async function live(who:Identity,slug:string,tx:SqlConnection=store.db,lock=false){const state=await store.getSpace(slug,tx,lock);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');requireOwner(state,who.user);if(!(await tx.query(`SELECT token_hash FROM lf_sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>now()${lock?' FOR SHARE':''}`,[who.sessionHash,who.user.id])).rows.length)fail(401,'SESSION_EXPIRED','The original sign-in session has expired.');return state;}
  async function writeIdentity(request:FastifyRequest){const who=await identity(request);await auth.verifyCsrf(request);return who;}
  function validate(input:unknown){try{const spec=validateGeneratedTool(adapter.validate(input));if(sensitive.test(JSON.stringify(spec))||Buffer.byteLength(JSON.stringify(spec))>128*1024)throw new Error('Tool content is sensitive or exceeds 128 KiB.');return spec;}catch(error){const detail=error instanceof Error&&!sensitive.test(error.message)?error.message.slice(0,180):'Check source, schemas, capabilities and fixtures.';fail(422,'INVALID_CODE_TOOL',`The generated tool is invalid. ${detail}`);}}
  async function capabilities(spec:GeneratedToolSpec,state:SpaceState,tx:SqlConnection=store.db){
    if(spec.capabilities.publicRecordFields.some(id=>!state.definition?.entitySchema.fields.some(field=>field.id===id&&field.public)))fail(422,'TOOL_CAPABILITY_DENIED','Tool fields must exist and be public.');
    for(const ref of spec.capabilities.connectors){const tool=await store.getTool(state.space.id,ref.toolId,ref.toolVersion,tx);if(!tool?.enabled||tool.spec.sideEffects!=='none'||tool.spec.method!=='GET'||!connectors)fail(422,'TOOL_CAPABILITY_DENIED','A required read-only connector is not enabled.');}
  }
  async function immutable(spec:GeneratedToolSpec,state:SpaceState,tx:SqlConnection){const old=await store.getCodeTool(state.space.id,spec.toolId,spec.toolVersion,tx);if(old&&fingerprint(old.spec)!==fingerprint(spec))fail(409,'TOOL_VERSION_CONFLICT','Use a new version to change registered tool source, schemas or capabilities.');return old;}
  async function register(spec:GeneratedToolSpec,report:GeneratedToolTestReport,state:SpaceState,tx:SqlConnection,enabled=true){
    await capabilities(spec,state,tx);const old=await immutable(spec,state,tx);if(!report.ok||report.results.length!==spec.tests.length||report.results.some((r,i)=>!r.ok||r.name!==spec.tests[i]?.name))fail(422,'TOOL_TEST_FAILED','All tool fixtures must pass before registration.');
    const tool:RegisteredGeneratedTool={spec,enabled,sourceDigest:sourceDigest(spec),testReport:report,verifiedAt:new Date().toISOString(),invocationCount:old?.invocationCount??0};await store.putCodeTool(state.space.id,tool,tx);return {tool,reused:!!old};
  }
  async function validateBindings(proposal:Pick<Proposal,'appSpec'>,state:SpaceState,tx:SqlConnection,pending:GeneratedToolSpec[]=[]){
    for(const component of proposal.appSpec.components)for(const binding of component.toolBindings??[]){
      if(binding.kind==='catalog'){const tool=await store.getTool(state.space.id,binding.toolId,binding.toolVersion,tx);if(!tool?.enabled)fail(422,'TOOL_NOT_ENABLED','Enable the bound catalog tool before publishing.');}
      else{const spec=pending.find(s=>s.toolId===binding.toolId&&s.toolVersion===binding.toolVersion);if(spec){await capabilities(spec,state,tx);await immutable(spec,state,tx);}else{const tool=await store.getCodeTool(state.space.id,binding.toolId,binding.toolVersion,tx);if(!tool?.enabled)fail(422,'TOOL_NOT_ENABLED','Enable the bound generated tool before publishing.');await capabilities(tool.spec,state,tx);}}
    }
  }
  async function testCandidates(proposal:Proposal,state:SpaceState,signal:AbortSignal,onReport:(report:Report)=>Promise<void>,onStart?:(spec:GeneratedToolSpec)=>Promise<void>){
    const specs=(proposal.codeToolProposals??[]).map(validate);if(new Set(specs.map(s=>`${s.toolId}:${s.toolVersion}`)).size!==specs.length)fail(422,'INVALID_CODE_TOOL','Tool candidates must have unique versions.');
    const reports:Report[]=[];
    for(const spec of specs){await capabilities(spec,state);await immutable(spec,state,store.db);await onStart?.(spec);const report={toolId:spec.toolId,toolVersion:spec.toolVersion,name:spec.name,report:await adapter.test(spec,signal)};reports.push(report);await onReport(report);if(!report.report.ok)fail(422,'INVALID_GENERATED_SITE',`Generated tool ${spec.toolId} failed fixture tests: ${report.report.results.filter(result=>!result.ok).map(result=>result.name+': '+result.message).join('; ').slice(0,350)}`);}
    return reports;
  }
  async function publishCandidates(proposal:Proposal,reports:Report[],state:SpaceState,tx:SqlConnection){
    const specs=(proposal.codeToolProposals??[]).map(validate);
    for(const spec of specs){const report=reports.find(r=>r.toolId===spec.toolId&&r.toolVersion===spec.toolVersion);if(!report)fail(422,'TOOL_TEST_REQUIRED','Test every generated tool before publishing.');await register(spec,report.report,state,tx,true);}
    await validateBindings(proposal,state,tx);
  }
  async function manifests(spaceId:string){return (await store.getCodeTools(spaceId)).filter(tool=>tool.enabled).map(tool=>generatedToolManifest(tool.spec));}
  async function withFlight<T>(request:FastifyRequest,who:Identity,fn:(signal:AbortSignal)=>Promise<T>,timeout=30_000,reply?:FastifyReply){const controller=new AbortController();flights.set(controller,who);const abort=()=>controller.abort(),disconnected=()=>{if(!reply?.raw.writableEnded)abort();};request.raw.on('aborted',abort);reply?.raw.on('close',disconnected);const timer=setTimeout(abort,timeout);let stop:()=>void=()=>{};const cancelled=new Promise<never>((_resolve,reject)=>{stop=()=>reject(new ApiProblem(409,'TOOL_ABORTED','Tool work stopped before completion.'));controller.signal.addEventListener('abort',stop,{once:true});});try{return await Promise.race([fn(controller.signal),cancelled]);}finally{clearTimeout(timer);controller.signal.removeEventListener('abort',stop);request.raw.off('aborted',abort);reply?.raw.off('close',disconnected);flights.delete(controller);controller.abort();}}
  app.get<{Params:{slug:string}}>('/api/spaces/:slug/code-tools',async request=>{const who=await identity(request),state=await live(who,request.params.slug);return {tools:await store.getCodeTools(state.space.id)};});
  app.post<{Params:{slug:string}}>('/api/spaces/:slug/code-tools/proposals',{config:{rateLimit:{max:6,timeWindow:'1 minute'}}},async(request,reply)=>{
    const who=await writeIdentity(request),input=z.object({prompt:z.string().trim().min(1).max(4000)}).strict().parse(request.body),state=await live(who,request.params.slug);if(sensitive.test(input.prompt))fail(422,'SENSITIVE_PROMPT','Remove credentials from the tool request.');if(!generator)fail(503,'GENERATOR_UNAVAILABLE','Tool generation is not configured.');
    return withFlight(request,who,async signal=>{
      let result;try{result=await generator({prompt:input.prompt,current:safeCurrent(state.definition),registeredTools:await manifests(state.space.id),registeredCatalogTools:(await store.getTools(state.space.id)).filter(t=>t.enabled),signal});}catch{fail(503,'GENERATOR_UNAVAILABLE','Tool generation could not finish. No tool was enabled.');}
      const current=await live(who,request.params.slug);if(signal.aborted)fail(409,'TOOL_ABORTED','Tool generation stopped.');
      if(result.reuse&&!result.spec){const tool=await store.getCodeTool(current.space.id,result.reuse.toolId,result.reuse.toolVersion);if(!tool?.enabled)fail(422,'TOOL_NOT_ENABLED','The proposed existing tool is not enabled.');return {spec:null,reuse:result.reuse,summary:'An existing enabled tool can be reused.',source:'gemini',testReport:tool.testReport};}
      if(!result.spec||result.reuse)fail(422,'INVALID_CODE_TOOL','The generator must propose one new tool or one existing tool.');const spec=validate(result.spec);await capabilities(spec,current);await immutable(spec,current,store.db);const testReport=await adapter.test(spec,signal);await live(who,request.params.slug);if(signal.aborted)fail(409,'TOOL_ABORTED','Tool generation stopped.');return {spec,reuse:null,summary:'Review the generated source, capabilities and actual fixture results before enabling.',source:'gemini',testReport};
    },30_000,reply);
  });
  app.post<{Params:{slug:string}}>('/api/spaces/:slug/code-tools',{config:{rateLimit:{max:12,timeWindow:'1 minute'}}},async(request,reply)=>{
    const who=await writeIdentity(request),input=z.object({spec:generatedToolSpecSchema,enable:z.boolean()}).strict().parse(request.body),spec=validate(input.spec),state=await live(who,request.params.slug);await capabilities(spec,state);await immutable(spec,state,store.db);
    return withFlight(request,who,async signal=>{const report=await adapter.test(spec,signal);if(signal.aborted)fail(409,'TOOL_ABORTED','Tool testing stopped.');return store.db.transaction(async tx=>{const current=await live(who,request.params.slug,tx,true);if(signal.aborted)fail(409,'TOOL_ABORTED','Tool testing stopped.');return register(spec,report,current,tx,input.enable);});},65_000,reply);
  });
  app.post<{Params:{slug:string;toolId:string}}>('/api/spaces/:slug/code-tools/:toolId/invoke',{config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async(request,reply)=>{
    const who=await writeIdentity(request),input=generatedToolInvocationSchema.parse(request.body),slug=request.params.slug,toolId=request.params.toolId,digest=fingerprint({operation:'code-tool.invoke',toolId,...input});
    const reserved=await store.db.transaction(async tx=>{
      const state=await live(who,slug,tx,true);assertToolBinding(state,input,toolId,input.toolVersion,'generated');const tool=await store.getCodeTool(state.space.id,toolId,input.toolVersion,tx);if(!tool?.enabled)fail(403,'TOOL_NOT_ENABLED','This tool is not enabled.');await capabilities(tool.spec,state,tx);try{validateToolJson(tool.spec.inputSchema,input.input);}catch{fail(422,'TOOL_INPUT_INVALID','The input does not match this tool schema.');}
      const previous=(await tx.query<{data:Pending}>('SELECT data FROM lf_code_tool_requests WHERE space_id=$1 AND user_id=$2 AND request_id=$3',[state.space.id,who.user.id,input.requestId])).rows[0]?.data;
      if(previous){if(previous.digest!==digest)fail(409,'REQUEST_ID_CONFLICT','Use a new request ID for a different tool invocation.');if(previous.status==='ok')return {state,tool,result:previous.result!};fail(409,previous.status==='pending'?'TOOL_IN_PROGRESS':'TOOL_INTERRUPTED','This invocation is pending or was interrupted. It will not be executed again automatically.');}
      const data:Pending={digest,status:'pending',startedAt:Date.now()};await tx.query('INSERT INTO lf_code_tool_requests(space_id,user_id,request_id,data) VALUES($1,$2,$3,$4)',[state.space.id,who.user.id,input.requestId,JSON.stringify(data)]);return {state,tool};
    });if(reserved.result)return reserved.result;
    const started=Date.now();const update=async(tx:SqlConnection,status:Pending['status'],result?:ToolResult)=>tx.query('UPDATE lf_code_tool_requests SET data=$1 WHERE space_id=$2 AND user_id=$3 AND request_id=$4',[JSON.stringify({digest,status,startedAt:started,...(result?{result}:{})}),reserved.state.space.id,who.user.id,input.requestId]);
    try{return await withFlight(request,who,async signal=>{
      let brokerCalls=0;const count=()=>{if(++brokerCalls>8)fail(422,'TOOL_CAPABILITY_DENIED','The tool exceeded its capability call limit.');};
      const check=async()=>{if(signal.aborted)fail(409,'TOOL_ABORTED','Tool execution stopped.');const state=await live(who,slug);assertToolBinding(state,input,toolId,input.toolVersion,'generated');const tool=await store.getCodeTool(state.space.id,toolId,input.toolVersion);if(!tool?.enabled||fingerprint(tool.spec)!==fingerprint(reserved.tool.spec))fail(403,'TOOL_NOT_ENABLED','The tool is no longer enabled.');return state;};
      const result=await adapter.invoke(reserved.tool.spec,input.input,{signal,broker:{
        async readRecords({fields,limit=100}){count();const state=await check();if(!Number.isInteger(limit)||limit<1||limit>100||fields.some(id=>!reserved.tool.spec.capabilities.publicRecordFields.includes(id)||!state.definition?.entitySchema.fields.some(f=>f.id===id&&f.public)))fail(403,'TOOL_CAPABILITY_DENIED','The requested public fields are unavailable.');const rows=state.records.slice(0,limit).map(row=>({id:row.id,version:row.version,values:Object.fromEntries(fields.filter(id=>Object.hasOwn(row.values,id)).map(id=>[id,row.values[id]!]))}));if(!isBoundedJson(rows))fail(422,'TOOL_DATA_LIMIT','The selected records exceed the tool data limit.');return rows as JsonObject[];},
        async callConnector(ref){count();const state=await check();if(!reserved.tool.spec.capabilities.connectors.some(c=>c.toolId===ref.toolId&&c.toolVersion===ref.toolVersion))fail(403,'TOOL_CAPABILITY_DENIED','This connector was not declared.');const tool=await store.getTool(state.space.id,ref.toolId,ref.toolVersion);if(!tool?.enabled||!connectors)fail(403,'TOOL_CAPABILITY_DENIED','This connector is unavailable.');const result=await connectors.invoke(tool.spec,ref.input,signal);await check();const after=await store.getTool(state.space.id,ref.toolId,ref.toolVersion);if(!after?.enabled||fingerprint(after.spec)!==fingerprint(tool.spec)||!isBoundedJson(result))fail(403,'TOOL_CAPABILITY_DENIED','The connector changed or returned too much data.');return result as JsonObject;},
      }});await check();try{validateToolJson(reserved.tool.spec.outputSchema,result);}catch{fail(422,'TOOL_OUTPUT_INVALID','The result does not match this tool schema.');}
      return store.db.transaction(async tx=>{const state=await live(who,slug,tx,true);if(signal.aborted)fail(409,'TOOL_ABORTED','Tool execution stopped.');assertToolBinding(state,input,toolId,input.toolVersion,'generated');const tool=await store.getCodeTool(state.space.id,toolId,input.toolVersion,tx);if(!tool?.enabled||fingerprint(tool.spec)!==fingerprint(reserved.tool.spec))fail(403,'TOOL_NOT_ENABLED','The tool is no longer enabled.');await capabilities(tool.spec,state,tx);const response:ToolResult={toolId,toolVersion:input.toolVersion,result,reused:tool.invocationCount>0};tool.invocationCount++;await store.putCodeTool(state.space.id,tool,tx);await store.auditTool(state.space.id,toolId,input.toolVersion,'ok',Date.now()-started,tx);await update(tx,'ok',response);return response;});
    },14_000,reply);}catch(error){await store.db.transaction(async tx=>{await update(tx,'failed');await store.auditTool(reserved.state.space.id,toolId,input.toolVersion,'failed',Date.now()-started,tx);});if(error instanceof ApiProblem)throw error;fail(503,'TOOL_FAILED','The isolated tool could not finish this request.');}
  });
  app.addHook('preClose',async()=>{for(const controller of flights.keys())controller.abort();});
  return {manifests,validateBindings,testCandidates,publishCandidates,revokeAuth(session:StoredSession){for(const [controller,who] of flights)if(who.csrfToken===session.csrfToken&&who.user.id===session.userId)controller.abort();}};
}
