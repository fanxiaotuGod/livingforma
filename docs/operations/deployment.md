# Deployment

Updated 2026-10-04 02:07 America/Vancouver. The current Free release at [livingforma.tech](https://livingforma.tech), with [Render fallback](https://livingforma.onrender.com), is exact reviewed commit `22f78d2d977049c0c8193705ca6194fed58c3a25`, deploy `dep-db1176id0e5s73dke66g`, Live after 1m07s. [CI37190026028](https://github.com/fanxiaotuGod/livingforma/actions/runs/37190026028) passed; coordinator verified 308 tests/typecheck/build. The deployment includes 60 modules and general browser-code/tool generation. Both origins pass strict HTTPS smoke; real canonical Google logout/login passed. Neon migrations 1–6 are present, and the two existing spaces plus provider/media ledgers compared identically immediately after deployment.

**LF-228 acceptance is incomplete.** One actual hosted Pi/Gemini request generated Serving Studio and `scale_ingredient@1`; two QuickJS fixtures and browser startup checks passed, source revision 1 was published, and the coordinator's unchanged anonymous browser received the definition through SSE. Ordinary Calculate submission is blocked: valid Flour/150/4/6 inputs produce no tool POST or result, while Save stays disabled. The generated page uses a form submit listener; the frame currently has `sandbox="allow-scripts"` and CSP `form-action 'none'`. A host compatibility fix and ordinary browser regression are required before claiming the generated interaction works. Preserve the published candidate and registry; it needs no new model request. [Incomplete handoff](../memory/handoffs/devops/LF-228-0840cd91-59a7-4061-b9fd-3535933b8093.md).

The latest read-only Gemini ledger is **30/30 for 2026-10-04 UTC** after this single hosted generation (29/30 before). New model requests must wait for the normal UTC-day reset, without refunds, resets or paid fallback. Existing published page/record/tool operations do not inherently require another model call. Media remains STT5/60s and TTS695/1000chars in the original fixed period.

The previous completed release and media/session evidence remain historical: [LF-170](../memory/handoffs/devops/LF-170-1b9bcef2-81b0-48d2-95ae-da2572c6e0f1.json).

The earlier GitGuardian alert was directly identified as a catalog-digest false positive; no credential rotation or alert mutation was needed. A genuine stale-CSRF403 was then fixed and independently verified before this hotfix deployment.

## Current services

| Service | Actual status |
| --- | --- |
| Google OAuth | Local and canonical Google login/refresh/logout successful; same-account cross-tab CSRF recovery verified; secrets remain server-private |
| Database | Neon Free, PostgreSQL 18; `SELECT 1` succeeded with `sslmode=verify-full` and certificate validation enabled |
| Tiger Data | Shared Free service created (UI: always zero cost, 1 GiB, shared compute); still empty and not used as production DB |
| Gemini | `gemini-3.5-flash-lite` actually verified for planning, Pi tools and image description; existing Free-tier project and durable Neon request ledger |
| ElevenLabs | Actual Scribe v2 transcription and River/Flash v2.5 MP3 generation verified with synthetic media; included API allowance and disabled automatic top-up independently checked in ElevenAPI billing; dedicated key capped at 10,000 credits per refresh |
| Render | Free Docker web service `srv-db0pi4lg1s2s73f4vnbg`, Virginia, 0.1 CPU / 512 MB, no payment method; platform HTTPS smoke passed |

Gemini is pinned to the actually verified `gemini-3.5-flash-lite`, with `AGENT_MODE=gemini`. This supersedes the previous 3.8 configuration (503 during integration); the earlier 2.5 model returned 404. No automatic retry or paid model fallback is enabled. The verification concerns this account and model, not every advertised model. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [actual media evidence](../agent/evidence/LF-181-live-media.json).

The ElevenAPI billing page displayed the account's available included-credit pool, a zero PAYG top-up balance, and Automatic Top Up OFF. It did not display a separate included USD balance; public dollar prices are not a second account balance. Current [PAYG documentation](https://elevenlabs.io/docs/overview/administration/pay-as-you-go) says subscription credits are consumed first and usage pauses at zero when automatic top-up is off. The adapter also checks both extension flags are false before every generation. No credit purchase, subscription modification or top-up was performed. Provider tests used synthetic fixtures. LF170 additionally verified the actual deployed browser with a synthetic canvas camera and real Gemini/TTS; no physical camera or microphone was used.

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

The actual service was created through Render **Public Git Repository**, using `https://github.com/fanxiaotuGod/livingforma` and the exact reviewed commit. No new GitHub App access was granted. Its settings match the prepared `infra/render.yaml` but this was a manual service setup, not a Blueprint deployment. Dockerfile `infra/Dockerfile`, build context `.`, no command override/pre-deploy, health `/api/health`, Virginia Free instance. Runtime binds `HOST=0.0.0.0` and Render-provided `PORT`. Auto-Deploy is **Off**; GitHub CI checks pushes/PRs, but does not push a container or release automatically. Deploy later work only after review and explicit version selection.

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

LF-148's read-only Neon check observed Gemini **30/30** reservations for 2026-10-03, STT **5/60 seconds**, and TTS **153/1,000 characters**. Gemini was exhausted at that observation and must stop until its normal UTC-day budget resets; provider free status must remain valid. The final LF170 observation is Gemini10/30 for2026-10-04 UTC, STT5/60 and TTS695/1000 in the same fixed media period. Counts can advance during authorized use, so the existing database is authoritative. These are application ceilings, not a promise that the provider grants unlimited free service.

```sh
NODE_ENV=production APP_ORIGIN=https://livingforma.tech ENABLE_LOCAL_DEMO=false \
  node --env-file=.env scripts/deploy/preflight.mjs --production --database
```

This preflight checks safe configuration and reads existing ledgers inside a read-only transaction. It makes no provider requests, runs no migrations, does not reset quotas, and prints no credentials. Passing it means configuration and ledger continuity are valid; it does not mean quota remains or that deployment has happened.

Render [free-service rules](https://render.com/docs/free) include idle spin-down after fifteen minutes, ephemeral storage, limited monthly instance hours, bandwidth and build allowance. Do not add a payment method or upgrade to cure a limit without approval. Without a payment method, exhausted bandwidth suspends Free services and exhausted build minutes disables new builds; with a payment method those limits may create supplementary charges. The workspace was verified as Hobby with no card and no pending charges immediately before creation. It must remain without a payment method unless the user approves a change. Cold starts may delay API/SSE and Google callbacks; this is not an always-on production SLA.

The API matches auth/API before SPA fallback. Unknown API paths must return errors, not `index.html`. Domain DNS records must come from the selected live service; no invented IPs or wildcard records. Validate platform HTTPS first, then the custom domain and Google redirect.

```sh
node scripts/deploy/verify.mjs https://livingforma.tech
```

This read-only smoke verifies public HTML, health, anonymous production session, Google configuration, and production local-login denial. It does not substitute for a real Google sign-in, Owner/Participant checks, two-client SSE recovery, or media tests.

## Verified release

- Foundation7efaa91 passed100 tests and independent LF160 QA. The session hotfix `eedd1d4` passed112 tests/typecheck/build, independent LF211 actual Chrome16/16, and [GitHub CI37166475387](https://github.com/fanxiaotuGod/livingforma/actions/runs/37166475387). Render built the same `index-Bt_tUXM1.js` bundle and manually deployed the exact SHA.
- The user created the Render account and explicitly approved five existing credentials in Render private environment. Free plan, no card, no new fees, existing Neon and Auto-DeployOff remain unchanged.
- Namify apex `A216.24.57.1` and `www CNAME livingforma.onrender.com` use exactly two included domains. Both certificates are issued; www redirects to apex. Normal Chrome/IAB and strict Node HTTPS now work; the earlier negative DNS cache has cleared.
- Real Google same-account rotation in a second tab changed CSRF. The old tab's protected-write preflight fetched the new token and made exactly one successful proposal POST. Cards sorted by rating appeared through SSE in an independent anonymous IAB without URL or loader change. Both complete record objects survived the morph. A subsequent synthetic Secret Garden update toReading/80% persisted through reload and reached the same anonymous client. The Little Prince stays35%.
- One hosted synthetic-camera observation returned200, a real English Gemini description and real ElevenLabs playback. `playing` fired once; Stop ended the video track and paused/cleared audio. Automatic descriptions stayedoff. The fixture was restored and removed. No physical-device permissions or extra STT call were used.
- Actual logout returned200, the session became anonymous with null CSRF, the secure session cookie disappeared, and both public books remained readable without Owner controls. Both origins passed health/session/local-login404/HTML smoke after deployment.
- Verified free-stop behavior remains backed by [the actual exhausted-ledger integration trace](../memory/handoffs/coordinator/LF-185-camera-quota-evidence.json) and independent LF160 review on the same unchanged server budget logic. LF170 did not exhaust or reset allowances merely to repeat it.
- Known limits: free cold starts; no Google two-account production test or physical-device test in this release; AppSpec history UI remains deferred. The model omitted optional `rating.defaultValue=0` during the morph, while preserving field types/constraints and all existing values. Its Open Library summary said “Added” although that tool was already present. Neither finding is described as exact schema equality.

## Rollback and release evidence

**Current compatibility constraint:** after migrations 5–6 and publication of a generated definition/tool, do not roll back to the original `7efaa91` or session-hotfix `eedd1d4` images. They lack this runtime. Preserve Neon records, generated versions/tools and allowance rows; deploy a reviewed compatible forward fix or redeploy the same compatible SHA. LF-228 has not yet performed its same-SHA replacement drill, because ordinary generated-form acceptance is blocked. Earlier drills below are historical evidence only.

The first-release recovery drill actually ran: the same reviewed commit was redeployed as `dep-db0pk1mgekts73aot5f0` (32.5s), then Render's **Rollback** action restored the first successful image as `dep-db0pkiou01pc73bdtjj0` (20.6s). Render reported no configuration changes. Platform smoke passed afterward. All nine application tables compared identically before/after, including two spaces, their records/events, tools and three provider-budget rows. A private 0600 application-row backup is in ignored `.local/deployment/`; ephemeral sessions/OAuth transactions were excluded. No database restore or allowance reset was performed.

The earlier tested recovery target is exact commit `7efaa919361be0165f8bc0bf20852f0c0e2b37b6` and successful initial deploy `dep-db0pi4tg1s2s73f4vp2g`. That older image contains the now-fixed stale-session issue; prefer the current reviewed hotfix as the next known-good target. To recover, select a previous successful deploy's **Rollback**, review its configuration diff, then verify health, session, public snapshots and ledger continuity. Do not restore an old database merely to roll back UI/API code. This same-version exercise proves image replacement and persistent storage continuity; it does not claim migration compatibility with future unreviewed schemas.

Media requires HTTPS and current-device browser permission. Normal SSE transports business invalidation events only, never media or a command to start another client's camera. Verify stream heartbeats, proxy buffering, reconnect, session revocation and cleanup on the actual host. Free-tier cold starts and future WebSocket lifetimes require observed evidence; no WSS or live-media claim follows from basic SSE success.


## Documented connection limits for the chosen host

Render's [WebSocket guidance](https://render.com/docs/websocket) imposes no fixed WebSocket timeout, but connections close when an instance is replaced (including deploys). This is not a claim about SSE timeout behavior or evidence that LivingForma has implemented WSS. Outbound database/API connections can reset when Render routing changes; [Render recommends reconnection handling](https://render.com/docs/outbound-connection-resets). The current client refetches authoritative snapshots after reconnect and the API sends heartbeat comments. LF170 verified actual hosted anonymous SSE for layout and record changes with the same browser loader and URL; this is not a long-duration uptime benchmark. Camera/microphone need a secure HTTPS context and explicit browser permission; neither free host access nor a signed-in session enables another device automatically.
