#!/usr/bin/env bash
# Deterministic staging Metro harness for YouTrader Debug-Staging QA.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PORT="${RCT_METRO_PORT:-8081}"
PID_FILE="${YT_METRO_PID_FILE:-$ROOT/.tools/metro-staging.pid}"
LOG_DIR="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-artifacts}"
mkdir -p "$(dirname "$PID_FILE")" "$LOG_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$LOG_DIR/metro-staging-$STAMP.log"
MODE="${1:-start}" # start | restart | clear
CLEAR=0
[[ "$MODE" == "clear" || "${YT_METRO_CLEAR:-0}" == "1" ]] && CLEAR=1
[[ "$MODE" == "restart" ]] && CLEAR="${YT_METRO_CLEAR:-0}"

PROD_MARKER="izzrlsgumyabdvlmwlwn"
STAGING_MARKER="zleojeqkzizeyerhjpur"

if [[ ! -f ios/.xcode.env.staging ]]; then
  echo "error: ios/.xcode.env.staging missing" >&2
  exit 1
fi

# Raise soft file descriptor limit for Expo file watching when enabled.
ulimit -n 10240 2>/dev/null || ulimit -n 4096 2>/dev/null || true

load_staging_env() {
  unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY EXPO_PUBLIC_SUPABASE_ANON_KEY || true
  unset EXPO_PUBLIC_APP_ENV APP_ENV || true
  set -a
  # shellcheck disable=SC1091
  source ios/.xcode.env.staging
  set +a
  export EXPO_NO_DOTENV=1
  export EXPO_PUBLIC_QA_RESET_AUTH="${EXPO_PUBLIC_QA_RESET_AUTH:-0}"
  export RCT_METRO_PORT="$PORT"
}

host_from_url() {
  python3 - <<'PY'
import os
from urllib.parse import urlparse
print(urlparse(os.environ.get("EXPO_PUBLIC_SUPABASE_URL","")).hostname or "")
PY
}

is_healthy() {
  local listen_pid
  listen_pid="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
  if [[ -n "$listen_pid" ]]; then
    local cmd
    cmd="$(ps -p "$listen_pid" -o command= 2>/dev/null || true)"
    if [[ "$cmd" == *"expo"* ]] || [[ "$cmd" == *"metro"* ]] || [[ "$cmd" == *"youtrader-final"* ]]; then
      echo "$listen_pid" > "$PID_FILE"
      if curl -fsS "http://127.0.0.1:$PORT/status" >/dev/null 2>&1 \
        || curl -fsS "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
        return 0
      fi
    fi
  fi
  return 1
}

stop_obsolete_youtrader_metro() {
  # Only stop listeners on our Metro port that look like Expo for this repo.
  local pids
  pids="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
  for pid in $pids; do
    local cmd
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [[ "$cmd" == *"expo start"* ]] || [[ "$cmd" == *"metro"* && "$cmd" == *"youtrader-final"* ]]; then
      echo "stopping obsolete YouTrader Metro pid=$pid" | tee -a "$LOG"
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  rm -f "$PID_FILE"
}

write_env_overlay() {
  python3 - <<'PY'
from pathlib import Path
import os, shutil
PROD_MARKER = "izzrlsgumyabdvlmwlwn"
staging = Path("ios/.xcode.env.staging").read_text()
lines = []
for raw in staging.splitlines():
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    if line.startswith("export "):
        line = line[len("export ") :]
    key = line.split("=", 1)[0]
    if key.startswith("EXPO_PUBLIC_") or key in {"APP_ENV"}:
        lines.append(line)
qa = os.environ.get("EXPO_PUBLIC_QA_RESET_AUTH", "0").strip() or "0"
lines = [l for l in lines if not l.startswith("EXPO_PUBLIC_QA_RESET_AUTH=")]
lines.append(f"EXPO_PUBLIC_QA_RESET_AUTH={qa}")
overlay = "\n".join(lines) + "\n"
Path(".env.local").write_text(overlay)
env_path = Path(".env")
if env_path.exists() and PROD_MARKER in env_path.read_text():
    quarantine = Path(".env.production.quarantine")
    if not quarantine.exists():
        shutil.copy2(env_path, quarantine)
    env_path.write_text(overlay)
print("env_overlay=ok")
PY
}

