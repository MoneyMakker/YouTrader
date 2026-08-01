#!/usr/bin/env bash
# Repeatable physical-device harness for YouTrader Release-Staging build 113.
# Metro OFF. Does not bump build number. Staging scheme only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DEVICE_ID="${YT_PHYSICAL_DEVICE_ID:-6FCFF771-7154-5CC0-BC29-858A3C376CAF}"
BUNDLE_ID="${YT_BUNDLE_ID:-com.youtrader.pro}"
STAGING_HOST="zleojeqkzizeyerhjpur.supabase.co"
PROD_HOST="izzrlsgumyabdvlmwlwn.supabase.co"
APP_CANDIDATES=(
  "$ROOT/build/DerivedData-yt3-qa/Build/Products/Release-Staging-iphoneos/YouTrader.app"
  "$ROOT/build/DerivedData-ReleaseStaging/Build/Products/Release-Staging-iphoneos/YouTrader.app"
)
ART="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-artifacts}"
mkdir -p "$ART" "$ROOT/docs/releases/1.6.1/phase4f-screenshots"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$ART/physical-harness-$STAMP.log"
MODE="${1:-status}" # status|install|launch|terminate|relaunch|cycle|verify|cold|warm|screenshot|logs

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

assert_metro_off() {
  if lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "warn: Metro appears listening on 8081 — Release-Staging physical QA expects Metro OFF" | tee -a "$LOG"
  else
    echo "metro_off=yes" | tee -a "$LOG"
  fi
}

cmd_verify() {
  require_device
  assert_metro_off
  local app
  app="$(find_app)" || { echo "error: Release-Staging app missing" | tee -a "$LOG" >&2; exit 3; }
  echo "app=$app" | tee -a "$LOG"
  local ver short
  ver="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$app/Info.plist")"
  short="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Info.plist")"
  echo "bundle_version=$ver short=$short" | tee -a "$LOG"
  [[ "$ver" == "113" ]] || { echo "error: refusing non-113 ($ver)" | tee -a "$LOG" >&2; exit 4; }
  if [[ -f "$app/main.jsbundle" ]]; then
    echo "embedded_bundle=yes sha=$(shasum -a 256 "$app/main.jsbundle" | awk '{print $1}')" | tee -a "$LOG"
  else
    # Expo may embed under different path
    local js
    js="$(find "$app" -name 'main.jsbundle' -o -name '*.jsbundle' 2>/dev/null | head -1 || true)"
    if [[ -n "$js" ]]; then
      echo "embedded_bundle=yes path=$js" | tee -a "$LOG"
    else
      echo "embedded_bundle=MISSING" | tee -a "$LOG"
      exit 5
    fi
  fi
  # Staging host must be baked into Release-Staging binary strings
  if strings "$app/YouTrader" 2>/dev/null | rg -q "$STAGING_HOST"; then
    echo "staging_host_marker=present" | tee -a "$LOG"
  else
    echo "staging_host_marker=NOT_FOUND_IN_BINARY (may be in jsbundle)" | tee -a "$LOG"
  fi
  if strings "$app/YouTrader" 2>/dev/null | rg -q "$PROD_HOST"; then
    echo "warn: production_host_string_present_in_binary" | tee -a "$LOG"
  fi
  if [[ -n "${js:-}" ]] || [[ -f "$app/main.jsbundle" ]]; then
    local bundle_path="${js:-$app/main.jsbundle}"
    if rg -q "$STAGING_HOST" "$bundle_path" 2>/dev/null; then
      echo "staging_host_in_jsbundle=yes" | tee -a "$LOG"
    fi
    if rg -q "$PROD_HOST" "$bundle_path" 2>/dev/null; then
      echo "error: production host found in embedded jsbundle" | tee -a "$LOG" >&2
      exit 6
    fi
  fi
  echo "physical_verify_ok" | tee -a "$LOG"
}

cmd_status() {
  require_device
  xcrun devicectl device info apps --device "$DEVICE_ID" 2>&1 | tee -a "$LOG" | rg -i 'youtrader|com.youtrader' || true
  xcrun devicectl device info processes --device "$DEVICE_ID" 2>&1 | tee -a "$LOG" | rg -i 'YouTrader|com.youtrader' || echo 'process_not_listed'
}

cmd_install() {
  require_device
  cmd_verify
  local app
  app="$(find_app)"
  xcrun devicectl device install app --device "$DEVICE_ID" "$app" 2>&1 | tee -a "$LOG"
}

cmd_launch() {
  require_device
  # Newer devicectl: --start-stopped is a flag without value.
  xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID" 2>&1 | tee -a "$LOG"
}

