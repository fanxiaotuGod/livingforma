import Fastify, { type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { COMPONENT_MANIFESTS, mutationSchema, proposalRequestSchema, proposalSchema, toolSpecSchema, readingDefinition, habitDefinition, exampleRecords, type Proposal, type Definition, type ToolAdapter, type ToolResult, type RegisteredTool, type ToolProposal, type ProposalResponse, type MediaAdapter } from '@livingforma/contracts';
import { registerAuth } from '@livingforma/auth';
import type { AuthApi, AuthOptions } from '@livingforma/auth';
import { Store, type Database, type SpaceState } from '@livingforma/db';
import { createAuthStore } from './auth-store';
import { registerMedia, type MediaController } from './media';
import { ApiProblem, fail, assertRead, projection, roleFor, requireOwner, applyMutation, applyProposal, replay, fingerprint } from './domain';

export type Planner=(input:{prompt:string;current:Definition|null;mode?:'local'|'gemini';signal?:AbortSignal;registeredTools?:RegisteredTool[]})=>Promise<Proposal>;
export type ToolPlanner=(input:{prompt:string;registered?:RegisteredTool[];mode?:'local'|'gemini';signal?:AbortSignal})=>Promise<ToolProposal>;
export type AppOptions={db:Database;origin:string;localDemo?:boolean;googleClientId?:string;googleClientSecret?:string;planner?:Planner;toolPlanner?:ToolPlanner;plannerMode?:'local'|'gemini';tools?:ToolAdapter;media?:MediaAdapter;mediaNow?:()=>number;staticDir?:string;logger?:boolean;authFactory?:(app:ReturnType<typeof Fastify>,options:AuthOptions)=>Promise<AuthApi>;closeDatabase?:boolean};
const createSpaceSchema=z.object({title:z.string().trim().min(1).max(120),slug:z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/).optional(),prompt:z.string().trim().min(1).max(4000).optional()}).strict();
const toolRegistrationSchema=z.object({spec:toolSpecSchema,enable:z.boolean()}).strict();
const toolProposalRequestSchema=z.object({prompt:z.string().trim().min(1).max(4000)}).strict();
const toolProposalResponseSchema=z.object({spec:toolSpecSchema.nullable(),reused:z.boolean(),requiresEnable:z.boolean(),summary:z.string().max(500),source:z.enum(['gemini','local-rules'])}).strict();
const invocationSchema=z.object({toolVersion:z.number().int().positive(),input:z.record(z.unknown()),requestId:z.string().uuid()}).strict();
const querySchema=z.object({after:z.coerce.number().int().nonnegative().default(0)});