wait_ready() {
  local i
  for i in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$PORT/status" >/dev/null 2>&1 \
      || curl -fsS "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
      echo "metro_ready port=$PORT attempt=$i" | tee -a "$LOG"
      return 0
    fi
    sleep 1
  done
  echo "error: Metro did not become ready on :$PORT" | tee -a "$LOG" >&2
  return 1
}

load_staging_env
HOST="$(host_from_url)"
if [[ "$HOST" == *"$PROD_MARKER"* ]]; then
  echo "error: refusing production Supabase host" >&2
  exit 1
fi
if [[ "$HOST" != *"$STAGING_MARKER"* ]]; then
  echo "error: expected staging host containing $STAGING_MARKER, got=$HOST" >&2
  exit 1
fi
if [[ "${EXPO_PUBLIC_APP_ENV:-}" != "staging" && "${EXPO_PUBLIC_APP_ENV:-}" != "development" ]]; then
  echo "error: EXPO_PUBLIC_APP_ENV must be staging/development" >&2
  exit 1
fi

if [[ "$MODE" != "restart" && "$MODE" != "clear" && "$MODE" != "start" ]]; then
  echo "usage: $0 [start|restart|clear]" >&2
  exit 64
fi

if [[ "$MODE" == "start" ]] && is_healthy; then
  echo "metro already healthy pid=$(cat "$PID_FILE") port=$PORT host=$HOST" | tee -a "$LOG"
  exit 0
fi

if [[ "$MODE" == "restart" || "$MODE" == "clear" ]] || ! is_healthy; then
  stop_obsolete_youtrader_metro
fi

write_env_overlay | tee -a "$LOG"

if [[ "${YT_METRO_WATCH:-0}" == "1" ]]; then
  # Expo getenv.boolish rejects empty CI=""; must fully unset for watch mode.
  unset CI
  # Watchman is preferred but not required — Expo falls back to Node FS events.
  if command -v watchman >/dev/null 2>&1; then
    echo "metro mode=watch (watchman)" | tee -a "$LOG"
  else
    echo "metro mode=watch (node-fs; watchman not installed)" | tee -a "$LOG"
  fi
else
  export CI=1
  echo "metro mode=CI (no watch)" | tee -a "$LOG"
fi

EXPO_ARGS=(npx expo start --dev-client --port "$PORT" --localhost)
[[ "$CLEAR" == "1" || "$MODE" == "clear" ]] && EXPO_ARGS+=(--clear)

echo "starting Metro host=$HOST app_env=$EXPO_PUBLIC_APP_ENV port=$PORT clear=$CLEAR log=$LOG" | tee -a "$LOG"
# Detach into a new session so Metro survives the launching shell (Cursor tool
# sessions kill process-group children even under nohup).
NPM_PID="$(
  python3 - "$LOG" "${EXPO_ARGS[@]}" <<'PY'
import os, sys, subprocess
log_path = sys.argv[1]
args = sys.argv[2:]
log_f = open(log_path, "a", buffering=1)
proc = subprocess.Popen(
    args,
    stdin=subprocess.DEVNULL,
    stdout=log_f,
    stderr=subprocess.STDOUT,
    start_new_session=True,
    env=os.environ.copy(),
    cwd=os.getcwd(),
)
print(proc.pid)
PY
)"
echo "$NPM_PID" > "$PID_FILE"
echo "metro_npm_pid=$NPM_PID detached=1" | tee -a "$LOG"

wait_ready
# Prefer the actual listening Node PID for liveness checks.
LISTEN_PID="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
if [[ -n "$LISTEN_PID" ]]; then
  echo "$LISTEN_PID" > "$PID_FILE"
  echo "metro_listen_pid=$LISTEN_PID" | tee -a "$LOG"
fi
curl -fsS "http://127.0.0.1:$PORT/status" >>"$LOG" 2>&1 || true
echo "metro_start_ok" | tee -a "$LOG"
