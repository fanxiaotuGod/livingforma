#!/usr/bin/env python3
"""Check operational workflow contracts without calling a model or cloud service."""
from pathlib import Path
import re
import subprocess
import sys
import tomllib

root = Path(__file__).resolve().parents[1]
errors = []
roles = {"frontend", "backend", "agent", "devops", "qa"}
sys.path.insert(0, str(root / "scripts"))
from coordination import CoordinationError, read_catalog

try:
    tasks = read_catalog(root)
    assert roles | {"coordinator"} == {task["role"] for task in tasks}
    for task in tasks:
        assert f"docs/memory/roles/{task['role']}/" in task["paths"]
        assert f"docs/memory/handoffs/{task['role']}/" in task["paths"]
except (AssertionError, CoordinationError) as e:
    errors.append(f"Task catalog: {e}")
config_path = root / ".codex/config.toml"
try:
    config = tomllib.loads(config_path.read_text())
    assert config["agents"]["enabled"] is True
    assert config["agents"]["max_concurrent_threads_per_session"] == 3
    assert roles <= set(config["agents"])
    assert not {"model", "approval_policy", "sandbox_mode", "default_permissions"} & set(config)
    for role in roles:
        layer = root / ".codex" / config["agents"][role]["config_file"]
        instructions = tomllib.loads(layer.read_text())["developer_instructions"]
        assert isinstance(instructions, str) and f"roles/{role}/memory.md" in instructions
        assert "scripts/coordination.py" in instructions
    server = config["mcp_servers"]["livingforma_memory"]
    assert Path(server["cwd"]) == root
    assert Path(server["args"][0]).is_file()
    assert server["command"] == "/bin/bash"
    assert "delete_note" not in server["enabled_tools"]
except (AssertionError, KeyError, OSError, tomllib.TOMLDecodeError) as e:
    errors.append(f"Codex configuration: {type(e).__name__}: {e}")

for role in roles | {"coordinator"}:
    for name in ("memory.md", "journal.md"):
        p = root / "docs/memory/roles" / role / name
        if not p.is_file():
            errors.append(f"Missing {p.relative_to(root)}")
for name in ("project-context", "decisions", "interfaces", "task-board"):
    if not (root / f"docs/memory/shared/{name}.md").is_file():
        errors.append(f"Missing shared note: {name}")
for p in [root / "README.md", root / "AGENTS.md", *root.glob("docs/**/*.md")]:
    if not p.is_file():
        errors.append(f"Missing {p.name}")
        continue
    for target in re.findall(r"(?<!!)\[[^\]]*\]\(([^)]+)\)", p.read_text()):
        target = target.strip("<>").split("#", 1)[0]
        if not target or re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target):
            continue
        if not (p.parent / target).exists():
            errors.append(f"Broken link in {p.relative_to(root)}: {target}")
for p in root.glob("scripts/*.sh"):
    result = subprocess.run(["bash", "-n", str(p)], capture_output=True, text=True)
    if result.returncode:
        errors.append(f"Shell syntax {p.name}: {result.stderr}")
for ignored in (".local/test.db", ".local/service-status.json", ".codex/config.toml", ".env"):
    result = subprocess.run(["git", "check-ignore", "-q", ignored], cwd=root)
    if result.returncode:
        errors.append(f"Not ignored: {ignored}")
if errors:
    print("\n".join(errors))
    sys.exit(1)
print("PASS: roles, task catalog, ownership memory files, local links, Codex config, shell syntax, and ignored local data.")
