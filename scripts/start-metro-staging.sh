#!/usr/bin/env bash
# Compatibility wrapper — deterministic harness lives in scripts/qa/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-start}"
# Foreground mode for developers who want logs in-terminal:
#   YT_METRO_FOREGROUND=1 ./scripts/start-metro-staging.sh
if [[ "${YT_METRO_FOREGROUND:-0}" == "1" ]]; then
  exec "$ROOT/scripts/qa/start-metro-staging.sh" "$MODE"
fi
# Default: managed start with PID/log/health (non-blocking once healthy).
exec "$ROOT/scripts/qa/start-metro-staging.sh" "$MODE"
