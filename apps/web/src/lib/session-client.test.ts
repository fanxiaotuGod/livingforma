import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Session} from '@livingforma/contracts';
const identity=(id:string|null,csrf='token-1'):Session=>({user:id?{id,name:id}:null,csrfToken:id?csrf:null,auth:{googleConfigured:false,localDemoAvailable:true},mode:'local'});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
let client:typeof import('./session-client');
beforeEach(async()=>{vi.resetModules();client=await import('./session-client')});
afterEach(()=>{vi.unstubAllGlobals()});
async function seed(){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(identity('owner'))));await client.refreshSession()}

describe('protected session requests',()=>{
  it('preflights all user writes and sends exactly once with the fresh same-account token',async()=>{
    await seed();const fetcher=vi.fn().mockImplementation((path:string,options:RequestInit)=>path==='/api/session'?Promise.resolve(response(identity('owner','rotated'))):Promise.resolve(response({ok:true})));vi.stubGlobal('fetch',fetcher);
    for(const path of ['/api/spaces','/api/spaces/reading/actions','/api/spaces/reading/proposals','/api/spaces/reading/tools','/api/spaces/reading/tools/search/invoke','/api/spaces/reading/media/sessions','/api/spaces/reading/media/sessions/id/observe','/auth/logout']){
      await expect(client.protectedRequest(path,{method:'POST',body:'{}'},'owner')).resolves.toEqual({ok:true});
    }
    expect(fetcher.mock.calls.filter(([path])=>path==='/api/session')).toHaveLength(8);
    const writes=fetcher.mock.calls.filter(([path])=>path!=='/api/session');expect(writes).toHaveLength(8);
    for(const [,options]of writes)expect(new Headers(options.headers).get('X-CSRF-Token')).toBe('rotated');
  });
  it.each(['participant',null])('sends zero writes when the session became %s',async id=>{
    await seed();const fetcher=vi.fn().mockResolvedValue(response(identity(id)));vi.stubGlobal('fetch',fetcher);
    await expect(client.protectedRequest('/api/spaces',{method:'POST'},'owner')).rejects.toMatchObject({code:'STALE_REQUEST'});
    expect(fetcher).toHaveBeenCalledTimes(1);expect(client.getIdentity().session?.user?.id??null).toBe(id);
  });
  it('does not replay an actual write rejected for stale CSRF',async()=>{
    await seed();const fetcher=vi.fn().mockImplementation((path:string)=>Promise.resolve(path==='/api/session'?response(identity('owner','fresh')):response({error:{code:'CSRF_TOKEN',message:'Rejected'}},403)));vi.stubGlobal('fetch',fetcher);
    await expect(client.protectedRequest('/api/spaces',{method:'POST'},'owner')).rejects.toMatchObject({code:'CSRF_TOKEN'});
    expect(fetcher.mock.calls.filter(([path])=>path!=='/api/session')).toHaveLength(1);
  });
  it('rejects a late successful write after a different account is observed',async()=>{
    await seed();let finish!:(value:Response)=>void;let session=identity('owner');const fetcher=vi.fn().mockImplementation((path:string)=>path==='/api/session'?Promise.resolve(response(session)):new Promise<Response>(resolve=>{finish=resolve}));vi.stubGlobal('fetch',fetcher);
    const pending=client.protectedRequest('/api/spaces',{method:'POST'},'owner');await vi.waitFor(()=>expect(finish).toBeDefined());session=identity('participant');await client.refreshSession();finish(response({secret:'must not reach UI'}));
    await expect(pending).rejects.toMatchObject({code:'STALE_REQUEST'});
  });
  it('rejects a late successful write after navigating away and back',async()=>{
    await seed();let finish!:(value:Response)=>void;vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string)=>path==='/api/session'?Promise.resolve(response(identity('owner'))):new Promise<Response>(resolve=>{finish=resolve})));
    const pending=client.protectedRequest('/api/spaces',{method:'POST'},'owner');await vi.waitFor(()=>expect(finish).toBeDefined());client.changePage();client.changePage();finish(response({ok:true}));await expect(pending).rejects.toMatchObject({code:'STALE_REQUEST'});
  });
  it('does not resurrect a private read after identity changes',async()=>{
    await seed();let finish!:(value:Response)=>void;vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string)=>path==='/api/session'?Promise.resolve(response(identity(null))):new Promise<Response>(resolve=>{finish=resolve})));
    const pending=client.request('/api/spaces/private/snapshot');await client.refreshSession();finish(response({private:'old owner'}));await expect(pending).rejects.toMatchObject({code:'STALE_REQUEST'});
  });
  it('does not allow an old session read to overwrite a more recent one',async()=>{
    await seed();let finish!:(value:Response)=>void;const fetcher=vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve})).mockResolvedValue(response(identity('participant')));vi.stubGlobal('fetch',fetcher);
    const old=client.refreshSession();await client.refreshSession();finish(response(identity('owner')));expect((await old).user?.id).toBe('participant');expect(client.getIdentity().session?.user?.id).toBe('participant');
  });
  it('allows two same-account writes when their preflight reads finish out of order',async()=>{
    await seed();let finish!:(value:Response)=>void;let reads=0;
    const fetcher=vi.fn().mockImplementation((path:string)=>path==='/api/session'?(++reads===1?new Promise<Response>(resolve=>{finish=resolve}):Promise.resolve(response(identity('owner','fresh')))):Promise.resolve(response({ok:true})));
    vi.stubGlobal('fetch',fetcher);
    const first=client.protectedRequest('/api/spaces/reading/actions',{method:'POST'},'owner');
    const second=client.protectedRequest('/api/spaces/reading/tools/search/invoke',{method:'POST'},'owner');
    await expect(second).resolves.toEqual({ok:true});finish(response(identity('owner','token-1')));await expect(first).resolves.toEqual({ok:true});
    const writes=fetcher.mock.calls.filter(([path])=>path!=='/api/session');expect(writes).toHaveLength(2);
    for(const [,options] of writes)expect(new Headers(options.headers).get('X-CSRF-Token')).toBe('fresh');
  });
  it('keeps successful logout distinct from later local invalidation',async()=>{
    await seed();vi.stubGlobal('fetch',vi.fn().mockImplementation((path:string)=>Promise.resolve(path==='/api/session'?response(identity('owner')):response({ok:true}))));
    const result=await client.protectedRequest('/auth/logout',{method:'POST'},'owner');client.signedOut();expect(result).toEqual({ok:true});expect(client.getIdentity().session?.user).toBeNull();
  });
  it('sends no write if explicit invalidation happened while its preflight was pending',async()=>{
    await seed();let finish!:(value:Response)=>void;const fetcher=vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve}));vi.stubGlobal('fetch',fetcher);
    const pending=client.protectedRequest('/api/spaces',{method:'POST'},'owner');client.invalidateIdentity('Signing out…');finish(response(identity('owner')));
    await expect(pending).rejects.toMatchObject({code:'STALE_REQUEST'});expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('never lets a pre-logout session read resurrect the signed-out account',async()=>{
    await seed();let finish!:(value:Response)=>void;vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve})));
    const pending=client.refreshSession();client.signedOut();finish(response(identity('owner')));expect((await pending).user).toBeNull();expect(client.getIdentity().session?.user).toBeNull();
  });
});
