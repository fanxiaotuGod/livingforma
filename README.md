# LivingForma

Talk to your website, reshape its interface, and keep its data and shared link.

LivingForma combines morphable app interfaces with Pi-driven tool creation and reuse. Its English application now includes sixty reusable component types (12 existing + 48 additions), six palettes, an Owner orb, Google sign-in, persistent records and live updates. Real Gemini-generated reading and habit apps, data-preserving changes, and Owner-approved Open Library tool registration/reuse have been verified against Neon PostgreSQL. Voice recording, reviewed transcription, and a local camera scene are implemented. Real voice input has published a data-preserving change; the complete camera UI → real Gemini vision → real ElevenLabs speech → browser playback flow is verified, including device release and anonymous-visitor isolation. The 60-module expansion is verified locally and has not been deployed; production remains a separate release. See the [task board](docs/memory/shared/task-board.md) for evidence.

## Run locally

Use Node.js 24 (or >=22.19) and pnpm 11.19.0. The system Node 18 is too old.

```bash
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
DATABASE_URL='' ENABLE_LOCAL_DEMO=true AGENT_MODE=local pnpm dev
```

Open `http://localhost:5173`. This command uses a persistent local PostgreSQL database, labelled test identities and local composition rules. It keeps demo writes out of a configured cloud database. For real Google/Gemini/Neon integration after configuring the private server environment, use `ENABLE_LOCAL_DEMO=false AGENT_MODE=gemini GEMINI_MODEL=gemini-3.5-flash-lite pnpm dev`. Vite proxies `/api` and `/auth` to Fastify on port 3001. `pnpm check` runs TypeScript validation, automated tests, and both production builds. `pnpm build` produces the SPA and server. The production service runs `pnpm start` with its database, HTTPS APP_ORIGIN, Google callback and private provider environment configured; see the [deployment guide](docs/operations/deployment.md).

Google OAuth credentials, database connections, and model credentials belong only in the private server environment. Local test personas and local planning are explicitly labelled; they never count as Google authentication or Gemini evidence. Production must disable development authentication. See [accepted contracts](docs/memory/shared/interfaces.md).

## Adjustable modules

Open [the local module gallery](http://localhost:5173/modules) to search and try all 60 module types with explicit sample data. In an owned space, **Add module → Configure → Save layout** adjusts desktop width/height, density, appearance, ordered field bindings and supported options. Phones use full width and fit their content. Desktop pointer resizing also has keyboard/touch controls. Saved layouts preserve records and synchronize with other viewers. Each space supports up to 24 module instances.

The [complete catalog and 16 use cases](docs/product/module-catalog.md) cover collections, planning, analytics, input controls, goals, study, local tools, discovery and reading. Pi/Gemini uses the same trusted catalog. Camera and external tools require an authorized configured real space; the gallery does not activate them. [Independent QA evidence](docs/qa/module-expansion/) covers 300 responsive cases, 22 interactions/persistence checks and review regressions.

## Start here

- [Product requirements](docs/PRD.md) — scope, acceptance criteria, and confirmed decisions.
- [Start a development chat](docs/product/start-development.md) — copy-paste coordinator and frontend prompts.
- [Use-case and capability map](docs/product/use-case-capability-map.md) — reusable frontend components, agent assembly and Pi tool creation.
- [Jarvis direction](docs/product/jarvis-vision.md) — owner orb, public websites, growing components and voice/camera milestones.
- [Frontend experience](docs/frontend/experience-direction.md) and [skill guidance](docs/frontend/skills-guide.md).
- [Agent guide](AGENTS.md) — frontend, backend, agent, DevOps, QA, and coordinator responsibilities.
- [Development workflow](docs/WORKFLOW.md) — setup, parallel work, journals, and recovery.
- [Role ownership](docs/ROLE-OWNERSHIP.md) — automatic task/file claims and new-chat prompts.
- [Service responsibilities](docs/integrations.md) — Google login, Tiger Data, Gemini, ElevenLabs, Snowflake, and domain deployment.
- [Architecture proposal](docs/architecture.md) — versioned definitions, persistent state, and controlled tools.
- [Shared memory](docs/memory/README.md) and [task board](docs/memory/shared/task-board.md).
- [Memory MCP research](docs/research/local-memory.md) and [deployment plan](docs/operations/deployment.md).

## Local workflow setup

Use Python 3.12+ for Basic Memory; the configuration scripts require Python 3.11+. See the workflow guide if `python3` points to an older interpreter.

```bash
python3 scripts/setup-workflow.py --trust
bash scripts/setup-memory.sh
python3 scripts/check-workflow.py
python3 scripts/test-coordination.py
python3 scripts/coordination.py status
bash scripts/memory-smoke.sh
```

`--trust` adds only this repository to Codex's trusted projects, with a private backup of the prior configuration. Start a new Codex chat rooted in this repository to load its MCP and role configuration. Memory notes live in `docs/memory/`; each machine builds its own ignored local index. This development memory is separate from the future application's database.

Independent chats automatically claim dependency-ready tasks from `.codex/coordination.json` using a local atomic registry; shared Markdown provides context. Same-repository worktrees share claims, while memory documents/indexes remain checkout-local. Claims are a cooperation protocol, not an operating-system write restriction.

Public websites support anonymous reading; creating, writing and managing require Google OAuth plus space authorization. Only the owner sees the editing orb. DevOps leads authentication with Backend authorization and Frontend UI support. Deploy to `livingforma.tech` after implementation and acceptance checks. Domain registration is verified; DNS and a live deployment are not. Use verified free allowances first and obtain explicit confirmation before any charge.
