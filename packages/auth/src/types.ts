import type { Session, User } from '@livingforma/contracts';
import type { FastifyRequest } from 'fastify';

/** Subject has been verified by OIDC; email is never the identity key. */
export type VerifiedIdentity = {
  provider: 'google' | 'local';
  subject: string;
  name: string;
  email?: string;
  avatarUrl?: string;
};

export type StoredSession = {
  tokenHash: string;
  userId: string;
  csrfToken: string;
  expiresAt: string;
};

export type OAuthTransaction = {
  stateHash: string;
  verifier: string;
  nonce: string;
  returnTo: string;
  expiresAt: string;
};

/** Persistent adapter. consumeOAuthTransaction must atomically delete and return. */
export interface AuthStore {
  resolveIdentity(identity: VerifiedIdentity): Promise<User>;
  createSession(session: StoredSession): Promise<void>;
  getSession(tokenHash: string): Promise<(StoredSession & { user: User }) | null>;
  deleteSession(tokenHash: string): Promise<void>;
  saveOAuthTransaction(transaction: OAuthTransaction): Promise<void>;
  consumeOAuthTransaction(stateHash: string): Promise<OAuthTransaction | null>;
}

export type AuthOptions = {
  store: AuthStore;
  /** Exact browser origin; localhost:5173 during proxied development. */
  origin: string;
  googleClientId?: string;
  googleClientSecret?: string;
  /** Also requires ENABLE_LOCAL_DEMO=true, nonproduction and loopback origin/IP. */
  localDemo?: boolean;
  sessionTtlSeconds?: number;
};

export type AuthApi = {
  getSession(request: FastifyRequest): Promise<Session>;
  requireUser(request: FastifyRequest): Promise<User>;
  verifyCsrf(request: FastifyRequest): Promise<void>;
};
