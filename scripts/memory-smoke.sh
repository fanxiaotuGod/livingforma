#!/usr/bin/env bash
set -euo pipefail
LIVINGFORMA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$LIVINGFORMA_ROOT/.local/memory-venv/bin/python" "$LIVINGFORMA_ROOT/scripts/memory-smoke.py"
