import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthApi, StoredSession } from '@livingforma/auth';
import { MEDIA_LIMITS, type MediaAdapter, type MediaCapabilities, type MediaSession, type MediaTranscript, type MediaObservation } from '@livingforma/contracts';
import type { Store } from '@livingforma/db';
import { ApiProblem, fail, requireOwner } from './domain';

const binding=(userId:string,csrfToken:string)=>createHash('sha256').update(`${userId}\0${csrfToken}`).digest('hex');
const startSchema=z.object({kind:z.enum(['voice','scene'])}).strict();
const sequenceSchema=z.number().int().min(1).max(2_147_483_647);
const transcriptionSchema=z.object({sequence:sequenceSchema,mimeType:z.literal('audio/wav'),audioBase64:z.string().min(1)}).strict();
const observationSchema=z.object({sequence:sequenceSchema,capturedAt:z.string().datetime(),mimeType:z.literal('image/jpeg'),imageBase64:z.string().min(1),includeSpeech:z.boolean().default(true)}).strict();
type Params={slug:string;sessionId:string};
type DeviceSession={id:string;kind:MediaSession['kind'];authBinding:string;spaceId:string;slug:string;expiresAt:number;sequence:number;frames:number;lastFrameAt:number;controller?:AbortController;expiryTimer?:ReturnType<typeof setTimeout>};
export type MediaController={revokeAuth(session:StoredSession):void;close():void};

function decodeBase64(encoded:string,maxBytes:number){
  if(encoded.length>Math.ceil(maxBytes/3)*4)fail(413,'MEDIA_TOO_LARGE','This recording or image exceeds the size limit.');
  if(encoded.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))fail(422,'INVALID_MEDIA','Send a valid base64 recording or image.');
  const bytes=Buffer.from(encoded,'base64');
  if(bytes.length>maxBytes)fail(413,'MEDIA_TOO_LARGE','This recording or image exceeds the size limit.');
  if(!bytes.length||bytes.toString('base64')!==encoded)fail(422,'INVALID_MEDIA','Send a valid recording or image.');
  return bytes;
}
function providerError(error:unknown):ApiProblem{
  if(error instanceof ApiProblem)return error;
  const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
  if(code==='FREE_QUOTA_EXHAUSTED')return new ApiProblem(503,code,'The verified media allowance has been used. No paid fallback is enabled.');
  if(['INVALID_AUDIO','INVALID_WAV','INVALID_MEDIA','UNSUPPORTED_MEDIA','AUDIO_TOO_LONG','AUDIO_TOO_LARGE'].includes(code))return new ApiProblem(422,'INVALID_MEDIA','This recording or image could not be validated. Please capture it again.');
  if(['PROVIDER_NOT_CONFIGURED','MEDIA_NOT_CONFIGURED','MEDIA_UNAVAILABLE','ALLOWANCE_UNAVAILABLE','BUDGET_NOT_CONFIGURED','BUDGET_UNAVAILABLE'].includes(code))return new ApiProblem(503,'MEDIA_UNAVAILABLE','This media service or its verified allowance is not available.');
  return new ApiProblem(503,'MEDIA_PROVIDER_FAILED','The media service could not complete this request. Please try again.');
}
function elapsed(value:number){return Number.isFinite(value)&&value>=0?Math.round(value):0;}
function textResult(value:unknown,maximum:number){if(typeof value!=='string'||!value.trim()||value.length>maximum)fail(503,'MEDIA_PROVIDER_FAILED','The media service returned an invalid response.');return value.trim();}

