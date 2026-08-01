#!/usr/bin/env bash
# Lane B — qa/reset-auth → wait qa.reset.complete (no fixed sleep) → cold relaunch → Auth.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
UDID="${YT_SIMULATOR_UDID:-A6BA9300-8C72-44CE-9CDD-19E096070626}"
BUNDLE="${YT_BUNDLE_ID:-com.youtrader.pro}"
ART_DIR="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-logs}"
SHOT_DIR="${YT_QA_SCREENSHOT_DIR:-$ROOT/docs/releases/1.6.1/phase4f-screenshots}"
mkdir -p "$ART_DIR" "$SHOT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$ART_DIR/bootstrap-auth-ready-$STAMP.log"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"
log() { echo "$*" | tee -a "$LOG"; }

log "bootstrap_auth_ready_start stamp=$STAMP contract=qa.reset.complete"
# Ensure no leftover ASWebAuth / Google sheet blocks deep links.
xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
sleep 1
FLOW="$ROOT/.maestro/yt3/lane_b_wait_reset_complete.yaml"
cat > "$FLOW" <<'YAML'
appId: com.youtrader.pro
---
- launchApp:
    clearState: false
- openLink: youtrader://qa/reset-auth
- openLink: youtrader://qa/reset-auth
- extendedWaitUntil:
    visible:
      id: "auth.screen"
    timeout: 90000
- extendedWaitUntil:
    visible:
      id: "qa.reset.complete"
    timeout: 30000
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s10_reset_complete
- stopApp
- launchApp:
    clearState: false
- extendedWaitUntil:
    visible:
      id: "auth.screen"
    timeout: 90000
- extendedWaitUntil:
    visible:
      id: "auth.google"
    timeout: 30000
- assertVisible:
    id: "auth.email"
- takeScreenshot: docs/releases/1.6.1/phase4f-screenshots/s10_auth_ready_bootstrap
YAML
if ! maestro --device "$UDID" test "$FLOW" 2>&1 | tee -a "$LOG"; then
  xcrun simctl io "$UDID" screenshot "$SHOT_DIR/bootstrap_auth_ready_fail_${STAMP}.png" 2>/dev/null || true
  log "QA_HARNESS_FAIL auth_not_ready"
  exit 10
fi
log "QA_HARNESS_PASS auth_ready no_fixed_sleep"
exit 0
