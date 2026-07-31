#!/usr/bin/env bash
# Repeatable physical-device harness for YouTrader Release-Staging build 113.
# Metro OFF. Does not bump build number. Staging scheme only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DEVICE_ID="${YT_PHYSICAL_DEVICE_ID:-6FCFF771-7154-5CC0-BC29-858A3C376CAF}"
BUNDLE_ID="${YT_BUNDLE_ID:-com.youtrader.pro}"
APP_CANDIDATES=(
  "$ROOT/build/DerivedData-yt3-qa/Build/Products/Release-Staging-iphoneos/YouTrader.app"
  "$ROOT/build/DerivedData-ReleaseStaging/Build/Products/Release-Staging-iphoneos/YouTrader.app"
)
ART="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-artifacts}"
mkdir -p "$ART" "$ROOT/docs/releases/1.6.1/phase4f-screenshots"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$ART/physical-harness-$STAMP.log"
MODE="${1:-status}" # status|install|launch|terminate|relaunch|cycle

{
  echo "physical_harness mode=$MODE device=$DEVICE_ID stamp=$STAMP"
} | tee "$LOG"

find_app() {
  local c
  for c in "${APP_CANDIDATES[@]}"; do
    if [[ -d "$c" ]]; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

require_device() {
  xcrun devicectl list devices 2>&1 | tee -a "$LOG" | rg -q "$DEVICE_ID" || {
    echo "error: device $DEVICE_ID not listed" | tee -a "$LOG" >&2
    exit 2
  }
  xcrun devicectl device info details --device "$DEVICE_ID" 2>&1 | tee -a "$LOG" | head -40
}

cmd_status() {
  require_device
  xcrun devicectl device info apps --device "$DEVICE_ID" 2>&1 | tee -a "$LOG" | rg -i 'youtrader|com.youtrader' || true
  xcrun devicectl device info processes --device "$DEVICE_ID" 2>&1 | tee -a "$LOG" | rg -i 'YouTrader|com.youtrader' || echo 'process_not_listed'
}

cmd_install() {
  require_device
  local app
  app="$(find_app)" || { echo "error: Release-Staging app missing — build first without bumping version" | tee -a "$LOG" >&2; exit 3; }
  echo "app=$app" | tee -a "$LOG"
  /usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$app/Info.plist" | tee -a "$LOG"
  /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Info.plist" | tee -a "$LOG"
  local ver
  ver="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$app/Info.plist")"
  if [[ "$ver" != "113" ]]; then
    echo "error: refusing non-113 build ($ver)" | tee -a "$LOG" >&2
    exit 4
  fi
  xcrun devicectl device install app --device "$DEVICE_ID" "$app" 2>&1 | tee -a "$LOG"
}

cmd_launch() {
  require_device
  xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID" 2>&1 | tee -a "$LOG"
}

cmd_terminate() {
  require_device
  # Best-effort terminate via process signal if supported
  if xcrun devicectl device process terminate --help >/dev/null 2>&1; then
    xcrun devicectl device process terminate --device "$DEVICE_ID" "$BUNDLE_ID" 2>&1 | tee -a "$LOG" || true
  else
    # Fallback: launch with terminate-existing if available
    xcrun devicectl device process launch --help 2>&1 | tee -a "$LOG" | head -40
    xcrun devicectl device process launch --terminate-existing --device "$DEVICE_ID" "$BUNDLE_ID" 2>&1 | tee -a "$LOG" || true
    sleep 1
    # If terminate-existing relaunched, try to kill by pid from process list
    echo "terminate_best_effort" | tee -a "$LOG"
  fi
}

cmd_relaunch() {
  cmd_terminate
  sleep 2
  cmd_launch
}

cmd_cycle() {
  cmd_install
  cmd_launch
  sleep 3
  cmd_status
  cmd_relaunch
  sleep 3
  cmd_status
  echo "physical_cycle_ok" | tee -a "$LOG"
}

case "$MODE" in
  status) cmd_status ;;
  install) cmd_install ;;
  launch) cmd_launch ;;
  terminate) cmd_terminate ;;
  relaunch) cmd_relaunch ;;
  cycle) cmd_cycle ;;
  *) echo "usage: $0 status|install|launch|terminate|relaunch|cycle" >&2; exit 64 ;;
esac
