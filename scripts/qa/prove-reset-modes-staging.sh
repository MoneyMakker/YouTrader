#!/usr/bin/env bash
# Prove all five staging reset modes without fixed sleep as correctness.
# Deep links via simctl openurl (Maestro openLink stays on Main / harness flake).
# Contract: openurl → poll qa.reset.complete → stopApp → cold route assert.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
UDID="${YT_SIMULATOR_UDID:-A6BA9300-8C72-44CE-9CDD-19E096070626}"
BUNDLE="${YT_BUNDLE_ID:-com.youtrader.pro}"
ART_DIR="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-logs}"
SHOT_DIR="${YT_QA_SCREENSHOT_DIR:-$ROOT/docs/releases/1.6.1/phase4f-screenshots}"
FLOW_DIR="$ROOT/.maestro/yt3"
mkdir -p "$ART_DIR" "$SHOT_DIR" "$FLOW_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$ART_DIR/prove_reset_modes_s11_${STAMP}.log"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"
log() { echo "$*" | tee -a "$LOG"; }

wait_a11y() {
  local needle="$1"
  local timeout_s="${2:-90}"
  local flow="$FLOW_DIR/_wait_a11y_tmp.yaml"
  cat > "$flow" <<YAML
appId: com.youtrader.pro
---
- launchApp:
    clearState: false
- extendedWaitUntil:
    visible:
      id: "${needle}"
    timeout: $((timeout_s * 1000))
- assertVisible:
    id: "${needle}"
YAML
  maestro --device "$UDID" test "$flow" 2>&1 | tee -a "$LOG"
}

wait_text() {
  local needle="$1"
  local timeout_s="${2:-90}"
  local flow="$FLOW_DIR/_wait_text_tmp.yaml"
  cat > "$flow" <<YAML
appId: com.youtrader.pro
---
- launchApp:
    clearState: false
- extendedWaitUntil:
    visible: "${needle}"
    timeout: $((timeout_s * 1000))
- assertVisible: "${needle}"
YAML
  maestro --device "$UDID" test "$flow" 2>&1 | tee -a "$LOG"
}

prove_mode() {
  local mode="$1"
  local link="$2"
  local cold_kind="$3" # a11y|text|returning-allow|returning-deny
  local cold_needle="$4"
  log "=== MODE $mode link=$link ==="
  xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null
  # Boot readiness only — not reset correctness.
  local boot=0
  while (( boot < 30 )); do
    if xcrun simctl spawn "$UDID" launchctl print system 2>/dev/null | rg -q .; then
      :
    fi
    # Prefer Metro/app ready by probing process
    if xcrun simctl spawn "$UDID" launchctl procinfo "$(xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | awk -v b="$BUNDLE" '$3 ~ b {print $1; exit}')" >/dev/null 2>&1; then
      break
    fi
    sleep 1
    boot=$((boot + 1))
  done
  sleep 2
  xcrun simctl openurl "$UDID" "$link" 2>&1 | tee -a "$LOG"
  xcrun simctl openurl "$UDID" "$link" 2>&1 | tee -a "$LOG"
  if ! wait_a11y "qa.reset.complete" 90; then
    xcrun simctl io "$UDID" screenshot "$SHOT_DIR/s11_reset_${mode}_no_complete_${STAMP}.png" 2>/dev/null || true
    log "FAIL mode=$mode reset_complete not reached"
    return 1
  fi
  xcrun simctl io "$UDID" screenshot "$SHOT_DIR/s11_reset_${mode}_complete.png" 2>/dev/null || true
  log "PASS reset_complete mode=$mode"
  xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null
  sleep 2
  case "$cold_kind" in
    a11y)
      if ! wait_a11y "$cold_needle" 90; then
        xcrun simctl io "$UDID" screenshot "$SHOT_DIR/s11_reset_${mode}_cold_FAIL_${STAMP}.png" 2>/dev/null || true
        log "FAIL mode=$mode cold a11y=$cold_needle"
        return 1
      fi
      ;;
    text)
      if ! wait_text "$cold_needle" 90; then
        xcrun simctl io "$UDID" screenshot "$SHOT_DIR/s11_reset_${mode}_cold_FAIL_${STAMP}.png" 2>/dev/null || true
        log "FAIL mode=$mode cold text=$cold_needle"
        return 1
      fi
      ;;
    returning-allow)
      xcrun simctl openurl "$UDID" "youtrader://qa/email-login?role=allow"
      xcrun simctl openurl "$UDID" "youtrader://qa/email-login?role=allow"
      local flow="$FLOW_DIR/_prove_cold_returning_allow.yaml"
      cat > "$flow" <<'YAML'
