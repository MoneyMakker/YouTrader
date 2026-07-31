#!/usr/bin/env bash
# Seed staging-only email QA fixtures into the simulator app sandbox.
# Reads gitignored .codex/secrets/staging-qa-credentials.env — never prints secrets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SECRETS="${YT_STAGING_QA_SECRETS:-$ROOT/.codex/secrets/staging-qa-credentials.env}"
if [[ ! -f "$SECRETS" ]]; then
  echo "error: secrets file missing (expected gitignored staging QA credentials)" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$SECRETS"
set +a

UDID="${1:-booted}"
BUNDLE="${YT_BUNDLE_ID:-com.youtrader.pro}"

DATA_DIR="$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data 2>/dev/null || true)"
if [[ -z "$DATA_DIR" || ! -d "$DATA_DIR" ]]; then
  echo "error: app data container not found — install/launch Debug-Staging first" >&2
  exit 1
fi

FIX_DIR="$DATA_DIR/Documents/qa-fixtures"
mkdir -p "$FIX_DIR"
OUT="$FIX_DIR/email-login.json"

python3 - <<'PY' "$OUT"
import json, os, sys
out = sys.argv[1]
payload = {
  "allow": {
    "email": os.environ.get("STAGING_QA_ALLOW_EMAIL", "").strip(),
    "password": os.environ.get("STAGING_QA_ALLOW_PASSWORD", ""),
  },
  "deny": {
    "email": os.environ.get("STAGING_QA_DENY_EMAIL", "").strip(),
    "password": os.environ.get("STAGING_QA_DENY_PASSWORD", ""),
  },
}
if not payload["allow"]["email"] or not payload["allow"]["password"]:
    raise SystemExit("error: STAGING_QA_ALLOW_EMAIL/PASSWORD missing in secrets file")
with open(out, "w", encoding="utf-8") as f:
    json.dump(payload, f)
os.chmod(out, 0o600)
print("seeded email fixture roles=", ",".join(
    k for k,v in payload.items() if v.get("email") and v.get("password")
))
PY
