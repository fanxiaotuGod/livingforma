# Deployment

Updated 2026-10-03, America/Vancouver. Target: `https://livingforma.tech`. The application is being built and tested locally; production deployment, DNS and production OAuth roundtrip are not yet verified.

## Current services

| Service | Actual status |
| --- | --- |
| Google OAuth | Web client created; local Google roundtrip successful; server secrets saved privately |
| Database | Neon Free, PostgreSQL 18; `SELECT 1` succeeded with `sslmode=verify-full` and certificate validation enabled |
| Tiger Data | Shared Free service created (UI: always zero cost, 1 GiB, shared compute); still empty and not used as production DB |
| Gemini | `gemini-3.5-flash-lite` actually verified for planning, Pi tools and image description; existing Free-tier project and durable Neon request ledger |
| ElevenLabs | Actual Scribe v2 transcription and River/Flash v2.5 MP3 generation verified with synthetic media; included API allowance and disabled automatic top-up independently checked in ElevenAPI billing; dedicated key capped at 10,000 credits per refresh |
| Render | Node hosting candidate; new account creation/terms step awaits user confirmation; no deployed application yet |

Gemini is pinned to the actually verified `gemini-3.5-flash-lite`, with `AGENT_MODE=gemini`. This supersedes the previous 3.8 configuration (503 during integration); the earlier 2.5 model returned 404. No automatic retry or paid model fallback is enabled. The verification concerns this account and model, not every advertised model. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [actual media evidence](../agent/evidence/LF-181-live-media.json).

The ElevenAPI billing page displayed the account's available included-credit pool, a zero PAYG top-up balance, and Automatic Top Up OFF. It did not display a separate included USD balance; public dollar prices are not a second account balance. Current [PAYG documentation](https://elevenlabs.io/docs/overview/administration/pay-as-you-go) says subscription credits are consumed first and usage pauses at zero when automatic top-up is off. The adapter also checks both extension flags are false before every generation. No credit purchase, subscription modification or top-up was performed. Real provider tests used synthetic fixtures; physical-device and deployed-browser evidence remain separate.

No plan upgrade, credit purchase or automatic billing was enabled. Secrets, account details and quota snapshots remain in ignored `.env` / `.local/deployment/`, with private file permissions.

