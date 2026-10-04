import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthApi, StoredSession } from '@livingforma/auth';
import { generationRequestSchema, generationPreviewSchema, generationPublishSchema, generationOutlineSchema, proposalSchema, validateGeneratedArtifact, type Definition, type DefinitionVersionSummary, type GenerationJob, type GenerationStage, type Proposal, type SiteGenerator, type SiteGenerationProgress, type User } from '@livingforma/contracts';
import type { Store, SqlConnection, SpaceState } from '@livingforma/db';
import { ApiProblem, applyProposal, assertRead, fail, fingerprint, projection, requireOwner } from './domain';
import { assertArtifactAssets } from './assets';
import { renderGeneratedFrame } from './generated-frame';
import type { CodeToolsController } from './generated-tools';

type JobRow={job:GenerationJob;userId:string;sessionHash:string;digest:string;current:Definition|null;leaseUntil:number;workerId:string};
type Identity={user:User;sessionHash:string};
type Params={slug:string;id:string};
const BUSY:GenerationStage[]=['queued','planning','writing','validating','repairing'];
const DONE:GenerationStage[]=['failed','cancelled','published'];
const messages:Record<GenerationStage,string>={queued:'Your request is queued.',planning:'Planning your website.',writing:'Writing the website source.',validating:'Checking source and data compatibility.',repairing:'Repairing the reported issue.',preview:'The candidate is ready for your browser preview.',checked:'This source revision passed the Owner browser preview check.',publishing:'Publishing the checked revision.',published:'The website is published.',failed:'Generation could not finish. Your published website is unchanged.',cancelled:'Generation was cancelled. Your published website is unchanged.'};
const sensitive=/(?:Bearer\s+[A-Za-z0-9._-]{12,}|AIza[\w-]{20,}|(?:api[_-]?key|client[_-]?secret|csrf[_-]?token|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9_-]{12,})/i;
const safeDiagnostic=(message:string)=>sensitive.test(message)?'The diagnostic contained sensitive information and was withheld.':message.slice(0,500);
function modelDefinition(current:Definition|null){
  if(!current)return null;const safe=structuredClone(current);
  for(const field of safe.entitySchema.fields)if(!field.public)delete field.defaultValue;
  return safe;
}
function modelRepair(repair:{proposal:Proposal;errors:string[]}|undefined){
  if(!repair)return undefined;const safe=structuredClone(repair);
  for(const field of safe.proposal.entitySchema.fields)if(!field.public)delete field.defaultValue;
  return safe;
}
function restorePrivateFields(proposal:Proposal,current:Definition|null){
  if(!current)return proposal;
  const result=structuredClone(proposal),privateFields=current.entitySchema.fields.filter(field=>!field.public);
  for(const field of privateFields){const index=result.entitySchema.fields.findIndex(candidate=>candidate.id===field.id);if(index<0)result.entitySchema.fields.push(structuredClone(field));else result.entitySchema.fields[index]=structuredClone(field);}
  return result;
}
export type GenerationController={revokeAuth(session:StoredSession):void};

