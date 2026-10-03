import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Fastify, {type FastifyInstance} from 'fastify';
import {exportJWK, generateKeyPair, SignJWT} from 'jose';
import {hashToken, registerAuth, safeReturnTo} from './index.js';
import type {AuthStore, OAuthTransaction, StoredSession} from './types.js';
import type {User} from '@livingforma/contracts';

function memoryStore() {
  const sessions = new Map<string, StoredSession>();
  const transactions = new Map<string, OAuthTransaction>();
  const users = new Map<string, User>();
  const store: AuthStore = {
    async resolveIdentity(identity) {const id=`user-${identity.provider}-${identity.subject}`; const user={id,name:identity.name};users.set(id,user); return user;},
    async createSession(session) {sessions.set(session.tokenHash, session);},
    async getSession(key) {const session=sessions.get(key);return session ? {...session,user:users.get(session.userId)!}:null;},
    async deleteSession(key) {sessions.delete(key);},
    async saveOAuthTransaction(t) {transactions.set(t.stateHash,t);},
    async consumeOAuthTransaction(key) {const value=transactions.get(key);transactions.delete(key);return value??null;},
  };
  return {store,sessions,transactions};
}
const apps:FastifyInstance[]=[];
const origin='http://localhost:5173';
async function setup(production=false, google=false) {
  vi.stubEnv('NODE_ENV',production?'production':'test');vi.stubEnv('ENABLE_LOCAL_DEMO','true');
  const db=memoryStore(), app=Fastify({logger:false});apps.push(app);
  const auth=await registerAuth(app,{store:db.store,origin:production?'https://livingforma.tech':origin,localDemo:true,...(google?{googleClientId:'test-client',googleClientSecret:'test-secret'}:{})});
  app.post('/write',async request=>{await auth.verifyCsrf(request);return {user:await auth.requireUser(request)};});
  await app.ready();return {app,...db};
}
const cookieOf=(response:{headers:Record<string,unknown>})=>(response.headers['set-cookie'] as string).split(';')[0];
beforeEach(()=>vi.stubEnv('ENABLE_LOCAL_DEMO','true'));
afterEach(async()=>{await Promise.all(apps.splice(0).map(app=>app.close()));vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe('server sessions and request boundaries',()=>{
  it('preserves anonymous access and explicitly reports local demo mode',async()=>{
    const {app}=await setup();const response=await app.inject('/api/session');
    expect(response.json()).toMatchObject({user:null,csrfToken:null,mode:'local',auth:{googleConfigured:false,localDemoAvailable:true}});
    expect(response.headers['cache-control']).toBe('no-store');
    expect((await app.inject({method:'POST',url:'/write',headers:{origin}})).statusCode).toBe(401);
  });
  it('stores only token hashes, requires origin and CSRF, and revokes logout',async()=>{
    const {app,sessions}=await setup();
    const login=await app.inject({method:'POST',url:'/auth/local',headers:{origin},payload:{persona:'owner'}});
    expect(login.statusCode).toBe(200);const cookie=cookieOf(login), token=login.json().csrfToken;
    expect(login.headers['set-cookie']).toContain('HttpOnly');expect(login.headers['set-cookie']).toContain('SameSite=Lax');
    expect(sessions.has(hashToken(cookie.split('=')[1]))).toBe(true);expect(sessions.has(cookie.split('=')[1])).toBe(false);
    expect((await app.inject({method:'POST',url:'/write',headers:{origin,cookie,'x-csrf-token':token}})).statusCode).toBe(200);
    expect((await app.inject({method:'POST',url:'/write',headers:{origin:'https://attacker.invalid',cookie,'x-csrf-token':token}})).statusCode).toBe(403);
    expect((await app.inject({method:'POST',url:'/write',headers:{origin,cookie}})).statusCode).toBe(403);
    expect((await app.inject({method:'POST',url:'/auth/logout',headers:{origin,cookie,'x-csrf-token':token}})).statusCode).toBe(200);
    expect((await app.inject({url:'/api/session',headers:{cookie}})).json().user).toBeNull();expect(sessions.size).toBe(0);
  });
  it('rotates sessions on subsequent sign-in and rejects expired sessions',async()=>{
    const {app,sessions}=await setup();const a=await app.inject({method:'POST',url:'/auth/local',headers:{origin},payload:{persona:'owner'}}),oldCookie=cookieOf(a);
    const b=await app.inject({method:'POST',url:'/auth/local',headers:{origin,cookie:oldCookie},payload:{persona:'participant'}});
    expect((await app.inject({url:'/api/session',headers:{cookie:oldCookie}})).json().user).toBeNull();
    expect(b.json().user.id).toBe('user-local-participant');
    for(const value of sessions.values())value.expiresAt=new Date(0).toISOString();
    expect((await app.inject({url:'/api/session',headers:{cookie:cookieOf(b)}})).json().user).toBeNull();
  });
  it('does not expose local sign-in in production or to nonloopback clients',async()=>{
    const {app}=await setup(true);expect((await app.inject({method:'POST',url:'/auth/local',payload:{persona:'owner'}})).statusCode).toBe(404);
    expect((await app.inject('/api/session')).json().auth.localDemoAvailable).toBe(false);
    const local=await setup();expect((await local.app.inject({method:'POST',url:'/auth/local',remoteAddress:'192.0.2.1',headers:{origin},payload:{persona:'owner'}})).statusCode).toBe(404);
  });
  it('rejects callback state before making provider calls',async()=>{
    const {app}=await setup();expect((await app.inject('/auth/google/callback?state=wrong&code=fake')).statusCode).toBe(400);
    expect((await app.inject('/auth/google')).statusCode).toBe(503);
  });
  it.each(['https://attacker.invalid','//attacker.invalid','/\\attacker.invalid','/auth/google','/api/session','/%2f%2fattacker.invalid'])('rejects unsafe return target %s',value=>expect(safeReturnTo(value)).toBe('/'));
});

describe('OIDC cryptographic validation with a local provider fixture',()=>{
  async function providerFixture(mutation?:'signature'|'nonce'|'audience'|'issuer'|'expired') {
    const signing=await generateKeyPair('RS256'); const unrelated=await generateKeyPair('RS256'); const jwk=await exportJWK(signing.publicKey); jwk.kid='fixture';
    let expectedNonce='';
    vi.stubGlobal('fetch',vi.fn(async(input:URL|string|Request)=>{
      const url=String(input instanceof Request?input.url:input);
      if(url.includes('.well-known'))return Response.json({issuer:'https://accounts.google.com',authorization_endpoint:'https://accounts.google.com/auth',token_endpoint:'https://oauth2.googleapis.com/token',jwks_uri:'https://www.googleapis.com/jwks',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_post']});
      if(url.endsWith('/jwks'))return Response.json({keys:[jwk]});
      if(url.endsWith('/token')){
        const jwt=await new SignJWT({nonce:mutation==='nonce'?'wrong':expectedNonce,name:'Test User',email:'test@example.invalid',email_verified:true}).setProtectedHeader({alg:'RS256',kid:'fixture'}).setIssuer(mutation==='issuer'?'https://attacker.invalid':'https://accounts.google.com').setAudience(mutation==='audience'?'other-client':'test-client').setSubject('google-stable-sub').setIssuedAt().setExpirationTime(mutation==='expired'?Math.floor(Date.now()/1000)-100:'5m').sign(mutation==='signature'?unrelated.privateKey:signing.privateKey);
        return Response.json({access_token:'fixture-access-token',token_type:'Bearer',id_token:jwt,expires_in:300});
      }
      throw new Error('Unexpected fixture URL');
    }));
    const {app,transactions}=await setup(false,true);
    const start=await app.inject('/auth/google?returnTo=/s/reading');expect(start.statusCode).toBe(302);
    const redirect=new URL(start.headers.location!);expectedNonce=redirect.searchParams.get('nonce')!;
    expect(redirect.searchParams.get('code_challenge_method')).toBe('S256');expect(transactions.size).toBe(1);
    const state=redirect.searchParams.get('state')!, cookie=cookieOf(start);
    const callback=()=>app.inject({url:`/auth/google/callback?code=fixture-code&state=${state}`,headers:{cookie}});
    return {app,callback,transactions};
  }
  it('validates a signed token, maps its subject, and consumes state exactly once',async()=>{
    const {app,callback,transactions}=await providerFixture();const response=await callback();expect(response.statusCode).toBe(302);expect(response.headers.location).toBe('/s/reading');expect(transactions.size).toBe(0);
    const cookies=response.headers['set-cookie'] as unknown as string[];const cookie=cookies.find(c=>c.startsWith('lf-session='))!.split(';')[0];
    expect((await app.inject({url:'/api/session',headers:{cookie}})).json().user.id).toBe('user-google-google-stable-sub');
    expect((await callback()).statusCode).toBe(400);
  });
  it.each(['signature','nonce','audience','issuer','expired'] as const)('rejects an invalid %s without exposing provider detail',async issue=>{
    const {callback}=await providerFixture(issue);const response=await callback();expect(response.statusCode).toBe(400);expect(response.body).not.toContain('fixture-code');expect(response.body).not.toContain('fixture-access-token');expect(response.json().code).toBe('OAUTH_FAILED');
  });
});