appId: com.youtrader.pro
---
- launchApp:
    clearState: false
- repeat:
    times: 12
    commands:
      - runFlow:
          when:
            visible: "Dismiss"
          commands:
            - tapOn: "Dismiss"
      - runFlow:
          when:
            visible: "Unlock Your Trading Edge"
          commands:
            - tapOn:
                id: "acquisition-paywall-close"
- extendedWaitUntil:
    visible: "Journal"
    timeout: 120000
- assertVisible: "Journal"
- extendedWaitUntil:
    visible: "Prop Pass"
    timeout: 30000
- assertVisible: "Prop Pass"
YAML
      if ! maestro --device "$UDID" test "$flow" 2>&1 | tee -a "$LOG"; then
        xcrun simctl io "$UDID" screenshot "$SHOT_DIR/s11_reset_${mode}_cold_FAIL_${STAMP}.png" 2>/dev/null || true
        log "FAIL mode=$mode cold returning-allow"
        return 1
      fi
      ;;
    returning-deny)
      xcrun simctl openurl "$UDID" "youtrader://qa/email-login?role=deny"
      xcrun simctl openurl "$UDID" "youtrader://qa/email-login?role=deny"
      local flow="$FLOW_DIR/_prove_cold_returning_deny.yaml"
      cat > "$flow" <<'YAML'
appId: com.youtrader.pro
---
- launchApp:
    clearState: false
- repeat:
    times: 12
    commands:
      - runFlow:
          when:
            visible: "Dismiss"
          commands:
            - tapOn: "Dismiss"
      - runFlow:
          when:
            visible: "Unlock Your Trading Edge"
          commands:
            - tapOn:
                id: "acquisition-paywall-close"
- extendedWaitUntil:
    visible: "Journal"
    timeout: 120000
- assertVisible: "Journal"
- assertVisible: "Stats"
YAML
      if ! maestro --device "$UDID" test "$flow" 2>&1 | tee -a "$LOG"; then
        xcrun simctl io "$UDID" screenshot "$SHOT_DIR/s11_reset_${mode}_cold_FAIL_${STAMP}.png" 2>/dev/null || true
        log "FAIL mode=$mode cold returning-deny"
        return 1
      fi
      ;;
  esac
  xcrun simctl io "$UDID" screenshot "$SHOT_DIR/s11_reset_${mode}_cold.png" 2>/dev/null || true
  log "PASS mode=$mode reset_complete+cold"
  return 0
}

FAILS=0
prove_mode fresh "youtrader://qa/reset-fresh" a11y "product-onboarding-continue" || FAILS=$((FAILS + 1))
prove_mode paywall "youtrader://qa/reset-paywall" text "Unlock Your Trading Edge" || FAILS=$((FAILS + 1))
prove_mode auth "youtrader://qa/reset-auth" a11y "auth.screen" || FAILS=$((FAILS + 1))
prove_mode returning-allow "youtrader://qa/reset-returning-allow" returning-allow "" || FAILS=$((FAILS + 1))
prove_mode returning-deny "youtrader://qa/reset-returning-deny" returning-deny "" || FAILS=$((FAILS + 1))

log "prove_reset_modes_done fails=$FAILS stamp=$STAMP"
[[ "$FAILS" -eq 0 ]]
