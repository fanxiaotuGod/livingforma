import type {Session} from '@livingforma/contracts';
import {stopLocalDevices} from './media-events';

export class RequestError extends Error {
  constructor(public status:number,public code:string,message:string){super(message)}
}
export class StaleRequestError extends RequestError {
  constructor(message='Your session or space changed. Your draft is safe; review it before trying again.') { super(409,'STALE_REQUEST',message); }
}
type IdentityState={session:Session|null;revision:number;reason:string;change:'initial'|'identity'|'token'|'invalidated'};
let state:IdentityState={session:null,revision:0,reason:'',change:'initial'};
let pageRevision=0,readSequence=0,acceptedRead=0,intentRevision=0;
const listeners=new Set<()=>void>();
const activeWrites=new Set<AbortController>();
export const getIdentity=()=>state;
export const subscribeIdentity=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
export const getPageRevision=()=>pageRevision;
export function changePage(){pageRevision++;stopLocalDevices('Space changed.');for(const controller of activeWrites)controller.abort();}
function publish(session:Session|null,reason:string,force=false){
  const changed=state.session?.user?.id!==session?.user?.id||state.session?.csrfToken!==session?.csrfToken;
  if(!changed&&!force&&state.session!==null)return;
  const change:IdentityState['change']=state.session===null?'initial':state.session.user?.id!==session?.user?.id?'identity':force?'invalidated':'token';
  if(change==='identity'||force)intentRevision++;
  if(force)acceptedRead=++readSequence;
  state={session,revision:state.revision+1,reason,change};
  for(const controller of activeWrites)controller.abort();
  stopLocalDevices(reason||'Your sign-in session changed. Please start media again.');
  for(const listener of listeners)listener();
}
export function invalidateIdentity(reason:string){publish(state.session,reason,true)}

/** Deliberate escape hatch for auth entry and best-effort old media-session cleanup. */
export async function rawRequest<T>(path:string,options:RequestInit={},csrf?:string|null):Promise<T>{
  const headers=new Headers(options.headers);
  if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  if(csrf)headers.set('X-CSRF-Token',csrf);
  const response=await fetch(path,{...options,credentials:'same-origin',headers});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new RequestError(response.status,body.error?.code||'REQUEST_FAILED',body.error?.message||'We could not connect. Please try again.');
  return body;
}
export async function refreshSession(signal?:AbortSignal):Promise<Session>{
  const sequence=++readSequence;
  const session=await rawRequest<Session>('/api/session',{cache:'no-store',signal});
  // The accepted session is newer evidence. Reuse it for concurrent preflights,
  // never restore the older response or unnecessarily reject another same-user write.
  if(sequence<acceptedRead){if(state.session)return state.session;throw new StaleRequestError()}
  acceptedRead=sequence;
  const before=state.session;
  const changedUser=before!==null&&before.user?.id!==session.user?.id;
  publish(session,changedUser?'Your sign-in changed. Your previous account’s drafts are saved.':before?'Your session was refreshed. Your drafts are safe.':'');
  return session;
}
export function assertCurrent(userId:string|null,scope:number,revision?:number){
  if((state.session?.user?.id??null)!==userId||scope!==pageRevision||(revision!==undefined&&revision!==state.revision))throw new StaleRequestError();
}
/** Reads are scoped too: an old private snapshot must never reappear after a transition. */
export async function request<T>(path:string,options:RequestInit={}):Promise<T>{
  if(options.method&&!['GET','HEAD'].includes(options.method.toUpperCase()))throw new Error('Writes must use protectedRequest.');
  const revision=state.revision,scope=pageRevision;
  let value:T;
  try{value=await rawRequest<T>(path,options)}catch(error){
    if(revision!==state.revision||scope!==pageRevision)throw new StaleRequestError();
    if(revision===state.revision&&error instanceof RequestError&&(error.status===401||error.status===403)){
      void refreshSession().catch(()=>{});
    }
    throw error;
  }
  if(revision!==state.revision||scope!==pageRevision)throw new StaleRequestError();
  return value;
}
/** One explicit user intent, at most one write. Never retry a rejected write. */
export async function protectedRequest<T>(path:string,options:RequestInit,expectedUserId:string|null):Promise<T>{
  const scope=pageRevision,intent=intentRevision;
  if(!expectedUserId)throw new RequestError(401,'LOGIN_REQUIRED','Please sign in before continuing. Your draft is safe.');
  const identity=await refreshSession(options.signal??undefined);
  if(intent!==intentRevision)throw new StaleRequestError();
  if(identity.user?.id!==expectedUserId||!identity.csrfToken)throw new StaleRequestError('Your sign-in changed. No changes were sent. Sign in to the original account to recover its draft.');
  assertCurrent(expectedUserId,scope);
  options.signal?.throwIfAborted();
  const revision=state.revision,controller=new AbortController();
  const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal;
  activeWrites.add(controller);
  try{
    const value=await rawRequest<T>(path,{...options,signal},identity.csrfToken);
    assertCurrent(expectedUserId,scope,revision);
    return value;
  }catch(error){
    if(revision!==state.revision||scope!==pageRevision)throw new StaleRequestError();
    if(error instanceof RequestError&&(error.status===401||error.status===403)){
      activeWrites.delete(controller);
      invalidateIdentity('Your session needs to be checked. Your draft is safe; please try again after it refreshes.');
      await refreshSession().catch(()=>{});
    }
    throw error;
  }finally{activeWrites.delete(controller)}
}

/** Login changes identity by design; it is never used for a business write. */
export async function localSignIn(){
  const expected=state.session?.user?.id??null,scope=pageRevision;
  await refreshSession();
  assertCurrent(expected,scope);
  invalidateIdentity('Signing in…');
  const revision=state.revision;
  const session=await rawRequest<Session>('/auth/local',{method:'POST',body:JSON.stringify({persona:'owner'})});
  assertCurrent(expected,scope,revision);
  publish(session,'Signed in.',true);
  return session;
}
export function signedOut(){publish(state.session?{...state.session,user:null,csrfToken:null}:null,'Signed out.',true)}
