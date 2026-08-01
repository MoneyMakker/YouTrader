#!/usr/bin/env bash
# Lane A — deterministic staging email session bootstrap (no Google/Apple).
# State-based wait for Journal. Failures are QA_HARNESS_FAIL, not product FAIL.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PROD_MARKER="izzrlsgumyabdvlmwlwn"
STAGING_MARKER="zleojeqkzizeyerhjpur"
UDID="${YT_SIMULATOR_UDID:-A6BA9300-8C72-44CE-9CDD-19E096070626}"
BUNDLE="${YT_BUNDLE_ID:-com.youtrader.pro}"
ROLE="${YT_QA_EMAIL_ROLE:-allow}"
ART_DIR="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-logs}"
SHOT_DIR="${YT_QA_SCREENSHOT_DIR:-$ROOT/docs/releases/1.6.1/phase4f-screenshots}"
mkdir -p "$ART_DIR" "$SHOT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$ART_DIR/bootstrap-email-$STAMP.log"
REPORT="$ART_DIR/bootstrap-email-precondition-$STAMP.json"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"

log() { echo "$*" | tee -a "$LOG"; }

write_report() {
  python3 - <<PY
import json
print(json.dumps({
  "lane": "A",
  "status": "$1",
  "reason": """$2""",
  "stamp": "$STAMP",
  "udid": "$UDID",
  "bundle": "$BUNDLE",
  "role": "$ROLE",
  "staging_host": "$3",
  "metro_http": "$4",
  "fixture_ok": $( [[ "$5" == "true" ]] && echo True || echo False ),
  "journal_visible": $( [[ "$6" == "true" ]] && echo True || echo False ),
}, indent=2))
PY
}

fail_harness() {
  local reason="$1"
  local host="$2"
  local metro="$3"
  local fixture="$4"
  xcrun simctl io "$UDID" screenshot "$SHOT_DIR/bootstrap_email_fail_${STAMP}.png" 2>/dev/null || true
  write_report "QA_HARNESS_FAIL" "$reason" "$host" "$metro" "$fixture" false | tee "$REPORT" | tee -a "$LOG"
  log "QA_HARNESS_FAIL reason=$reason"
  exit 10
}

log "bootstrap_email_start stamp=$STAMP udid=$UDID role=$ROLE"

[[ -f ios/.xcode.env.staging ]] || fail_harness "missing_xcode_env_staging" "" "" false
set -a
# shellcheck disable=SC1091
source ios/.xcode.env.staging
set +a
HOST="$(python3 - <<'PY'
import os
from urllib.parse import urlparse
u = os.environ.get("EXPO_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or ""
print(urlparse(u).hostname or "")
PY
)"
[[ "$HOST" != *"$PROD_MARKER"* ]] || fail_harness "production_host_refused" "$HOST" "" false
[[ "$HOST" == *"$STAGING_MARKER"* ]] || fail_harness "staging_host_mismatch" "$HOST" "" false
log "host_ok=$HOST"

METRO_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:8081/status 2>/dev/null || echo none)"
log "metro_http=$METRO_CODE"

bash scripts/qa/preflight-email-fixture-staging.sh "$UDID" 2>&1 | tee -a "$LOG"
DATA_DIR="$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data 2>/dev/null || true)"
FIX_OK=false
[[ -n "$DATA_DIR" && -f "$DATA_DIR/Documents/qa-fixtures/email-login.json" ]] && FIX_OK=true
[[ "$FIX_OK" == true ]] || fail_harness "fixture_missing_after_preflight" "$HOST" "$METRO_CODE" false
log "fixture_ok=1"

# Clean ownership: terminate clears ASWebAuth / OAuth sheets from Lane B.
log "terminate_app"
xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
sleep 1
log "launch_app"
xcrun simctl launch --console-pty "$UDID" "$BUNDLE" >/dev/null 2>&1 &
LAUNCH_PID=$!
sleep 3
kill "$LAUNCH_PID" 2>/dev/null || true
xcrun simctl launch "$UDID" "$BUNDLE" 2>&1 | tee -a "$LOG" || true
sleep 2

# Fire email-login twice: cold Linking.getInitialURL + subsequent event.
log "open_email_login_1"
xcrun simctl openurl "$UDID" "youtrader://qa/email-login?role=${ROLE}" 2>&1 | tee -a "$LOG"
sleep 2
log "open_email_login_2"
xcrun simctl openurl "$UDID" "youtrader://qa/email-login?role=${ROLE}" 2>&1 | tee -a "$LOG"

FLOW="$ROOT/.maestro/yt3/lane_a_wait_journal.yaml"
cat > "$FLOW" <<'YAML'
appId: com.youtrader.pro
---
# Lane A: wait until Journal is stable (no Google/Apple).
- repeat:
    times: 20
    commands:
      - runFlow:
          when:
            visible: "Dismiss"
          commands:
            - tapOn: "Dismiss"
      - runFlow:
          when:
            visible: "Open debugger to view warnings"
          commands:
            - tapOn:
                point: "92%,88%"
      - runFlow:
          when:
            visible: "Unlock Your Trading Edge"
          commands:
            - tapOn:
                id: "acquisition-paywall-close"
      - runFlow:
          when:
            visible: "Cancel"
            notVisible: "Journal"
          commands:
            - tapOn: "Cancel"
      - runFlow:
          when:
            visible: "Continue"
            notVisible: "Journal|Continue with Apple|Continue with Google"
          commands:
            - tapOn: "Cancel"
- extendedWaitUntil:
    visible: "Journal"
    timeout: 90000
- tapOn: "Journal"
- assertVisible: "Journal"
- assertVisible: "\\+ Add Trade|journal-add-trade|Your next edge|Month P&L|Synced"
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/lane_a_journal_ready
YAML

log "maestro_wait_journal"
if ! maestro --device "$UDID" test "$FLOW" 2>&1 | tee -a "$LOG"; then
  fail_harness "journal_not_visible_after_email_login" "$HOST" "$METRO_CODE" true
fi

xcrun simctl openurl "$UDID" "youtrader://qa/tab?id=journal" 2>/dev/null || true
xcrun simctl io "$UDID" screenshot "$SHOT_DIR/bootstrap_email_ok_${STAMP}.png" 2>/dev/null || true
write_report "QA_HARNESS_PASS" "journal_ready" "$HOST" "$METRO_CODE" true true | tee "$REPORT" | tee -a "$LOG"
log "QA_HARNESS_PASS journal_ready report=$REPORT"
exit 0