/** This registry deliberately holds no images, recordings, transcripts or provider results. */
export function registerMedia(app:FastifyInstance,options:{store:Store;auth:AuthApi;adapter?:MediaAdapter;now?:()=>number}):MediaController{
  const {store,auth,adapter}=options;const now=options.now??Date.now;
  const sessions=new Map<string,DeviceSession>();
  const capabilities=():MediaCapabilities=>({...adapter?.capabilities()??{canTranscribe:false,canObserve:false,canSpeak:false},limits:MEDIA_LIMITS});
  function stop(session:DeviceSession,reason=new ApiProblem(410,'MEDIA_SESSION_STOPPED','This device session has stopped.')){
    if(sessions.get(session.id)!==session)return;
    sessions.delete(session.id);clearTimeout(session.expiryTimer);session.controller?.abort(reason);delete session.controller;
  }
  function sweep(){for(const session of sessions.values())if(session.expiresAt<=now())stop(session,new ApiProblem(410,'MEDIA_SESSION_EXPIRED','This device session has expired. Start it again to continue.'));}
  async function owner(request:FastifyRequest,slug:string,write=false){
    const session=await auth.getSession(request);if(!session.user||!session.csrfToken)fail(401,'LOGIN_REQUIRED','Please sign in to use this device session.');
    if(write)await auth.verifyCsrf(request);
    const state=await store.getSpace(slug);if(!state)fail(404,'SPACE_NOT_FOUND','This space does not exist.');requireOwner(state,session.user);
    return {authBinding:binding(session.user.id,session.csrfToken),spaceId:state.space.id};
  }
  async function device(request:FastifyRequest<{Params:Params}>,write=true){
    const identity=await owner(request,request.params.slug,write);const session=sessions.get(request.params.sessionId);
    if(!session||session.authBinding!==identity.authBinding||session.spaceId!==identity.spaceId)fail(404,'MEDIA_SESSION_NOT_FOUND','This device session is not available in this browser.');
    if(session.expiresAt<=now()){stop(session);fail(410,'MEDIA_SESSION_EXPIRED','This device session has expired. Start it again to continue.');}
    return session;
  }
  async function assertLive(request:FastifyRequest<{Params:Params}>,session:DeviceSession,controller:AbortController){
    if(controller.signal.aborted)throw controller.signal.reason;
    const checked=await device(request,false);if(checked!==session||session.controller!==controller)fail(409,'MEDIA_RESPONSE_STALE','This response belongs to an older device request.');
    if(controller.signal.aborted)throw controller.signal.reason;
  }
  async function run<T>(request:FastifyRequest<{Params:Params}>,reply:FastifyReply,session:DeviceSession,sequence:number,work:(signal:AbortSignal)=>Promise<T>){
    if(sequence<=session.sequence)fail(409,'MEDIA_SEQUENCE_STALE','This device request has already been replaced or processed.');
    if(session.controller)fail(429,'MEDIA_BUSY','Wait for the current device request to finish.');
    const controller=new AbortController();session.controller=controller;session.sequence=sequence;
    const cancel=()=>controller.abort(new ApiProblem(410,'MEDIA_REQUEST_CANCELLED','This device request was cancelled.'));
    const disconnect=()=>{if(!reply.raw.writableEnded)cancel();};
    request.raw.once('aborted',cancel);reply.raw.once('close',disconnect);
    const timeout=setTimeout(()=>controller.abort(new ApiProblem(503,'MEDIA_TIMEOUT','The media request timed out. Please try again.')),60_000);timeout.unref();
    let checking=false;
    const check=setInterval(()=>{if(checking||controller.signal.aborted)return;checking=true;void assertLive(request,session,controller).catch(error=>{stop(session,providerError(error));controller.abort(error);}).finally(()=>{checking=false;});},1000);check.unref();
    let abortListener:()=>void=()=>{};
    const aborted=new Promise<never>((_resolve,reject)=>{abortListener=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',abortListener,{once:true});});
    try{const result=await Promise.race([work(controller.signal),aborted]);await assertLive(request,session,controller);return result;}
    catch(error){if(controller.signal.aborted)throw providerError(controller.signal.reason);throw providerError(error);}
    finally{controller.signal.removeEventListener('abort',abortListener);clearTimeout(timeout);clearInterval(check);request.raw.removeListener('aborted',cancel);reply.raw.removeListener('close',disconnect);if(session.controller===controller)delete session.controller;}
  }
  app.get<{Params:{slug:string}}>('/api/spaces/:slug/media',async request=>{await owner(request,request.params.slug);return capabilities();});
  app.post<{Params:{slug:string}}>('/api/spaces/:slug/media/sessions',async(request,reply)=>{
    const identity=await owner(request,request.params.slug,true);const input=startSchema.parse(request.body);const available=capabilities();
    if(input.kind==='voice'?!available.canTranscribe:!available.canObserve)fail(503,'MEDIA_UNAVAILABLE','This media capability is not configured with a verified allowance.');
    sweep();
    // A browser may keep one voice and one scene session, in its current space only.
    for(const previous of sessions.values())if(previous.authBinding===identity.authBinding&&(previous.spaceId!==identity.spaceId||previous.kind===input.kind))stop(previous);
    if(sessions.size>=100)fail(503,'MEDIA_CAPACITY','Device sessions are busy. Please try again shortly.');
    const id=randomBytes(24).toString('base64url');const expiresAt=now()+MEDIA_LIMITS.maxSessionSeconds*1000;
    const session:DeviceSession={id,kind:input.kind,...identity,slug:request.params.slug,expiresAt,sequence:0,frames:0,lastFrameAt:-Infinity};
    session.expiryTimer=setTimeout(()=>stop(session,new ApiProblem(410,'MEDIA_SESSION_EXPIRED','This device session has expired.')),MEDIA_LIMITS.maxSessionSeconds*1000);session.expiryTimer.unref();sessions.set(id,session);
    return reply.code(201).send({id,kind:input.kind,expiresAt:new Date(expiresAt).toISOString(),limits:MEDIA_LIMITS} satisfies MediaSession);
  });
  app.delete<{Params:Params}>('/api/spaces/:slug/media/sessions/:sessionId',async(request,reply)=>{
    const identity=await owner(request,request.params.slug,true);const session=sessions.get(request.params.sessionId);
    if(session){if(session.authBinding!==identity.authBinding||session.spaceId!==identity.spaceId)fail(404,'MEDIA_SESSION_NOT_FOUND','This device session is not available in this browser.');stop(session);}
    return reply.code(204).send();
  });
  app.post<{Params:Params}>('/api/spaces/:slug/media/sessions/:sessionId/transcribe',{bodyLimit:Math.ceil(MEDIA_LIMITS.maxAudioBytes/3)*4+4096,config:{rateLimit:{max:6,timeWindow:'1 minute'}}},async(request,reply)=>{
    const session=await device(request);if(session.kind!=='voice')fail(422,'MEDIA_SESSION_KIND','Start a voice session before transcribing.');
    if(!adapter||!capabilities().canTranscribe)fail(503,'MEDIA_UNAVAILABLE','Voice transcription is unavailable.');const input=transcriptionSchema.parse(request.body);const audio=decodeBase64(input.audioBase64,MEDIA_LIMITS.maxAudioBytes);
    return run(request,reply,session,input.sequence,async signal=>{const result=await adapter.transcribe({audio,mimeType:input.mimeType,signal});return {sequence:input.sequence,text:textResult(result.text,4000),durationMs:elapsed(result.durationMs)} satisfies MediaTranscript;});
  });
  app.post<{Params:Params}>('/api/spaces/:slug/media/sessions/:sessionId/observe',{bodyLimit:Math.ceil(MEDIA_LIMITS.maxImageBytes/3)*4+4096,config:{rateLimit:{max:40,timeWindow:'1 minute'}}},async(request,reply)=>{
    const session=await device(request);if(session.kind!=='scene')fail(422,'MEDIA_SESSION_KIND','Start a scene session before observing.');
    if(!adapter||!capabilities().canObserve)fail(503,'MEDIA_UNAVAILABLE','Scene description is unavailable.');const input=observationSchema.parse(request.body);const image=decodeBase64(input.imageBase64,MEDIA_LIMITS.maxImageBytes);
    if(image.length<4||image[0]!==0xff||image[1]!==0xd8||image[2]!==0xff||image[image.length-2]!==0xff||image[image.length-1]!==0xd9)fail(422,'INVALID_MEDIA','Send a JPEG frame from the current camera.');
    const capturedAt=Date.parse(input.capturedAt);if(now()-capturedAt>30_000||capturedAt-now()>5000)fail(409,'MEDIA_FRAME_STALE','Capture a fresh camera frame before trying again.');
    if(input.sequence<=session.sequence)fail(409,'MEDIA_SEQUENCE_STALE','This device request has already been replaced or processed.');
    if(session.controller)fail(429,'MEDIA_BUSY','Wait for the current device request to finish.');
    if(session.frames>=MEDIA_LIMITS.maxFramesPerSession)fail(429,'MEDIA_FRAME_LIMIT','This scene session has used its frame allowance.');
    if(now()-session.lastFrameAt<MEDIA_LIMITS.minimumFrameIntervalMs)fail(429,'MEDIA_FRAME_RATE','Wait 15 seconds before sending another frame.');
    session.frames++;session.lastFrameAt=now();
    return run(request,reply,session,input.sequence,async signal=>{
      const description=await adapter.describe({image,mimeType:'image/jpeg',signal});await assertLive(request,session,session.controller!);
      const response:MediaObservation={sequence:input.sequence,capturedAt:input.capturedAt,text:textResult(description.text,1000),visionMs:elapsed(description.durationMs),speechMs:0};
      if(!input.includeSpeech)return response;
      if(!capabilities().canSpeak){response.speechError='Speech is unavailable. The description is still available as text.';return response;}
      try{const spoken=await adapter.speak({text:response.text,signal});if(spoken.mimeType!=='audio/mpeg'||spoken.audio.byteLength>2_000_000)fail(503,'MEDIA_PROVIDER_FAILED','Speech returned an invalid response.');response.audioBase64=Buffer.from(spoken.audio).toString('base64');response.audioMimeType='audio/mpeg';response.speechMs=elapsed(spoken.durationMs);}
      catch(error){if(signal.aborted)throw error;response.speechError=providerError(error).message;}
      return response;
    });
  });
  const controller:MediaController={revokeAuth(session){const key=binding(session.userId,session.csrfToken);for(const media of sessions.values())if(media.authBinding===key)stop(media,new ApiProblem(401,'LOGIN_REQUIRED','This sign-in session has ended.'));},close(){for(const session of sessions.values())stop(session);}};
  app.addHook('preClose',async()=>controller.close());return controller;
}
