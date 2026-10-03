#!/usr/bin/env bash
set -euo pipefail
LIVINGFORMA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$LIVINGFORMA_ROOT"
mkdir -p .local
if [[ ! -x .local/memory-venv/bin/python ]]; then
  LIVINGFORMA_PYTHON="${LIVINGFORMA_PYTHON:-}"
  if [[ -z "$LIVINGFORMA_PYTHON" ]]; then
    for candidate in python3.12 python3.13 python3.14 python3; do
      if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; assert sys.version_info >= (3,12)' 2>/dev/null; then
        LIVINGFORMA_PYTHON="$(command -v "$candidate")"
        break
      fi
    done
  fi
  if [[ -z "$LIVINGFORMA_PYTHON" ]]; then
    echo "Python 3.12+ is required. Set LIVINGFORMA_PYTHON to an installed interpreter." >&2
    exit 1
  fi
  "$LIVINGFORMA_PYTHON" -c 'import sys; assert sys.version_info >= (3,12)'
  "$LIVINGFORMA_PYTHON" -m venv .local/memory-venv
fi
if ! .local/memory-venv/bin/python -c 'from importlib.metadata import version; assert version("basic-memory") == "0.23.2"' 2>/dev/null; then
  .local/memory-venv/bin/python -m pip install -r scripts/memory-requirements.txt > .local/memory-install.log 2>&1 || {
    echo "Installation failed. Inspect .local/memory-install.log." >&2
    exit 1
  }
fi
.local/memory-venv/bin/python -m pip freeze > .local/memory-installed.txt
mkdir -p docs/memory
.local/memory-venv/bin/python scripts/configure-memory.py
/bin/bash scripts/memory.sh reindex --project livingforma --search
echo "Basic Memory is installed and the livingforma Markdown project is indexed."