export async function registerGenerations(app:FastifyInstance,options:{store:Store;auth:AuthApi;siteGenerator?:SiteGenerator;codeTools:CodeToolsController}):Promise<GenerationController>{
  const {store,auth,siteGenerator,codeTools}=options, workerId=randomUUID();
  const workers=new Map<string,{controller:AbortController;sessionHash:string;promise:Promise<void>}>();
  const scheduled=new Set<string>();
  const streams=new Set<()=>void>();let closing=false,starts=0;
  async function load(id:string,tx:SqlConnection=store.db,lock=false){return (await tx.query<{data:JobRow}>(`SELECT data FROM lf_generations WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0]?.data??null;}
  async function save(row:JobRow,tx:SqlConnection){await tx.query('UPDATE lf_generations SET data=$1 WHERE id=$2',[JSON.stringify(row),row.job.id]);}
  function event(row:JobRow,stage:GenerationStage,message=messages[stage],source?:SiteGenerationProgress['source'],extra?:Pick<SiteGenerationProgress,'ui'|'tool'>){
    row.job.stage=stage;row.job.updatedAt=new Date().toISOString();
    const sequence=(row.job.events.at(-1)?.sequence??0)+1;
    // All events are retained for replay. Stop source progress before reaching this bound.
    if(row.job.events.length>=96)fail(422,'GENERATION_EVENT_LIMIT','The generation produced too many progress events.');
    row.job.events.push({sequence,stage,message,at:row.job.updatedAt,sourceRevision:row.job.sourceRevision,...(source?{source}: {}),...extra});
  }
  async function identity(request:FastifyRequest,write=false):Promise<Identity>{
    const session=await auth.getSession(request);if(!session.user||!session.csrfToken)fail(401,'LOGIN_REQUIRED','Please sign in to build this website.');
    if(write)await auth.verifyCsrf(request);
    // Resolve the existing AuthStore session; never create another authentication mechanism.
    const stored=(await store.db.query<{token_hash:string}>('SELECT token_hash FROM lf_sessions WHERE user_id=$1 AND data->>\'csrfToken\'=$2 AND expires_at>now()',[session.user.id,session.csrfToken])).rows[0];
    if(!stored)fail(401,'SESSION_EXPIRED','Your sign-in session has expired.');return {user:session.user,sessionHash:stored.token_hash};
  }
  async function live(row:JobRow,tx:SqlConnection,state:SpaceState){
    const session=(await tx.query('SELECT token_hash FROM lf_sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>now() FOR SHARE',[row.sessionHash,row.userId])).rows[0];
    if(!session)fail(401,'SESSION_EXPIRED','The original sign-in session is no longer active.');
    requireOwner(state,{id:row.userId,name:'Owner'});
  }
  async function transaction<T>(id:string,fn:(row:JobRow,state:SpaceState,tx:SqlConnection)=>Promise<T>,checkLive=true){
    const initial=await load(id);if(!initial)fail(404,'GENERATION_NOT_FOUND','This generation does not exist.');
    return store.db.transaction(async tx=>{
      const state=await store.getSpace(initial.job.slug,tx,true);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');
      const row=await load(id,tx,true);if(!row)fail(404,'GENERATION_NOT_FOUND','This generation does not exist.');
      if(checkLive)await live(row,tx,state);return fn(row,state,tx);
    });
  }
  async function owned(request:FastifyRequest<{Params:Params}>,write=false){
    const who=await identity(request,write);let row=await load(request.params.id);const state=await store.getSpace(request.params.slug);
    if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');requireOwner(state,who.user);
    if(!row||row.job.spaceId!==state.space.id||row.userId!==who.user.id||row.sessionHash!==who.sessionHash)fail(404,'GENERATION_NOT_FOUND','This generation is not available in this sign-in session.');
    if(BUSY.includes(row.job.stage)&&row.leaseUntil<Date.now()){workers.get(row.job.id)?.controller.abort();await failJob(row.job.id,'Generation was interrupted after its worker deadline. Submit a new request to try again.');row=(await load(row.job.id))!;}
    return row;
  }
  async function validateCandidate(proposal:Proposal,state:SpaceState,tx:SqlConnection){
    if(!proposal.appSpec.generated)fail(422,'GENERATED_SOURCE_REQUIRED','The candidate must include a generated website.');
    if(proposal.toolProposals?.length)fail(422,'TOOL_APPROVAL_REQUIRED','Enable proposed tools through the trusted tool approval flow first.');
    if(sensitive.test(JSON.stringify(proposal.appSpec.generated)))fail(422,'INVALID_GENERATED_SITE','Credentials cannot be included in generated source.');
    try{validateGeneratedArtifact(proposal.appSpec.generated);applyProposal(structuredClone(state),proposal);}catch(error){if(error instanceof ApiProblem)throw error;fail(422,'INVALID_GENERATED_SITE',safeDiagnostic(error instanceof Error?error.message:'The source or data definition could not pass validation.'));}
    await assertArtifactAssets(store,state,proposal.appSpec.generated.assetIds,tx);
    for(const c of proposal.appSpec.components)if(c.toolRef){const tool=await store.getTool(state.space.id,c.toolRef.toolId,c.toolRef.toolVersion,tx);if(!tool?.enabled)fail(422,'TOOL_NOT_ENABLED','Enable referenced tools before publishing.');}
    await codeTools.validateBindings(proposal,{...state,definition:{...state.definition!,entitySchema:proposal.entitySchema}},tx,proposal.codeToolProposals);
  }
  async function failJob(id:string,message:string){await transaction(id,async(row,_state,tx)=>{if(DONE.includes(row.job.stage))return;delete row.job.proposal;row.job.error=message;event(row,'failed',message);row.leaseUntil=0;await save(row,tx);},false);}
  // The initial deployment is a single worker process. Recovery never retries model calls.
  const unfinished=(await store.db.query<{data:JobRow}>('SELECT data FROM lf_generations')).rows.filter(({data})=>BUSY.includes(data.job.stage));
  for(const {data} of unfinished)await failJob(data.job.id,'Generation was interrupted by a server restart. Submit a new request to try again.');
  function schedule(id:string,repair?:{proposal:Proposal;errors:string[]}){
    if(closing||scheduled.has(id)||workers.has(id))return;scheduled.add(id);
    setImmediate(()=>{void run(id,repair).catch(()=>scheduled.delete(id));});
  }
  async function run(id:string,repair?:{proposal:Proposal;errors:string[]}){
    const initial=await load(id);if(!initial||closing){scheduled.delete(id);return;}
    const controller=new AbortController();let chain=Promise.resolve();let progressCount=0,sourceBytes=0;
    const writeProgress=(progress:SiteGenerationProgress)=>{
      if(controller.signal.aborted||progressCount++>=60)return;
      const source:SiteGenerationProgress['source']={};
      for(const key of ['html','css','js'] as const){const value=progress.source?.[key];if(typeof value==='string'&&!sensitive.test(value)){const part=value.slice(0,key==='css'?40000:60000);if(sourceBytes+part.length<=180000){source[key]=part;sourceBytes+=part.length;}}}
      const stage=['planning','writing','validating','repairing'].includes(progress.stage)?progress.stage:'writing';
      const outline=generationOutlineSchema.safeParse(progress.ui),tool=progress.tool;
      const extra:Pick<SiteGenerationProgress,'ui'|'tool'>={...(outline.success&&!sensitive.test(JSON.stringify(outline.data))?{ui:outline.data}:{}),...(tool?.phase==='writing'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(tool.toolId)&&typeof tool.name==='string'&&tool.name.length<=80&&!sensitive.test(tool.name)?{tool:{toolId:tool.toolId,name:tool.name,phase:'writing' as const}}:{})};
      chain=chain.then(()=>transaction(id,async(row,_state,tx)=>{if(controller.signal.aborted||DONE.includes(row.job.stage)||row.job.events.length>=80)return;event(row,stage,messages[stage],Object.keys(source).length?source:undefined,extra);await save(row,tx);})).catch(error=>{controller.abort(error);});
    };
    let abort:()=>void=()=>{};
    const promise=(async()=>{
      let candidate:Proposal|undefined,retry:{proposal:Proposal;errors:string[]}|undefined;
      const timeout=setTimeout(()=>controller.abort(new ApiProblem(503,'GENERATION_TIMEOUT','Generation timed out.')),90_000);timeout.unref();
      let checking=false;const timer=setInterval(()=>{if(checking||controller.signal.aborted)return;checking=true;void transaction(id,async row=>{if(row.leaseUntil<Date.now()||DONE.includes(row.job.stage))throw new Error('Generation stopped.');}).catch(error=>controller.abort(error)).finally(()=>{checking=false;});},1000);timer.unref();
      try{
        await transaction(id,async(row,_state,tx)=>{if(DONE.includes(row.job.stage))throw new Error('Generation stopped.');event(row,repair?'repairing':'planning');await save(row,tx);});
        const cancelled=new Promise<never>((_resolve,reject)=>{abort=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',abort,{once:true});if(controller.signal.aborted)abort();});
        const raw=await Promise.race([siteGenerator!({prompt:initial.job.prompt,current:modelDefinition(initial.current),registeredTools:await codeTools.manifests(initial.job.spaceId),registeredCatalogTools:(await store.getTools(initial.job.spaceId)).filter(tool=>tool.enabled),signal:controller.signal,onProgress:writeProgress,...(repair?{repair:modelRepair(repair)}: {})}),cancelled]);
        await chain;if(controller.signal.aborted)throw controller.signal.reason;
        let proposal:Proposal;
        try{proposal=restorePrivateFields(proposalSchema.parse(raw),initial.current);candidate=proposal;}catch{throw new ApiProblem(422,'INVALID_GENERATED_SITE','The generator returned an invalid candidate.');}
        // Shape/source checks and DB lookups are short transactions; guest execution is outside them.
        await transaction(id,async(row,state,tx)=>{event(row,'validating');row.job.toolReports=[];await validateCandidate(proposal,{...state,definition:row.current,records:[]},tx);await save(row,tx);});
        const candidateState=await store.getSpace(initial.job.slug);if(!candidateState)throw new Error('Space is unavailable.');
        try{await codeTools.testCandidates(proposal,{...candidateState,definition:{...candidateState.definition!,entitySchema:proposal.entitySchema}},controller.signal,async report=>{
          await transaction(id,async(row,_state,tx)=>{if(controller.signal.aborted||!BUSY.includes(row.job.stage))throw new Error('Generation stopped.');row.job.toolReports??=[];row.job.toolReports.push(report);event(row,'validating',report.report.ok?'Generated tool fixtures passed.':'Generated tool fixtures failed.',undefined,{tool:{toolId:report.toolId,name:report.name,phase:report.report.ok?'ready':'failed'}});await save(row,tx);});
        },async spec=>{await transaction(id,async(row,_state,tx)=>{event(row,'validating','Running generated tool fixtures.',undefined,{tool:{toolId:spec.toolId,name:spec.name,phase:'testing'}});await save(row,tx);});});}catch(error){if(error instanceof ApiProblem&&['INVALID_CODE_TOOL','TOOL_CAPABILITY_DENIED','TOOL_VERSION_CONFLICT','TOOL_TEST_FAILED'].includes(error.code))throw new ApiProblem(422,'INVALID_GENERATED_SITE',error.message);throw error;}
        await transaction(id,async(row,state,tx)=>{
          if(controller.signal.aborted||!BUSY.includes(row.job.stage))throw new Error('Generation stopped.');
          event(row,'validating');await validateCandidate(proposal,{...state,definition:row.current,records:[]},tx);
          row.job.proposal=proposal;delete row.job.error;row.leaseUntil=0;event(row,'preview');await save(row,tx);
        });
      }catch(error){
        await chain;
        const current=await load(id);
        // One bounded repair is shared by static validation and actual browser diagnostics.
        if(!controller.signal.aborted&&candidate&&current&&current.job.repairCount===0&&error instanceof ApiProblem&&['INVALID_GENERATED_SITE','INVALID_CODE_TOOL','TOOL_CAPABILITY_DENIED','TOOL_VERSION_CONFLICT','TOOL_NOT_ENABLED'].includes(error.code)){
          retry={proposal:candidate,errors:[safeDiagnostic(error.message)]};
          await transaction(id,async(row,_state,tx)=>{row.job.repairCount=1;row.job.sourceRevision++;delete row.job.proposal;delete row.job.toolReports;row.leaseUntil=Date.now()+90_000;event(row,'repairing');await save(row,tx);});
        }else if(current&&!DONE.includes(current.job.stage))await failJob(id,controller.signal.aborted?'Generation stopped before a valid result was available. Your published website is unchanged.':error instanceof ApiProblem?error.message:error&&typeof error==='object'&&'code'in error&&error.code==='FREE_QUOTA_EXHAUSTED'?'The verified AI allowance has been used. No paid fallback is enabled.':'Generation could not finish. Your published website is unchanged.');
      }finally{clearTimeout(timeout);clearInterval(timer);controller.signal.removeEventListener('abort',abort);workers.delete(id);if(retry&&!closing)schedule(id,retry);}
    })();
    workers.set(id,{controller,sessionHash:initial.sessionHash,promise});scheduled.delete(id);await promise;
  }
  app.post<{Params:{slug:string}}>('/api/spaces/:slug/generations',{config:{rateLimit:{max:6,timeWindow:'1 minute'}}},async(request,reply)=>{
    const who=await identity(request,true),input=generationRequestSchema.parse(request.body);
    if(sensitive.test(input.prompt))fail(422,'SENSITIVE_PROMPT','Remove credentials from your website request before submitting it.');
    if(!siteGenerator)fail(503,'GENERATOR_UNAVAILABLE','Website generation is not configured.');
    starts++;try{
      const row=await store.db.transaction(async tx=>{
        const state=await store.getSpace(request.params.slug,tx,true);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');requireOwner(state,who.user);
        const old=(await tx.query<{data:JobRow}>('SELECT data FROM lf_generations WHERE space_id=$1 AND user_id=$2 AND request_id=$3',[state.space.id,who.user.id,input.requestId])).rows[0]?.data;
        if(old){if(old.digest!==fingerprint(input))fail(409,'REQUEST_ID_CONFLICT','Use a new request ID for a different generation.');if(old.sessionHash!==who.sessionHash)fail(409,'GENERATION_SESSION_CHANGED','This request belongs to an earlier sign-in. Submit a new request.');return {row:old,created:false};}
        if(workers.size+scheduled.size+starts>4)fail(429,'GENERATION_BUSY','The generator is busy. Please try again shortly.');
        const busy=(await tx.query<{data:JobRow}>('SELECT data FROM lf_generations WHERE space_id=$1',[state.space.id])).rows.some(({data})=>BUSY.includes(data.job.stage));if(busy)fail(409,'GENERATION_BUSY','A generation is already running in this space.');
        if(input.baseDefinitionVersion!==(state.definition?.definitionVersion??0))fail(409,'DEFINITION_CONFLICT','This website has changed. Refresh before generating.');
        const time=new Date().toISOString();const row:JobRow={job:{id:randomUUID(),spaceId:state.space.id,slug:state.space.slug,requestId:input.requestId,baseDefinitionVersion:input.baseDefinitionVersion,sourceRevision:1,stage:'queued',prompt:input.prompt,createdAt:time,updatedAt:time,events:[],repairCount:0},userId:who.user.id,sessionHash:who.sessionHash,digest:fingerprint(input),current:state.definition,workerId,leaseUntil:Date.now()+90_000};
        await live(row,tx,state);event(row,'queued');await tx.query('INSERT INTO lf_generations(id,space_id,user_id,request_id,data) VALUES($1,$2,$3,$4,$5)',[row.job.id,state.space.id,who.user.id,input.requestId,JSON.stringify(row)]);return {row,created:true};
      });
      if(row.created)schedule(row.row.job.id);return reply.code(row.created?202:200).send(row.row.job);
    }finally{starts--;}
  });
  app.get<{Params:Params}>('/api/spaces/:slug/generations/:id',async request=>(await owned(request)).job);
  app.post<{Params:Params}>('/api/spaces/:slug/generations/:id/preview',async request=>{
    await owned(request,true);const input=generationPreviewSchema.parse(request.body);
    starts++;try{
    const result=await transaction(request.params.id,async(row,_state,tx)=>{
      if(input.sourceRevision!==row.job.sourceRevision)fail(409,'SOURCE_REVISION_CONFLICT','This report belongs to an older source revision.');
      if(!['preview','checked'].includes(row.job.stage)||!row.job.proposal)fail(409,'PREVIEW_UNAVAILABLE','There is no validated candidate to check.');
      if(input.ok){if(row.job.stage!=='checked'){event(row,'checked');await save(row,tx);}return {job:row.job};}
      if(row.job.repairCount>=1){delete row.job.proposal;row.job.error='The repaired candidate still has browser errors. Your published website is unchanged.';event(row,'failed',row.job.error);await save(row,tx);return {job:row.job};}
      if(workers.size+scheduled.size+starts>4)fail(429,'GENERATION_BUSY','The generator is busy. Please retry the browser report shortly.');
      const repair={proposal:row.job.proposal,errors:(input.errors.length?input.errors:['The Owner browser preview reported an error.']).map(safeDiagnostic)};
      row.job.repairCount++;row.job.sourceRevision++;delete row.job.proposal;delete row.job.toolReports;row.leaseUntil=Date.now()+90_000;event(row,'repairing');await save(row,tx);return {job:row.job,repair};
    });if(result.repair)schedule(request.params.id,result.repair);return result.job;
    }finally{starts--;}
  });
  app.post<{Params:Params}>('/api/spaces/:slug/generations/:id/publish',async request=>{
    await owned(request,true);const input=generationPublishSchema.parse(request.body),payload={operation:'generation.publish',id:request.params.id,...input};
    return transaction(request.params.id,async(row,state,tx)=>{
      const replay=await store.request(tx,state.space.id,row.userId,input.requestId);
      if(replay){if(replay.fingerprint!==fingerprint(payload))fail(409,'REQUEST_ID_CONFLICT','This request ID was already used for a different operation.');return {snapshot:projection(state,{id:row.userId,name:'Owner'}),job:row.job};}
      if(row.job.sourceRevision!==input.sourceRevision)fail(409,'SOURCE_REVISION_CONFLICT','Only the checked source revision can be published.');
      if(row.job.stage==='published')return {snapshot:projection(state,{id:row.userId,name:'Owner'}),job:row.job};
      if(row.job.stage!=='checked'||!row.job.proposal)fail(409,'PREVIEW_REQUIRED','Check this candidate in the browser before publishing.');
      if(row.job.baseDefinitionVersion!==(state.definition?.definitionVersion??0))fail(409,'DEFINITION_CONFLICT','The published website has changed. Generate again from its current version.');
      await validateCandidate(row.job.proposal,state,tx);event(row,'publishing');applyProposal(state,row.job.proposal);await codeTools.publishCandidates(row.job.proposal,row.job.toolReports??[],state,tx);await store.event(state,'definition.published',tx);
      row.job.publishedVersion=state.definition!.definitionVersion;event(row,'published');await save(row,tx);await store.remember(tx,state.space.id,row.userId,input.requestId,fingerprint(payload),{jobId:row.job.id});
      return {snapshot:projection(state,{id:row.userId,name:'Owner'}),job:row.job};
    });
  });
  app.post<{Params:Params}>('/api/spaces/:slug/generations/:id/cancel',async request=>{
    await owned(request,true);const job=await transaction(request.params.id,async(row,_state,tx)=>{if(!DONE.includes(row.job.stage)){delete row.job.proposal;event(row,'cancelled');row.leaseUntil=0;await save(row,tx);}return row.job;});workers.get(request.params.id)?.controller.abort();return job;
  });
  app.get<{Params:{slug:string}}>('/api/spaces/:slug/versions',async request=>{
    const who=await identity(request),state=await store.getSpace(request.params.slug);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');requireOwner(state,who.user);
    const rows=await store.db.query<{data:Definition;created_at:Date|string}>('SELECT data,created_at FROM lf_definition_versions WHERE space_id=$1 ORDER BY version DESC',[state.space.id]);return {versions:rows.rows.map(({data,created_at})=>({definitionVersion:data.definitionVersion,summary:data.summary,createdAt:new Date(created_at).toISOString(),generated:!!data.appSpec.generated} satisfies DefinitionVersionSummary))};
  });
  app.get<{Params:Params}>('/api/spaces/:slug/generations/:id/events',async(request,reply)=>{
    await owned(request);const query=z.object({after:z.coerce.number().int().nonnegative().optional()}).parse(request.query);let cursor=query.after??z.coerce.number().int().nonnegative().parse(request.headers['last-event-id']??0);
    const initial=await load(request.params.id);if(cursor>(initial!.job.events.at(-1)?.sequence??0))fail(409,'GENERATION_CURSOR_INVALID','Reload the generation to recover its event cursor.');
    reply.hijack();reply.raw.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Connection':'keep-alive','X-Accel-Buffering':'no'});reply.raw.write(': connected\n\n');
    let closed=false,busy=false,ticks=0;const close=()=>{if(closed)return;closed=true;clearInterval(timer);streams.delete(close);reply.raw.end();};
    const drain=async()=>{if(closed||busy)return;busy=true;try{const row=await owned(request);for(const event of row.job.events)if(event.sequence>cursor){reply.raw.write(`id: ${event.sequence}\nevent: generation\ndata: ${JSON.stringify(event)}\n\n`);cursor=event.sequence;}if(DONE.includes(row.job.stage))close();else if(++ticks%15===0)reply.raw.write(': heartbeat\n\n');}catch{close();}finally{busy=false;}};
    const timer=setInterval(()=>{void drain();},500);timer.unref();streams.add(close);reply.raw.on('close',close);await drain();
  });
  const frameQuery=z.object({space:z.string().min(1).max(63),generation:z.string().uuid().optional(),revision:z.coerce.number().int().positive().optional(),version:z.coerce.number().int().positive().optional(),channel:z.string().regex(/^[A-Za-z0-9_-]{16,100}$/)}).strict().refine(q=>q.generation?!!q.revision&&!q.version:!!q.version&&!q.revision);
  app.get('/api/generated-frame',async(request,reply)=>{
    const q=frameQuery.parse(request.query),session=await auth.getSession(request),state=await store.getSpace(q.space);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');assertRead(state,session.user);
    let definition:Definition;
    if(q.generation){
      const who=await identity(request);requireOwner(state,who.user);const row=await load(q.generation);
      if(!row||row.job.spaceId!==state.space.id||row.sessionHash!==who.sessionHash||row.userId!==who.user.id)fail(404,'GENERATION_NOT_FOUND','This preview is not available in this sign-in session.');
      if(row.job.sourceRevision!==q.revision||!['preview','checked','published'].includes(row.job.stage)||!row.job.proposal)fail(409,'PREVIEW_UNAVAILABLE','This source revision is no longer available for preview.');
      definition={definitionVersion:row.job.baseDefinitionVersion+1,entitySchema:row.job.proposal.entitySchema,appSpec:row.job.proposal.appSpec,summary:row.job.proposal.summary};
    }else{
      const version=(await store.db.query<{data:Definition}>('SELECT data FROM lf_definition_versions WHERE space_id=$1 AND version=$2',[state.space.id,q.version])).rows[0];
      if(!version)fail(404,'VERSION_NOT_FOUND','This published website version does not exist.');definition=version.data;
    }
    if(!definition.appSpec.generated)fail(404,'GENERATED_SITE_NOT_FOUND','This version does not contain a generated website.');
    const artifact=validateGeneratedArtifact(definition.appSpec.generated);return reply.type('text/html; charset=utf-8').send(renderGeneratedFrame(artifact,q.channel));
  });
  app.addHook('preClose',async()=>{closing=true;for(const close of streams)close();for(const worker of workers.values())worker.controller.abort();await Promise.allSettled([...workers.values()].map(worker=>worker.promise));});
  return {revokeAuth(session){for(const worker of workers.values())if(worker.sessionHash===session.tokenHash)worker.controller.abort();}};
}
