#!/usr/bin/env bash
# Report staging Metro health for YouTrader QA.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${RCT_METRO_PORT:-8081}"
PID_FILE="${YT_METRO_PID_FILE:-$ROOT/.tools/metro-staging.pid}"
STAGING_MARKER="zleojeqkzizeyerhjpur"
PROD_MARKER="izzrlsgumyabdvlmwlwn"

echo "port=$PORT"
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  echo "pid_file=$PID_FILE pid=$PID"
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    echo "pid_alive=yes"
    ps -p "$PID" -o pid=,etime=,command= || true
  else
    echo "pid_alive=no"
  fi
else
  echo "pid_file=missing"
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "listen=yes"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN || true
else
  echo "listen=no"
fi

if curl -fsS "http://127.0.0.1:$PORT/status" >/tmp/yt-metro-status.json 2>/dev/null; then
  echo "http_status=ok"
  python3 - <<'PY'
import json
from pathlib import Path
try:
  d=json.loads(Path('/tmp/yt-metro-status.json').read_text())
  print('packager_status', d.get('packager_status') or d)
except Exception as e:
  print('packager_status_parse_error', e)
PY
elif curl -fsS "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
  echo "http_root=ok"
else
  echo "http=down"
  exit 1
fi

if [[ -f "$ROOT/ios/.xcode.env.staging" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/ios/.xcode.env.staging"
  HOST="$(python3 - <<'PY'
import os
from urllib.parse import urlparse
print(urlparse(os.environ.get("EXPO_PUBLIC_SUPABASE_URL","")).hostname or "")
PY
)"
  echo "configured_host=$HOST app_env=${EXPO_PUBLIC_APP_ENV:-}"
  if [[ "$HOST" == *"$PROD_MARKER"* ]]; then
    echo "error: production host configured" >&2
    exit 2
  fi
  if [[ "$HOST" != *"$STAGING_MARKER"* ]]; then
    echo "error: unexpected host" >&2
    exit 2
  fi
fi
echo "metro_status=healthy"
