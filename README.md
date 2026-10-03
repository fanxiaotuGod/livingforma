# LivingForma

Describe an app, then keep reshaping it while its data and shared link persist.

LivingForma is a hackathon project for generating and evolving lightweight shared apps. The first demo pair is a reading tracker and a habit tracker, built with the same proposed runtime. **The application is not implemented yet.** This repository currently contains the PRD, architecture proposals, and a configured multi-agent development workflow.

## Start here

- [Product requirements](docs/PRD.md) — scope, acceptance criteria, and confirmed decisions.
- [Agent guide](AGENTS.md) — frontend, backend, agent, DevOps, QA, and coordinator responsibilities.
- [Development workflow](docs/WORKFLOW.md) — setup, parallel work, journals, and recovery.
- [Architecture proposal](docs/architecture.md) — versioned definitions, persistent state, and controlled tools.
- [Shared memory](docs/memory/README.md) and [task board](docs/memory/shared/task-board.md).
- [Memory MCP research](docs/research/local-memory.md) and [deployment plan](docs/operations/deployment.md).

## Local workflow setup

Use Python 3.12+ for Basic Memory; the configuration scripts require Python 3.11+. See the workflow guide if `python3` points to an older interpreter.

```bash
python3 scripts/setup-workflow.py --trust
bash scripts/setup-memory.sh
python3 scripts/check-workflow.py
bash scripts/memory-smoke.sh
```

`--trust` adds only this repository to Codex's trusted projects, with a private backup of the prior configuration. Start a new Codex chat rooted in this repository to load its MCP and role configuration. Memory notes live in `docs/memory/`; each machine builds its own ignored local index. This development memory is separate from the future application's database.

Use verified free allowances first. Obtain explicit user confirmation before any charge. Domain `livingforma.tech` has been requested by the owner; DNS and a live deployment have not been verified.
