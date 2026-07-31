#!/usr/bin/env bash
# Start Metro for Debug-Staging against staging Supabase only.
# Never loads production .env — EXPO_NO_DOTENV=1 + staging xcode env.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f ios/.xcode.env.staging ]]; then
  echo "error: ios/.xcode.env.staging missing" >&2
  exit 1
fi

# Clear potentially sticky production Expo public vars before sourcing staging.
unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY EXPO_PUBLIC_SUPABASE_ANON_KEY || true
unset EXPO_PUBLIC_APP_ENV APP_ENV || true

set -a
# shellcheck disable=SC1091
source ios/.xcode.env.staging
set +a

export EXPO_NO_DOTENV=1
export EXPO_PUBLIC_QA_RESET_AUTH="${EXPO_PUBLIC_QA_RESET_AUTH:-0}"
export RCT_METRO_PORT="${RCT_METRO_PORT:-8081}"

HOST="$(python3 - <<'PY'
import os
from urllib.parse import urlparse
print(urlparse(os.environ.get("EXPO_PUBLIC_SUPABASE_URL","")).hostname or "")
PY
)"
if [[ "$HOST" == *izzrlsgumyabdvlmwlwn* ]]; then
  echo "error: refusing to start Metro — production Supabase host detected" >&2
  exit 1
fi
if [[ "${EXPO_PUBLIC_APP_ENV:-}" != "staging" && "${EXPO_PUBLIC_APP_ENV:-}" != "development" ]]; then
  echo "error: EXPO_PUBLIC_APP_ENV must be staging/development for this script" >&2
  exit 1
fi

echo "metro staging host=$HOST app_env=${EXPO_PUBLIC_APP_ENV} port=$RCT_METRO_PORT"

# Expo dotenv loads .env then .env.local. Root .env may point at production.
# Always materialize a staging .env.local overlay (gitignored) before start.
python3 - <<'PY'
from pathlib import Path
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
# Preserve explicit QA reset from the parent shell when set.
import os
qa = os.environ.get("EXPO_PUBLIC_QA_RESET_AUTH", "0").strip() or "0"
lines = [l for l in lines if not l.startswith("EXPO_PUBLIC_QA_RESET_AUTH=")]
lines.append(f"EXPO_PUBLIC_QA_RESET_AUTH={qa}")
Path(".env.local").write_text("\n".join(lines) + "\n")
print("note: wrote .env.local staging overlay")
PY

# macOS without Watchman hits EMFILE under Expo's file watcher. Prefer CI mode
# (no watch) unless YT_METRO_WATCH=1 and watchman is installed.
if [[ "${YT_METRO_WATCH:-0}" != "1" ]] || ! command -v watchman >/dev/null 2>&1; then
  export CI=1
  echo "metro mode=CI (no watch; install watchman or set YT_METRO_WATCH=1 for reload)"
fi

exec npx expo start --dev-client --port "$RCT_METRO_PORT" --localhost --clear
