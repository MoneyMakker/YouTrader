#!/usr/bin/env bash
# Staging-only idempotent email QA fixture preflight.
# 1) Refuse production  2) Validate allow/deny auth + Prop Pass eligibility
# 3) Seed simulator fixture JSON  4) Report non-sensitive status only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PROD_MARKER="izzrlsgumyabdvlmwlwn"
STAGING_MARKER="zleojeqkzizeyerhjpur"
UDID="${1:-${YT_SIMULATOR_UDID:-A6BA9300-8C72-44CE-9CDD-19E096070626}}"
BUNDLE="${YT_BUNDLE_ID:-com.youtrader.pro}"
ART_DIR="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-artifacts}"
mkdir -p "$ART_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$ART_DIR/email-preflight-$STAMP.log"

{
  echo "email_preflight_start udid=$UDID stamp=$STAMP"
} | tee "$LOG"

if [[ ! -f ios/.xcode.env.staging ]]; then
  echo "error: ios/.xcode.env.staging missing" | tee -a "$LOG" >&2
  exit 1
fi
if [[ ! -f .codex/secrets/staging-qa-credentials.env ]]; then
  echo "error: staging QA credentials missing (gitignored)" | tee -a "$LOG" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ios/.xcode.env.staging
# shellcheck disable=SC1091
source .codex/secrets/staging-qa-credentials.env
if [[ -f .codex/secrets/staging-api-keys.env ]]; then
  # shellcheck disable=SC1091
  source .codex/secrets/staging-api-keys.env
fi
set +a

HOST="$(python3 - <<'PY'
import os
from urllib.parse import urlparse
u = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL") or ""
print(urlparse(u).hostname or "")
PY
)"

if [[ "$HOST" == *"$PROD_MARKER"* ]]; then
  echo "REFUSE: production Supabase host" | tee -a "$LOG" >&2
  exit 2
fi
if [[ "$HOST" != *"$STAGING_MARKER"* ]]; then
  echo "REFUSE: expected staging host containing $STAGING_MARKER got=$HOST" | tee -a "$LOG" >&2
  exit 2
fi
echo "host_ok=$HOST" | tee -a "$LOG"

echo "validating identities..." | tee -a "$LOG"
npx --yes tsx scripts/qa/preflight-email-fixture-staging.ts 2>&1 | tee -a "$LOG"

# Seed into simulator sandbox (idempotent overwrite).
if ! xcrun simctl get_app_container "$UDID" "$BUNDLE" data >/dev/null 2>&1; then
  echo "warn: app data container missing — launch Debug-Staging once, then re-run preflight" | tee -a "$LOG" >&2
  echo "email_preflight_partial=auth_ok_fixture_seed_skipped" | tee -a "$LOG"
  exit 0
fi

./scripts/staging-qa-seed-email-fixture.sh "$UDID" 2>&1 | tee -a "$LOG"

DATA_DIR="$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data)"
FIX="$DATA_DIR/Documents/qa-fixtures/email-login.json"
if [[ ! -f "$FIX" ]]; then
  echo "error: fixture file missing after seed" | tee -a "$LOG" >&2
  exit 1
fi
# Non-sensitive existence check only — never dump contents.
python3 - <<'PY' "$FIX" | tee -a "$LOG"
import json, sys
path = sys.argv[1]
raw = open(path, "r", encoding="utf-8").read()
data = json.loads(raw)
roles = []
for role in ("allow", "deny"):
    entry = data.get(role) or {}
    ok = bool((entry.get("email") or "").strip() and entry.get("password"))
    roles.append(f"{role}={'present' if ok else 'missing'}")
print("fixture_seed_ok", " ".join(roles), f"bytes={len(raw)}")
PY

echo "email_preflight_ok" | tee -a "$LOG"
