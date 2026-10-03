#!/usr/bin/env bash
set -euo pipefail
LIVINGFORMA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export BASIC_MEMORY_CONFIG_DIR="$LIVINGFORMA_ROOT/.local/basic-memory"
export BASIC_MEMORY_DATABASE_BACKEND=sqlite
unset BASIC_MEMORY_DATABASE_URL BASIC_MEMORY_REDIS_URL BASIC_MEMORY_PROJECTS BASIC_MEMORY_PROJECT_ROOT BASIC_MEMORY_HOME
export BASIC_MEMORY_DEFAULT_PROJECT=livingforma
export BASIC_MEMORY_FORCE_LOCAL=true
export BASIC_MEMORY_CLOUD_MODE=false
export BASIC_MEMORY_AUTO_UPDATE=false
export BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED=false
export BASIC_MEMORY_LOGFIRE_ENABLED=false
export BASIC_MEMORY_LOGFIRE_SEND_TO_LOGFIRE=false
export BASIC_MEMORY_ENSURE_FRONTMATTER_ON_SYNC=false
export BASIC_MEMORY_CLOUD_PROMO_OPT_OUT=true
export BASIC_MEMORY_LOG_LEVEL=WARNING
export OTEL_SDK_DISABLED=true
export FASTMCP_CHECK_FOR_UPDATES=off
export FASTMCP_SHOW_SERVER_BANNER=false
if [[ ! -x "$LIVINGFORMA_ROOT/.local/memory-venv/bin/basic-memory" ]]; then
  echo "Run bash scripts/setup-memory.sh from the LivingForma repository first." >&2
  exit 1
fi
cd "$LIVINGFORMA_ROOT"
exec "$LIVINGFORMA_ROOT/.local/memory-venv/bin/python" "$LIVINGFORMA_ROOT/.local/memory-venv/bin/basic-memory" "$@"
