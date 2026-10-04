# Google sign-in

Updated 2026-10-03, America/Vancouver. DevOps owns `packages/auth`; Backend owns the persistent adapter and per-space authorization. Google sign-in has completed a real local browser roundtrip. Production sign-in is pending deployment and must be tested separately.

## Implemented contract

`registerAuth(app, {store, origin, googleClientId, googleClientSecret, localDemo})` returns async `getSession`, `requireUser`, and `verifyCsrf`. `AuthStore` in `packages/auth/src/types.ts` maps verified `(provider, subject)` identities, persists hashed opaque sessions, and atomically consumes one-time OAuth transactions. Email never determines identity or ownership.

| Route | Behavior |
| --- | --- |
| GET `/api/session` | Anonymous or signed-in Session; no-store |
| GET `/auth/google?returnTo=/s/slug` | Google authorization code flow; only safe in-app return paths |
| GET `/auth/google/callback` | One-time state, PKCE, nonce, and signed ID token verification |
| POST `/auth/logout` | Origin + CSRF checks, session deletion, cookie clearing |
| POST `/auth/local` | Explicit test identity only; route absent in production |

Registered callback URIs:

- `http://localhost:5173/auth/google/callback`
- `https://livingforma.tech/auth/google/callback`

The Google Web application client exists. Its secret is stored only in ignored `.env` (mode 0600) and must be entered as a deployment secret. No Google token is persisted. Application credentials never use `VITE_*`.

`openid-client@6.8.8` discovers Google metadata and uses `enableNonRepudiationChecks` explicitly to verify JWT signatures, alongside issuer, audience, expiry, state and nonce. Scopes are `openid email profile`; no offline token or additional Google API permissions. Both OAuth routes suppress request logging, and provider exceptions are replaced by safe English errors. Backend also avoids raw URL logging.

Production uses a `__Host-` cookie, Secure, HttpOnly, SameSite=Lax, path `/`, and a seven-day session. Database stores only SHA-256 session-token hashes. Signing in rotates/revokes the previous application session. Every write verifies the exact configured `APP_ORIGIN` plus a per-session `X-CSRF-Token`; the frontend reads the token from the Session response. Space ownership remains Backend's responsibility.

Local identity access requires all of: `ENABLE_LOCAL_DEMO=true`, `localDemo:true`, nonproduction, loopback APP_ORIGIN, and loopback socket address. Fixed adapter subjects are `owner` and `participant`, mapped to `user-local-owner` / `user-local-participant`. These are local fixtures, never Google accounts. Production ignores the flag and does not register the route.

## Evidence

- `packages/auth/src/auth.test.ts`: 17 passing tests, including real RSA/JWS verification through openid-client against a local OIDC provider fixture. Covers invalid signature, nonce, audience, issuer, expiry, state replay, redirect safety, hash storage, rotation, expiry, CSRF, logout and production demo denial. This fixture is not evidence of live Google availability.
- Live local Chrome verification: Google account selection and consent returned to `/s/reading`; signed-in controls and business form appeared, while Owner orb remained absent because the account does not own the local demonstration space. Reload retained the signed-in session. Clicking Sign out restored Sign in and Sign in to add while all four public fixture records remained readable. Evidence is stored privately at `.local/deployment/google-logout-public.png`. Production-domain verification remains pending.
- No production callback or two-account live-Google isolation claim yet. Backend/API tests verify authorization independently of the provider.

## References

[Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [Google Web OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [openid-client](https://github.com/panva/openid-client).
