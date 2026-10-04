# LivingForma

Talk to your website, reshape its interface, and keep its data and shared link.

LivingForma turns an Owner’s text into an original website: Pi/Gemini writes HTML, CSS and JavaScript, the studio shows actual layout/source checkpoints, and a read-only browser preview runs before explicit publication. A request can also create new backend JavaScript tools with declared inputs, outputs and test cases. The host checks those tools in isolated QuickJS workers, stores immutable versions and reuses approved bindings. The reusable catalog is material the AI can use, rather than the limit of what it can create.

The English app is live at [livingforma.tech](https://livingforma.tech), including the general generator, sixty adjustable modules, six palettes, Google sign-in, persistent records/assets, shared URLs and live updates. Reviewed runtime `57edcc3` passed 312 automated tests, type checking, builds and exact-commit GitHub CI. A real hosted Pi/Gemini request generated and published [Serving Studio](https://livingforma.tech/s/space-ee2617ac) with a new tested backend tool: ordinary clicks and Enter returned 63, 225 and 240, and a saved225 record reached an anonymous viewer through live updates. Local real-model acceptance also covers swipeable photos, calculator-to-quiz evolution and tool reuse. See the [task board](docs/memory/shared/task-board.md) for current release evidence.

Generation is bounded and a draft can fail; the live page stays intact until a checked draft is published. The configured Gemini budget is 30 requests per UTC day, shared across generation, repair and vision. The October4 verification used30/30; new model work resumes at the next UTC day (October4,17:00 America/Vancouver). Existing tools, records and manual layouts remain usable. There is no paid fallback or budget reset.

In **Website studio**, describe the experience, watch its actual checkpoints, explore the checked preview, then choose **Publish website**. Use **Report an issue → Request repair** for a functional problem. Each generation has one shared repair attempt; a failed draft keeps the live website intact. **Tools** shows generated source, fixture results and reused versions. Published pages can save records, select images explicitly and invoke their bound tools; previews remain read-only. External service credentials and new permissions require separate host integration.

## Run locally

Use Node.js 24 (or >=22.19) and pnpm 11.19.0. The system Node 18 is too old.

```bash
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
DATABASE_URL='' APP_ORIGIN=http://localhost:5173 ENABLE_LOCAL_DEMO=true AGENT_MODE=local pnpm dev
```

Open `http://localhost:5173`. This command uses a persistent local PostgreSQL database, labelled test identities and local composition rules. It keeps demo writes out of a configured cloud database. Original-code generation requires a configured, verified-free Gemini service and is honestly unavailable in this mode. For real-service development, configure a separate development database and server-only provider environment, the local APP_ORIGIN and its approved Google callback, then run with `ENABLE_LOCAL_DEMO=false AGENT_MODE=gemini`. Keep one API process per database; do not start an unreviewed development server against the production database. Vite proxies `/api` and `/auth` to Fastify on port 3001. `pnpm check` runs TypeScript validation, automated tests, and both production builds. `pnpm build` produces the SPA and server. The production service runs `pnpm start` with its database, HTTPS APP_ORIGIN, Google callback and private provider environment configured; see the [deployment guide](docs/operations/deployment.md).

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

Public websites support anonymous reading; creating, writing and managing require Google OAuth plus space authorization. Only the owner sees the editing orb. DevOps leads authentication with Backend authorization and Frontend UI support. Deploy to `livingforma.tech` after implementation and acceptance checks. Canonical HTTPS, DNS and the initial live Google/Neon release have been verified. New source is deployed only after its acceptance checks and exact-commit CI pass. GitHub pushes run CI; Render auto-deploy is off, and an explicit deployment builds the production Docker image. Use verified free allowances first and obtain explicit confirmation before any charge.
