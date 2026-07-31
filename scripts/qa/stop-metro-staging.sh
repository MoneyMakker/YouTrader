#!/usr/bin/env bash
# Stop only YouTrader staging Metro on the configured port.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${RCT_METRO_PORT:-8081}"
PID_FILE="${YT_METRO_PID_FILE:-$ROOT/.tools/metro-staging.pid}"

stop_pid() {
  local pid="$1"
  [[ -z "$pid" ]] && return 0
  local cmd
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ "$cmd" == *"expo start"* ]] || [[ "$cmd" == *"metro"* ]]; then
    echo "stopping pid=$pid"
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
  else
    echo "refuse: pid=$pid does not look like Expo/Metro ($cmd)"
  fi
}

if [[ -f "$PID_FILE" ]]; then
  stop_pid "$(cat "$PID_FILE")"
  rm -f "$PID_FILE"
fi

for pid in $(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true); do
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ "$cmd" == *"expo start"* ]] || [[ "$cmd" == *"youtrader-final"* && "$cmd" == *"metro"* ]]; then
    stop_pid "$pid"
  fi
done

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "warn: port $PORT still has a listener (left untouched if not YouTrader Expo)"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN || true
  exit 1
fi
echo "metro_stopped port=$PORT"