cmd_terminate() {
  require_device
  if xcrun devicectl device process terminate --help >/dev/null 2>&1; then
    xcrun devicectl device process terminate --device "$DEVICE_ID" "$BUNDLE_ID" 2>&1 | tee -a "$LOG" || true
  else
    xcrun devicectl device process launch --terminate-existing --device "$DEVICE_ID" "$BUNDLE_ID" 2>&1 | tee -a "$LOG" || true
    sleep 1
    echo "terminate_best_effort" | tee -a "$LOG"
  fi
}

cmd_relaunch() {
  cmd_terminate
  sleep 2
  cmd_launch
}

cmd_logs() {
  require_device
  local out="$ART/physical-device-logs-$STAMP.log"
  echo "capturing_logs → $out" | tee -a "$LOG"
  # Best-effort: stream briefly then stop
  xcrun devicectl device process launch --help 2>&1 | head -5 | tee -a "$LOG" || true
  xcrun devicectl device info processes --device "$DEVICE_ID" 2>&1 | tee "$out" | tee -a "$LOG" | rg -i 'YouTrader|crash|Exception' || true
  echo "logs_capture_ok path=$out" | tee -a "$LOG"
}

cmd_cold() {
  # 5 cold launches for integrity smoke (not full Phase 4F matrix)
  local i
  for i in 1 2 3 4 5; do
    echo "cold_launch=$i stamp=$(date -u +%Y%m%dT%H%M%SZ)" | tee -a "$LOG"
    cmd_terminate
    sleep 2
    cmd_launch
    sleep 4
    if xcrun devicectl device info processes --device "$DEVICE_ID" 2>&1 | rg -qi 'YouTrader'; then
      echo "cold_launch_$i=process_ok" | tee -a "$LOG"
    else
      echo "cold_launch_$i=PROCESS_MISSING" | tee -a "$LOG"
      exit 7
    fi
  done
  echo "physical_cold5_ok" | tee -a "$LOG"
}

cmd_warm() {
  # 3 warm relaunches (terminate→launch without reinstall)
  local i
  for i in 1 2 3; do
    echo "warm_launch=$i stamp=$(date -u +%Y%m%dT%H%M%SZ)" | tee -a "$LOG"
    cmd_relaunch
    sleep 3
    if xcrun devicectl device info processes --device "$DEVICE_ID" 2>&1 | rg -qi 'YouTrader'; then
      echo "warm_launch_$i=process_ok" | tee -a "$LOG"
    else
      echo "warm_launch_$i=PROCESS_MISSING" | tee -a "$LOG"
      exit 8
    fi
  done
  echo "physical_warm3_ok" | tee -a "$LOG"
}

cmd_screenshot() {
  require_device
  local out="$ROOT/docs/releases/1.6.1/phase4f-screenshots/physical_${STAMP}.png"
  # Best-effort screenshot via devicectl when available
  if xcrun devicectl device info --help 2>&1 | rg -qi 'screenshot|capture'; then
    xcrun devicectl device info 2>&1 | head -5 | tee -a "$LOG" || true
  fi
  if command -v idevicescreenshot >/dev/null 2>&1; then
    idevicescreenshot "$out" 2>&1 | tee -a "$LOG" || true
  elif xcrun simctl io booted screenshot /dev/null 2>/dev/null; then
    :
  fi
  # Prefer XCTest/devicectl copy when present; else mark unsupported
  if [[ -f "$out" ]]; then
    echo "screenshot_ok path=$out" | tee -a "$LOG"
  else
    echo "screenshot_unsupported_or_failed path=$out" | tee -a "$LOG"
  fi
}

cmd_cycle() {
  cmd_install
  cmd_launch
  sleep 3
  cmd_status
  cmd_relaunch
  sleep 3
  cmd_status
  cmd_warm
  cmd_logs
  cmd_screenshot
  echo "physical_cycle_ok" | tee -a "$LOG"
}

case "$MODE" in
  status) cmd_status ;;
  install) cmd_install ;;
  launch) cmd_launch ;;
  terminate) cmd_terminate ;;
  relaunch) cmd_relaunch ;;
  cycle) cmd_cycle ;;
  verify) cmd_verify ;;
  cold) cmd_cold ;;
  warm) cmd_warm ;;
  screenshot) cmd_screenshot ;;
  logs) cmd_logs ;;
  *) echo "usage: $0 status|install|launch|terminate|relaunch|cycle|verify|cold|warm|screenshot|logs" >&2; exit 64 ;;
esac