Tiger's free service returned `SELF_SIGNED_CERT_IN_CHAIN` under certificate verification, including Node's system trust store. Its [strict SSL documentation](https://www.tigerdata.com/docs/use-timescale/latest/security/strict-ssl/) says free services do not supply the publicly verifiable certificates described there. We retained TLS verification and selected Neon Free instead. No use of `NODE_TLS_REJECT_UNAUTHORIZED=0`, `rejectUnauthorized:false`, or anonymous server trust was introduced. The unused free Tiger service remains available; its private connection backup does not make it the active DB.

Neon's billing page shows the current Free Plan at $0/month with 1 GB storage and autoscaling to 2 CU. Its initial onboarding screen said 0.5 GB; use the billing page as the later account-specific evidence and retain that discrepancy here. Idle scale-to-zero and ten branches per project were shown during onboarding. Only PostgreSQL is enabled; no Auth, gateway, storage or Functions were enabled. Usage limits must stop work or prompt the user, not trigger a paid upgrade. See [Neon plans](https://neon.com/docs/introduction/plans).

## Run locally

Use Node 24 and the repository's pinned pnpm:

```sh
pnpm install --frozen-lockfile
DATABASE_URL='' ENABLE_LOCAL_DEMO=true AGENT_MODE=local pnpm dev
```

Open `http://localhost:5173/s/reading`. Vite proxies `/api` and `/auth` to 3001. Empty `DATABASE_URL` explicitly selects the persistent local PGlite database and keeps local fixture writes out of cloud storage. Private `.env` contains Google credentials for real local sign-in. Google users own only the spaces they create; they are Participants in the local fixture spaces.

The command above deliberately uses offline planner fixtures. The reviewed private `.env` selects the live Gemini planner and existing Neon database; ordinary `pnpm dev` loads it. Before testing cloud planning or media, read the existing ledger and reserve within the remaining allowance. Do not point live credentials at a fresh local ledger to evade spent units. A new checkout's `.env.example` leaves both verification flags false until that account is checked.

```sh
pnpm check
docker build -f infra/Dockerfile -t livingforma:local .
```

`infra/Dockerfile.dockerignore` excludes all environment files, local memory, credentials and build output. The multistage image builds the Vite app and Node API, runs as the unprivileged node user, and serves frontend/API/OAuth/SSE on one origin. Coordinator verified the production-configured local container against Neon: health/session/SPA returned 200 and the local-persona route returned 404. This does not prove public-domain deployment. `/api/health` is the health check. Production must have a durable PostgreSQL connection; a host's ephemeral disk is unsuitable for PGlite data.

## Hosting configuration

`infra/render.yaml` is a prepared Blueprint using `plan: free`, same-origin HTTPS and private service environment variables. It has not been deployed. The build uses `infra/Dockerfile`; runtime is `node apps/api/dist/server.js`, binding `HOST=0.0.0.0` and platform `PORT`. Set the Blueprint path to `infra/render.yaml` when connecting the repository; it is not in the repository root.

| Runtime setting | Reviewed release value |
| --- | --- |
| `APP_ORIGIN` / `NODE_ENV` / `ENABLE_LOCAL_DEMO` | `https://livingforma.tech` / `production` / `false` |
| `DATABASE_URL` | Existing private Neon URL with `sslmode=verify-full`; preserve the existing ledgers |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Existing Web client, private service environment |
| `AGENT_MODE` / `GEMINI_MODEL` | `gemini` / `gemini-3.5-flash-lite` |
| `GEMINI_API_KEY` / `GEMINI_FREE_TIER_VERIFIED` | Existing Free-tier project's private key / `true` |
| `GEMINI_DAILY_REQUEST_LIMIT` | `30`; database reservations also enforce five requests/minute |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_ALLOWANCE_VERIFIED` | Existing restricted server key / `true` |

Both verified flags in the deployment Blueprint apply only to these reviewed accounts. Recheck eligibility, allowance and automatic-charge settings before replacing credentials. Secrets are `sync: false` placeholders in the Blueprint; never put them in a URL, frontend bundle, `VITE_*` variable, Git commit, screenshot or log. Do not set `DATA_DIR` or `GEMINI_BUDGET_FILE` on the ephemeral host.

The [Render Blueprint specification](https://render.com/docs/blueprint-spec) defines `autoDeployTrigger: "off"` and initial `sync: false` secret prompts. The explicit quotes preserve the string under YAML parsers that otherwise interpret `off` as a boolean. For subsequent Blueprint updates, new secrets must be added manually because Render does not prompt again for `sync: false` values.

The media period `verified-2026-10-03`, STT limit **60 seconds**, TTS limit **1,000 UTF-16 characters** and three requests/minute per bucket are fixed in `packages/agent/src/media.ts` and `packages/db/src/index.ts`, not read from environment variables. Backend injects the same database budget stores for planning and media. They survive deployment and process replacement. Media does not reset at midnight; failures and cancellations remain consumed. A new period or higher ceiling requires renewed allowance verification and a reviewed code change, never an edited date or deleted row.

LF-148's read-only Neon check observed Gemini **30/30** reservations for 2026-10-03, STT **5/60 seconds**, and TTS **153/1,000 characters**. Gemini was exhausted at that observation and must stop until its normal UTC-day budget resets; provider free status must remain valid. Counts can advance during authorized integration, so the existing database is authoritative. These are application ceilings, not a promise that the provider grants unlimited free service.

```sh
NODE_ENV=production APP_ORIGIN=https://livingforma.tech ENABLE_LOCAL_DEMO=false \
  node --env-file=.env scripts/deploy/preflight.mjs --production --database
```

This preflight checks safe configuration and reads existing ledgers inside a read-only transaction. It makes no provider requests, runs no migrations, does not reset quotas, and prints no credentials. Passing it means configuration and ledger continuity are valid; it does not mean quota remains or that deployment has happened.

Render [free-service rules](https://render.com/docs/free) include idle spin-down after fifteen minutes, ephemeral storage, limited monthly instance hours, bandwidth and build allowance. Do not add a payment method or upgrade to cure a limit without approval. Without a payment method, exhausted bandwidth suspends Free services and exhausted build minutes disables new builds; with a payment method those limits may create supplementary charges. The deployment must keep the new workspace without a payment method and verify that account state before creating the service. Cold starts may delay API/SSE and Google callbacks; this is not an always-on production SLA.

The API matches auth/API before SPA fallback. Unknown API paths must return errors, not `index.html`. Domain DNS records must come from the selected live service; no invented IPs or wildcard records. Validate platform HTTPS first, then the custom domain and Google redirect.

```sh
node scripts/deploy/verify.mjs https://livingforma.tech
```

This read-only smoke verifies public HTML, health, anonymous production session, Google configuration, and production local-login denial. It does not substitute for a real Google sign-in, Owner/Participant checks, two-client SSE recovery, or media tests.

## Exact remaining release steps

1. Complete LF-185 integration and independent LF-160 QA; only then claim LF-170. Media processing and synthetic provider fixtures alone are not deployed acceptance.
2. Obtain the pending user decision on Render's new-account **Create Account** terms action. The current form at `https://dashboard.render.com/register/github` still awaits submission; no account/service was created. The previous handoff tab closed, so DevOps restored the same form through the already authorized GitHub sign-in.
3. After approval, verify the Render workspace is Free and has no payment method or automatic paid upgrade. If the current offer requires a card, paid feature or other charge, stop for the user's explicit decision.
4. Review and push only application-related, secret-free changes to the intended repository. Preserve the user's unrelated local configuration. Select that exact revision, connect the repository, choose `infra/render.yaml`, and enter the existing private secrets in Render. Reuse Neon; do not create fresh quota tables to reset usage.
5. Deploy the reviewed image and verify platform HTTPS, health, same-origin API/SPA routing and production local-login denial. Obtain the actual custom-domain DNS targets from Render; configure `livingforma.tech` and wait for its HTTPS certificate. Do not invent DNS records.
6. Keep the canonical `APP_ORIGIN=https://livingforma.tech`; complete a real Google callback there, sign-out/session revocation, Owner/Participant separation, two-browser SSE/reconnect and data-preserving evolution. Verify camera/microphone permission, Stop cleanup and playback on HTTPS using only remaining verified allowance. Exhausted allowance is a truthful blocker, never a reason for automatic paid fallback.
7. Record the release commit, actual URLs, DNS/HTTPS status, rollback target and independent verification evidence. Until then, the public website is **not deployed**.

## Rollback and release evidence

Before release, preserve the last working image/commit and a database export in private storage. On Render use the previous successful deploy's **Rollback** action (or redeploy that exact commit); do not restore an old database merely to roll back the UI. Definitions and stable record IDs must remain compatible. A failed schema migration blocks rollout rather than silently discarding data. Record deployment commit, platform URL, custom-domain HTTPS, callbacks and verification results here when they actually succeed.

Media requires HTTPS and current-device browser permission. Normal SSE transports business invalidation events only, never media or a command to start another client's camera. Verify stream heartbeats, proxy buffering, reconnect, session revocation and cleanup on the actual host. Free-tier cold starts and future WebSocket lifetimes require observed evidence; no WSS or live-media claim follows from basic SSE success.


## Documented connection limits for the chosen host

Render's [WebSocket guidance](https://render.com/docs/websocket) imposes no fixed WebSocket timeout, but connections close when an instance is replaced (including deploys). This is not a claim about SSE timeout behavior or evidence that LivingForma has implemented WSS. Outbound database/API connections can reset when Render routing changes; [Render recommends reconnection handling](https://render.com/docs/outbound-connection-resets). The current client refetches authoritative snapshots after reconnect and the API sends heartbeat comments. Deployed SSE behavior still requires LF-170 smoke and should not be described as verified before release. Camera/microphone need a secure HTTPS context and explicit browser permission; neither free host access nor a signed-in session enables another device automatically.
