#!/usr/bin/env python3
"""Seed the isolated local project before the CLI creates a default home project."""
from pathlib import Path
import json
import os
import tempfile

root = Path(__file__).resolve().parents[1]
target = root / ".local/basic-memory/config.json"
config = json.loads(target.read_text()) if target.exists() else {}
projects = config.setdefault("projects", {})
projects["livingforma"] = {"path": str(root / "docs/memory"), "mode": "local"}
config.update(default_project="livingforma", semantic_search_enabled=False,
              database_backend="sqlite", database_url=None, redis_url=None,
              auto_update=False, logfire_enabled=False, logfire_send_to_logfire=False,
              ensure_frontmatter_on_sync=False, cloud_promo_opt_out=True)
target.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile("w", dir=target.parent, delete=False) as f:
    json.dump(config, f, indent=2)
    f.write("\n")
    temporary = f.name
os.replace(temporary, target)
print("Configured the isolated livingforma local memory project.")