export async function buildApp(options:AppOptions){
  const app=Fastify({logger:options.logger??false,disableRequestLogging:true,bodyLimit:128*1024,trustProxy:false});
  const store=new Store(options.db);
  await app.register(rateLimit,{global:true,max:180,timeWindow:'1 minute'});
  app.setErrorHandler((cause,request,reply)=>{
    const error=cause as Error & {statusCode?:number;code?:string};
    const status=error instanceof ApiProblem?error.statusCode:error instanceof z.ZodError?422:(error.statusCode&&error.statusCode<500?error.statusCode:500);
    const code=error instanceof ApiProblem?error.code:error instanceof z.ZodError?'INVALID_REQUEST':status===429?'RATE_LIMITED':typeof error.code==='string'&&status<500?error.code:'INTERNAL_ERROR';
    const message=error instanceof ApiProblem?error.message:error instanceof z.ZodError?'The request does not match the expected format.':status<500?error.message:'Something went wrong. Please try again.';
    if(status===500)app.log.error({code:'INTERNAL_ERROR',requestId:request.id},'Request failed');
    reply.code(status).send({error:{code,message,requestId:request.id}});
  });
  app.addHook('onSend',async(request,reply,payload)=>{
    reply.header('X-Content-Type-Options','nosniff').header('X-Frame-Options','DENY');
    if(!reply.getHeader('Referrer-Policy'))reply.header('Referrer-Policy','same-origin');
    reply.header('Permissions-Policy','camera=(self), microphone=(self), geolocation=()');
    reply.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://lh3.googleusercontent.com; connect-src 'self'; font-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com");
    if(request.url.startsWith('/api/')||request.url.startsWith('/auth/'))reply.header('Cache-Control','no-store');
    return payload;
  });
  let mediaController:MediaController|undefined;
  const auth=await (options.authFactory??registerAuth)(app,{store:createAuthStore(store,{onSessionDeleted:session=>mediaController?.revokeAuth(session)}),origin:options.origin,googleClientId:options.googleClientId,googleClientSecret:options.googleClientSecret,localDemo:options.localDemo});
  mediaController=registerMedia(app,{store,auth,adapter:options.media,now:options.mediaNow});
  const localEnabled=options.localDemo&&process.env.ENABLE_LOCAL_DEMO==='true'&&process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1','[::1]'].includes(new URL(options.origin).hostname);
  if(localEnabled)await seedLocal(store);
  async function stateFor(slug:string,user:Awaited<ReturnType<AuthApi['getSession']>>['user']){const state=await store.getSpace(slug);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');assertRead(state,user);return state;}
  async function writer(request:FastifyRequest){const user=await auth.requireUser(request);await auth.verifyCsrf(request);return user;}
  async function stillWriter(request:FastifyRequest,user:{id:string}){const current=await writer(request);if(current.id!==user.id)fail(401,'SESSION_CHANGED','Your sign-in session has changed. Please try again.');}
  // Only read-only GET tools are registered. Coalesce same-process retries while
  // keeping external I/O outside business transactions so logout stays responsive.
  // Durable replay below protects committed results across restarts/instances.
  const toolFlights=new Map<string,{fingerprint:string;users:number;failureRecorded:boolean;result:Promise<Record<string,unknown>>}>();
  function validate<T>(fn:()=>T):T{try{return fn();}catch(error){if(error instanceof ApiProblem)throw error;throw new ApiProblem(422,'INVALID_SPEC',error instanceof Error?error.message:'Invalid app definition.');}}
  function providerFailure(error:unknown):never{
    if(error instanceof ApiProblem)throw error;
    const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
    if(code==='FREE_QUOTA_EXHAUSTED')fail(503,code,'The free-use limit has been reached. No paid fallback is enabled.');
    if(['BUDGET_UNAVAILABLE','BUDGET_NOT_CONFIGURED'].includes(code))fail(503,code,'The free-use budget could not be verified. AI planning is paused.');
    fail(503,'PLANNER_UNAVAILABLE','The planner could not complete this change. Your current app is unchanged.');
  }
  async function plan(prompt:string,current:Definition|null,registeredTools:RegisteredTool[]=[]){
    if(!options.planner)fail(503,'PLANNER_UNAVAILABLE','The planner is not configured.');
    try{return proposalSchema.parse(await options.planner({prompt,current,registeredTools:registeredTools.filter(tool=>tool.enabled),mode:options.plannerMode??'local',signal:AbortSignal.timeout(30_000)}));}catch(error){providerFailure(error);}
  }
  function validateTool(input:unknown){if(!options.tools)fail(503,'TOOLS_UNAVAILABLE','Tool execution is not configured.');return validate(()=>options.tools!.validate(input));}

  app.get('/api/health',async()=>({ok:true,database:options.db.kind,stage:'application',planner:options.plannerMode??'local'}));
  app.get('/api/capabilities',async()=>({components:COMPONENT_MANIFESTS}));
  app.get('/api/spaces',async request=>{const {user}=await auth.getSession(request);return {spaces:(await store.listSpaces()).filter(state=>state.space.visibility==='public'||state.ownerId===user?.id||state.members.includes(user?.id??'')).map(state=>({id:state.space.id,slug:state.space.slug,title:state.space.title,role:roleFor(state,user)}))};});
  app.post('/api/spaces',async(request,reply)=>{
    const user=await writer(request);const input=createSpaceSchema.parse(request.body);
    const slug=input.slug??`space-${randomUUID().slice(0,8)}`;
    const state:SpaceState={space:{id:`sp_${randomUUID()}`,slug,title:input.title,timezone:'America/Vancouver',visibility:'public',participation:'authenticated'},ownerId:user.id,members:[],definition:null,records:[],stateVersion:0,eventCursor:0};
    const proposal=input.prompt?await plan(input.prompt,null):null;
    await stillWriter(request,user);
    if(proposal){if(proposal.toolProposals?.length)fail(422,'TOOL_APPROVAL_REQUIRED','Create a space first, then approve its proposed tools before publishing.');validate(()=>applyProposal(state,proposal));if(state.definition!.appSpec.components.some(component=>component.toolRef))fail(422,'TOOL_NOT_ENABLED','Create the space and enable its tool before publishing this component.');}
    try{await store.db.transaction(async tx=>{await store.insertSpace(state,tx);if(proposal)await store.event(state,'definition.published',tx);});}catch(error){if((error as {code?:string}).code==='23505')fail(409,'SLUG_EXISTS','That address is already in use.');throw error;}
    return reply.code(201).send(projection(state,user));
  });
  app.get<{Params:{slug:string}}>('/api/spaces/:slug/snapshot',async request=>{const {user}=await auth.getSession(request);return projection(await stateFor(request.params.slug,user),user);});
  app.post<{Params:{slug:string}}>('/api/spaces/:slug/actions',async request=>{
    const user=await writer(request);const input=mutationSchema.parse(request.body);
    return store.db.transaction(async tx=>{
      const state=await store.getSpace(request.params.slug,tx,true);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');
      assertRead(state,user);if(!projection(state,user).permissions.canWrite)fail(403,'WRITE_FORBIDDEN','You cannot write to this space.');
      if(await replay(store,tx,state,user,input.requestId,input))return projection(state,user);
      validate(()=>applyMutation(state,user,input));await store.event(state,'records.changed',tx);await store.remember(tx,state.space.id,user.id,input.requestId,fingerprint(input));return projection(state,user);
    });
  });
  app.post<{Params:{slug:string}}>('/api/spaces/:slug/proposals',{config:{rateLimit:{max:15,timeWindow:'1 minute'}}},async request=>{
    const user=await writer(request);const input=proposalRequestSchema.parse(request.body);const initial=await stateFor(request.params.slug,user);requireOwner(initial,user);
    const previous=await replay(store,store.db,initial,user,input.requestId,input);if(previous)return {snapshot:projection(initial,user),proposal:previous.result};
    if(input.baseDefinitionVersion!==(initial.definition?.definitionVersion??0))fail(409,'DEFINITION_CONFLICT','This app has changed. Refresh before trying again.');
    const proposal=await plan(input.prompt,initial.definition,await store.getTools(initial.space.id));
    await stillWriter(request,user);
    return store.db.transaction(async tx=>{
      const state=await store.getSpace(request.params.slug,tx,true);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');requireOwner(state,user);
      const old=await replay(store,tx,state,user,input.requestId,input);if(old)return {snapshot:projection(state,user),proposal:old.result};
      if(input.baseDefinitionVersion!==(state.definition?.definitionVersion??0))fail(409,'DEFINITION_CONFLICT','This app changed while the proposal was being prepared. Please try again.');
      // A pending tool proposal is data for the owner's review, never permission to execute.
      if(proposal.toolProposals?.length){
        const pending=[];
        for(const inputSpec of proposal.toolProposals){
          const spec=validateTool(inputSpec);const registered=await store.getTool(state.space.id,spec.toolId,spec.toolVersion,tx);
          if(registered&&fingerprint(registered.spec)!==fingerprint(spec))fail(409,'TOOL_VERSION_CONFLICT','Use a new version to change a registered tool.');
          if(!registered?.enabled)pending.push(spec);
        }
        if(pending.length){
          validate(()=>applyProposal(structuredClone(state),proposal));
          return {snapshot:projection(state,user),proposal:{...proposal,toolProposals:pending},requiresToolApproval:true} satisfies ProposalResponse;
        }
      }
      if(state.definition&&proposal.capabilityGaps.length&&fingerprint({entitySchema:proposal.entitySchema,appSpec:proposal.appSpec})===fingerprint({entitySchema:state.definition.entitySchema,appSpec:state.definition.appSpec}))fail(422,'CAPABILITY_UNAVAILABLE','This capability is not available yet. Your current app is unchanged.');
      validate(()=>applyProposal(state,proposal));
      for(const component of state.definition!.appSpec.components){if(component.toolRef){const tool=await store.getTool(state.space.id,component.toolRef.toolId,component.toolRef.toolVersion,tx);if(!tool?.enabled)fail(422,'TOOL_NOT_ENABLED','Enable the referenced tool before publishing this component.');}}
      await store.event(state,'definition.published',tx);await store.remember(tx,state.space.id,user.id,input.requestId,fingerprint(input),proposal);return {snapshot:projection(state,user),proposal};
    });
  });
  app.post<{Params:{slug:string}}>('/api/spaces/:slug/tool-proposals',{config:{rateLimit:{max:15,timeWindow:'1 minute'}}},async request=>{
    const user=await writer(request);const state=await stateFor(request.params.slug,user);requireOwner(state,user);const input=toolProposalRequestSchema.parse(request.body);
    if(!options.toolPlanner)fail(503,'PLANNER_UNAVAILABLE','Tool planning is not configured.');
    let proposal:ToolProposal;
    try{proposal=toolProposalResponseSchema.parse(await options.toolPlanner({prompt:input.prompt,registered:await store.getTools(state.space.id),mode:options.plannerMode??'local',signal:AbortSignal.timeout(30_000)}));}catch(error){providerFailure(error);}
    await stillWriter(request,user);requireOwner(await stateFor(request.params.slug,user),user);
    if(proposal.spec){
      const spec=validateTool(proposal.spec);const registered=await store.getTool(state.space.id,spec.toolId,spec.toolVersion);
      if(registered&&fingerprint(registered.spec)!==fingerprint(spec))fail(409,'TOOL_VERSION_CONFLICT','Use a new version to change a registered tool.');
      proposal={...proposal,spec,reused:!!registered,requiresEnable:!registered?.enabled};
    }
    return proposal;
  });
  app.get<{Params:{slug:string}}>('/api/spaces/:slug/tools',async request=>{const user=await auth.requireUser(request);const state=await stateFor(request.params.slug,user);requireOwner(state,user);return {tools:await store.getTools(state.space.id)};});
  app.post<{Params:{slug:string}}>('/api/spaces/:slug/tools',async request=>{
    const user=await writer(request);const initial=await stateFor(request.params.slug,user);requireOwner(initial,user);const input=toolRegistrationSchema.parse(request.body);
    if(!options.tools)fail(503,'TOOLS_UNAVAILABLE','Tool execution is not configured.');
    const spec=validate(()=>options.tools!.validate(input.spec));let result:{ok:boolean;message:string};try{result=await options.tools.test(spec,AbortSignal.timeout(12_000));}catch{fail(503,'TOOL_TEST_FAILED','The tool test could not complete. Your app and tool registry are unchanged.');}if(!result.ok)fail(422,'TOOL_TEST_FAILED','The tool could not pass validation and its test run.');
    await stillWriter(request,user);
    return store.db.transaction(async tx=>{const state=await store.getSpace(request.params.slug,tx,true);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');requireOwner(state,user);
      const previous=await store.getTool(state.space.id,spec.toolId,spec.toolVersion,tx);if(previous&&fingerprint(previous.spec)!==fingerprint(spec))fail(409,'TOOL_VERSION_CONFLICT','Use a new version to change a registered tool.');
      const tool:RegisteredTool={spec,enabled:input.enable,verifiedAt:new Date().toISOString(),invocationCount:previous?.invocationCount??0};await store.putTool(state.space.id,tool,tx);return {tool,reused:!!previous};});
  });
  app.post<{Params:{slug:string;toolId:string}}>('/api/spaces/:slug/tools/:toolId/invoke',{config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async request=>{
    const user=await writer(request);const input=invocationSchema.parse(request.body);if(!options.tools)fail(503,'TOOLS_UNAVAILABLE','Tool execution is not configured.');
    const initial=await stateFor(request.params.slug,user);requireOwner(initial,user);
    const payload={...input,toolId:request.params.toolId};const digest=fingerprint(payload);
    const old=await replay(store,store.db,initial,user,input.requestId,payload);if(old)return old.result as ToolResult;
    const checked=await store.getTool(initial.space.id,request.params.toolId,input.toolVersion);
    if(!checked?.enabled)fail(403,'TOOL_NOT_ENABLED','This tool is not enabled.');
    const flightKey=JSON.stringify([initial.space.id,user.id,input.requestId]);
    let flight=toolFlights.get(flightKey);
    if(flight&&flight.fingerprint!==digest)fail(409,'REQUEST_ID_CONFLICT','Use a new request identifier for a different operation.');
    if(!flight){flight={fingerprint:digest,users:0,failureRecorded:false,result:Promise.resolve().then(async()=>{
      // A preceding flight may have committed while this caller read the registry.
      // Install this flight synchronously, then recheck durable replay before I/O.
      const completed=await replay(store,store.db,initial,user,input.requestId,payload);
      if(completed)return (completed.result as ToolResult).result;
      return options.tools!.invoke(checked.spec,input.input,AbortSignal.timeout(checked.spec.timeoutMs));
    })};toolFlights.set(flightKey,flight);}
    flight.users++;const started=Date.now();
    try{
    let result:Record<string,unknown>;
    try{result=await flight.result;}catch{
      await stillWriter(request,user);requireOwner(await stateFor(request.params.slug,user),user);
      if(!flight.failureRecorded){flight.failureRecorded=true;await store.auditTool(initial.space.id,checked.spec.toolId,checked.spec.toolVersion,'failed',Date.now()-started);}
      fail(503,'TOOL_FAILED','The tool could not complete this request.');
    }
    await stillWriter(request,user);
    return await store.db.transaction(async tx=>{
      const state=await store.getSpace(request.params.slug,tx,true);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');requireOwner(state,user);
      const old=await replay(store,tx,state,user,input.requestId,payload);if(old)return old.result as ToolResult;
      const tool=await store.getTool(state.space.id,request.params.toolId,input.toolVersion,tx);if(!tool?.enabled)fail(403,'TOOL_NOT_ENABLED','This tool is not enabled.');
      if(fingerprint(tool.spec)!==fingerprint(checked.spec))fail(409,'TOOL_VERSION_CONFLICT','This tool changed while the query was running. Please try again.');
      const response:ToolResult={toolId:tool.spec.toolId,toolVersion:tool.spec.toolVersion,result,reused:tool.invocationCount>0};tool.invocationCount++;await store.putTool(state.space.id,tool,tx);await store.auditTool(state.space.id,tool.spec.toolId,tool.spec.toolVersion,'ok',Date.now()-started,tx);await store.remember(tx,state.space.id,user.id,input.requestId,fingerprint(payload),response);return response;
    });
    }finally{flight.users--;if(!flight.users&&toolFlights.get(flightKey)===flight)toolFlights.delete(flightKey);}
  });
  const streams=new Set<()=>void>();
  app.get<{Params:{slug:string}}>('/api/spaces/:slug/events',async(request,reply)=>{
    const {user}=await auth.getSession(request);const initial=await stateFor(request.params.slug,user);let cursor=querySchema.parse(request.query).after;
    reply.hijack();reply.raw.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});reply.raw.write(': connected\n\n');
    let closed=false;let busy=false;let ticks=0;
    const send=(event:unknown,type:string,id?:number)=>{if(!closed)reply.raw.write(`${id===undefined?'':`id: ${id}\n`}event: ${type}\ndata: ${JSON.stringify(event)}\n\n`);};
    const close=()=>{if(closed)return;closed=true;clearInterval(timer);streams.delete(close);reply.raw.end();};
    const reset=(state:SpaceState)=>{send({id:state.eventCursor,spaceId:state.space.id,type:'reset.required',definitionVersion:state.definition?.definitionVersion??0,stateVersion:state.stateVersion},'reset.required');close();};
    const drain=async()=>{if(closed||busy)return;busy=true;try{
      const currentSession=await auth.getSession(request);const current=await stateFor(request.params.slug,currentSession.user);
      if(cursor>current.eventCursor){reset(current);return;}
      const events=await store.events(initial.space.id,cursor);if(events.length&&events[0]!.id!==cursor+1){reset(current);return;}
      if(!events.length&&cursor<current.eventCursor){reset(current);return;}
      for(const event of events){if(event.id!==cursor+1){reset(current);return;}send(event,event.type,event.id);cursor=event.id;}
      if(++ticks%20===0)reply.raw.write(': heartbeat\n\n');
    }catch{close();}finally{busy=false;}};
    const timer=setInterval(()=>{void drain();},750);timer.unref();streams.add(close);reply.raw.on('close',close);await drain();
  });
  if(options.staticDir&&existsSync(options.staticDir)){
    await app.register(fastifyStatic,{root:options.staticDir,wildcard:false});
    app.setNotFoundHandler((request,reply)=>{if(request.method==='GET'&&!request.url.startsWith('/api/')&&!request.url.startsWith('/auth/'))return reply.sendFile('index.html');return reply.code(404).send({error:{code:'NOT_FOUND',message:'This endpoint does not exist.'}});});
  }
  app.addHook('preClose',async()=>{for(const close of streams)close();});
  app.addHook('onClose',async()=>{if(options.closeDatabase!==false)await options.db.close();});
  await app.ready();return {app,store,auth};
}
export async function seedLocal(store:Store){
  await store.putUser({id:'user-local-owner',name:'Local demo owner'});await store.putUser({id:'user-local-participant',name:'Local demo participant'});
  for(const kind of ['reading','habits'] as const){if(await store.getSpace(kind))continue;const definition=kind==='reading'?readingDefinition():habitDefinition();
    const state:SpaceState={space:{id:`sp_demo_${kind}`,slug:kind,title:definition.appSpec.title,timezone:'America/Vancouver',visibility:'public',participation:'authenticated'},ownerId:'user-local-owner',members:[],definition,records:exampleRecords(kind),stateVersion:1,eventCursor:0};
    await store.db.transaction(async tx=>{await store.insertSpace(state,tx);await store.event(state,'definition.published',tx);});
  }
}
