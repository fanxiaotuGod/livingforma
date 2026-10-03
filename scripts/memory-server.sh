#!/usr/bin/env bash
set -euo pipefail
LIVINGFORMA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export BASIC_MEMORY_MCP_PROJECT=livingforma
exec /bin/bash "$LIVINGFORMA_ROOT/scripts/memory.sh" mcp --project livingforma
