#!/usr/bin/env bash
# Stats + More navigation screenshot matrix (simulator).
# Requires booted simulator with YouTrader + deep links.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${YT_QA_STATS_SHOT_DIR:-$ROOT/docs/releases/1.6.1/stats-redesign-evidence}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT"
UDID="${1:-}"
DEVICE_LABEL="${2:-sim}"
BUNDLE_ID="${YT_QA_BUNDLE_ID:-com.youtrader.pro}"

if [[ -z "$UDID" ]]; then
  UDID="$(xcrun simctl list devices booted | awk -F '[()]' '/iPhone/{print $2; exit}')"
fi
if [[ -z "$UDID" ]]; then
  echo "error: no booted simulator" >&2
  exit 2
fi

shot() {
  local name="$1"
  local path="$OUT/${DEVICE_LABEL}_${name}_${STAMP}.png"
  xcrun simctl io "$UDID" screenshot "$path"
  echo "shot=$path"
}

echo "udid=$UDID label=$DEVICE_LABEL out=$OUT"

# Allowlisted four-tab (Prop Pass visible) — journal first
xcrun simctl openurl "$UDID" "youtrader://qa/prop-pass-state?mode=healthy" || true
sleep 2
xcrun simctl openurl "$UDID" "youtrader://qa/tab?id=journal" || true
sleep 2
shot "nav_allowlisted_journal"

xcrun simctl openurl "$UDID" "youtrader://qa/tab?id=stats" || true
sleep 2.5
shot "stats_populated_or_empty"

xcrun simctl openurl "$UDID" "youtrader://qa/tab?id=more" || true
sleep 2
shot "more_hub"

xcrun simctl openurl "$UDID" "youtrader://qa/tab?id=calendar" || true
sleep 2
shot "calendar_from_more_or_deeplink"

# Non-allowlisted three-tab
xcrun simctl openurl "$UDID" "youtrader://qa/prop-pass-state?mode=non_allowlisted" || true
sleep 2
xcrun simctl openurl "$UDID" "youtrader://qa/tab?id=journal" || true
sleep 2
shot "nav_non_allowlisted"

xcrun simctl openurl "$UDID" "youtrader://qa/tab?id=stats" || true
sleep 2
shot "stats_non_allowlisted"

echo "matrix_done stamp=$STAMP"
