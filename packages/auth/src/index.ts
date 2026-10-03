import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import cookie from '@fastify/cookie';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Session, User } from '@livingforma/contracts';
import * as oidc from 'openid-client';
import type { AuthApi, AuthOptions, VerifiedIdentity } from './types.js';

export type * from './types.js';
const token = () => randomBytes(32).toString('base64url');
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
const equal = (a: string, b: string) => timingSafeEqual(Buffer.from(hashToken(a)), Buffer.from(hashToken(b)));
const loopback = (host: string) => ['localhost', '127.0.0.1', '::1', '[::1]', '::ffff:127.0.0.1'].includes(host);
function fail(statusCode: number, code: string, message: string): never {
  throw Object.assign(new Error(message), {statusCode, code});
};

/** Only in-app navigation targets. Reject auth/API loops, scheme-relative and escaped URLs. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value.length > 512 || /[\\\u0000-\u0020%]/.test(value)) return '/';
  return value === '/' || /^\/s\/[a-z0-9][a-z0-9-]{0,79}(?:[?#].*)?$/.test(value) ? value : '/';
}

export async function googleConfiguration(clientId: string, clientSecret: string): Promise<oidc.Configuration> {
  return oidc.discovery(new URL('https://accounts.google.com'), clientId, clientSecret, undefined, {
    execute: [oidc.enableNonRepudiationChecks], // Explicit JWS verification in addition to TLS.
    timeout: 10,
  });
}

export async function registerAuth(app: FastifyInstance, options: AuthOptions): Promise<AuthApi> {
  const base = new URL(options.origin);
  if (base.origin !== options.origin || base.username || base.password) throw new Error('APP_ORIGIN must be an exact origin');
  const production = process.env.NODE_ENV === 'production';
  if (production && base.protocol !== 'https:') throw new Error('Production requires HTTPS APP_ORIGIN');
  const secure = base.protocol === 'https:';
  const sessionCookie = secure ? '__Host-lf-session' : 'lf-session';
  const oauthCookie = secure ? '__Host-lf-oauth' : 'lf-oauth';
  const cookieOptions = {httpOnly: true, secure, sameSite: 'lax' as const, path: '/'};
  const googleConfigured = Boolean(options.googleClientId && options.googleClientSecret);
  const demoConfigured = !production && options.localDemo === true && process.env.ENABLE_LOCAL_DEMO === 'true' && loopback(base.hostname);
  const ttl = Math.min(Math.max(options.sessionTtlSeconds ?? 60 * 60 * 24 * 7, 60), 60 * 60 * 24 * 30);
  const localAvailable = (request: FastifyRequest) => demoConfigured && loopback(request.raw.socket.remoteAddress ?? '');
  const requireOrigin = (request: FastifyRequest) => {
    if (request.headers.origin !== base.origin) fail(403, 'CSRF_ORIGIN', 'This request origin is not allowed.');
  };
  let provider: Promise<oidc.Configuration> | undefined;
  const getProvider = () => {
    if (!googleConfigured) fail(503, 'GOOGLE_NOT_CONFIGURED', 'Google sign-in is not configured.');
    provider ??= googleConfiguration(options.googleClientId!, options.googleClientSecret!).catch(error => { provider = undefined; throw error; });
    return provider;
  };
  await app.register(cookie);
  const getSession = async (request: FastifyRequest): Promise<Session> => {
    const anonymous: Session = {user: null, csrfToken: null, auth: {googleConfigured, localDemoAvailable: localAvailable(request)}, mode: production ? 'production' : 'local'};
    const raw = request.cookies[sessionCookie];
    if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return anonymous;
    const stored = await options.store.getSession(hashToken(raw));
    if (!stored) return anonymous;
    if (Date.parse(stored.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(stored.expiresAt))) {
      await options.store.deleteSession(hashToken(raw));
      return anonymous;
    }
    return {...anonymous, user: stored.user, csrfToken: stored.csrfToken};
  };
  const requireUser = async (request: FastifyRequest): Promise<User> => {
    const session = await getSession(request);
    return session.user ?? fail(401, 'LOGIN_REQUIRED', 'Please sign in with Google to continue.');
  };
  const verifyCsrf = async (request: FastifyRequest): Promise<void> => {
    requireOrigin(request);
    const session = await getSession(request);
    if (!session.user) fail(401, 'LOGIN_REQUIRED', 'Please sign in with Google to continue.');
    const supplied = request.headers['x-csrf-token'];
    if (!session.csrfToken || typeof supplied !== 'string' || !equal(supplied, session.csrfToken)) fail(403, 'CSRF_TOKEN', 'Session verification failed. Refresh and try again.');
  };
  const issueSession = async (request: FastifyRequest, reply: FastifyReply, identity: VerifiedIdentity) => {
    const user = await options.store.resolveIdentity(identity);
    const raw = token();
    const csrfToken = token();
    await options.store.createSession({tokenHash: hashToken(raw), userId: user.id, csrfToken, expiresAt: new Date(Date.now() + ttl * 1000).toISOString()});
    const previous = request.cookies[sessionCookie];
    if (previous) await options.store.deleteSession(hashToken(previous));
    reply.setCookie(sessionCookie, raw, {...cookieOptions, maxAge: ttl});
    return {user, csrfToken, auth: {googleConfigured, localDemoAvailable: localAvailable(request)}, mode: production ? 'production' : 'local'} satisfies Session;
  };
  app.get('/api/session', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return getSession(request);
  });
  app.get('/auth/google', {logLevel: 'silent'}, async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer');
    const config = await getProvider();
    const state = oidc.randomState();
    const verifier = oidc.randomPKCECodeVerifier();
    const nonce = oidc.randomNonce();
    const returnTo = safeReturnTo((request.query as {returnTo?: string}).returnTo);
    await options.store.saveOAuthTransaction({stateHash: hashToken(state), verifier, nonce, returnTo, expiresAt: new Date(Date.now() + 600_000).toISOString()});
    reply.setCookie(oauthCookie, state, {...cookieOptions, maxAge: 600});
    return reply.redirect(oidc.buildAuthorizationUrl(config, {
      redirect_uri: `${base.origin}/auth/google/callback`, scope: 'openid email profile',
      state, nonce, code_challenge_method: 'S256', code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    }).href);
  });
  app.get('/auth/google/callback', {logLevel: 'silent'}, async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer');
    const savedState = request.cookies[oauthCookie];
    reply.clearCookie(oauthCookie, cookieOptions);
    const currentUrl = new URL(request.raw.url ?? '', base.origin);
    const state = currentUrl.searchParams.get('state');
    if (!savedState || !state || !equal(savedState, state)) fail(400, 'OAUTH_STATE', 'This sign-in request is no longer valid. Please try again.');
    const transaction = await options.store.consumeOAuthTransaction(hashToken(state));
    if (!transaction || Date.parse(transaction.expiresAt) <= Date.now()) fail(400, 'OAUTH_EXPIRED', 'This sign-in request expired. Please try again.');
    if (currentUrl.searchParams.has('error')) return reply.redirect(`${transaction.returnTo}${transaction.returnTo.includes('?') ? '&' : '?'}authError=cancelled`);
    try {
      const config = await getProvider();
      const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {pkceCodeVerifier: transaction.verifier, expectedState: state, expectedNonce: transaction.nonce, idTokenExpected: true});
      const claims = tokens.claims();
      if (!claims?.sub) throw new Error('No subject');
      await issueSession(request, reply, {provider: 'google', subject: claims.sub,
        name: typeof claims.name === 'string' ? claims.name.slice(0, 120) : 'Google user',
        ...(claims.email_verified === true && typeof claims.email === 'string' ? {email: claims.email} : {}),
        ...(typeof claims.picture === 'string' && claims.picture.startsWith('https://') ? {avatarUrl: claims.picture} : {}),
      });
      return reply.redirect(transaction.returnTo);
    } catch {
      // No provider exception, authorization code, token or personal profile in logs/responses.
      fail(400, 'OAUTH_FAILED', 'Google sign-in could not be verified. Please try again.');
    }
  });
  app.post('/auth/logout', async (request, reply) => {
    await verifyCsrf(request);
    const raw = request.cookies[sessionCookie];
    if (raw) await options.store.deleteSession(hashToken(raw));
    reply.clearCookie(sessionCookie, cookieOptions).header('Cache-Control', 'no-store');
    return {ok: true};
  });
  // The route does not exist in production, even when the environment flag is present.
  if (demoConfigured) app.post('/auth/local', async (request, reply) => {
    if (!localAvailable(request)) fail(404, 'NOT_FOUND', 'Route not found.');
    requireOrigin(request);
    const persona = (request.body as {persona?: unknown} | null)?.persona;
    if (persona !== 'owner' && persona !== 'participant') fail(400, 'INVALID_PERSONA', 'Choose a valid local demo identity.');
    reply.header('Cache-Control', 'no-store');
    return issueSession(request, reply, {provider: 'local', subject: persona, name: persona === 'owner' ? 'Local Owner' : 'Local Participant'});
  });
  return {getSession, requireUser, verifyCsrf};
}
