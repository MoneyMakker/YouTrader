#!/usr/bin/env bash
# Prop Pass redesign screenshot matrix (simulator).
# Requires: booted simulator with YouTrader staging app + Metro OR embedded bundle,
# deep-link support for youtrader://qa/prop-pass-state?mode=…
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${YT_QA_PROP_PASS_SHOT_DIR:-$ROOT/docs/releases/1.6.1/prop-pass-redesign-evidence}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT"
UDID="${1:-}"
DEVICE_LABEL="${2:-sim}"

if [[ -z "$UDID" ]]; then
  UDID="$(xcrun simctl list devices booted | awk -F '[()]' '/iPhone/{print $2; exit}')"
fi
if [[ -z "$UDID" ]]; then
  echo "error: no booted simulator" >&2
  exit 2
fi

BUNDLE_ID="${YT_QA_BUNDLE_ID:-com.youtrader.pro}"
MODES=(
  healthy
  caution
  at_risk
  insufficient_data
  no_account
  stale
  offline_cached
  backend_unavailable
  populated_plan
  insights_current
  insights_failed
  non_allowlisted
)

echo "udid=$UDID label=$DEVICE_LABEL out=$OUT"

# Also capture More + five-tab after healthy
for mode in "${MODES[@]}"; do
  echo "mode=$mode"
  xcrun simctl openurl "$UDID" "youtrader://qa/prop-pass-state?mode=${mode}" || true
  sleep 2.5
  shot="$OUT/${DEVICE_LABEL}_${mode}_${STAMP}.png"
  xcrun simctl io "$UDID" screenshot "$shot"
  echo "shot=$shot"
done

xcrun simctl openurl "$UDID" "youtrader://qa/prop-pass-state?mode=healthy" || true
sleep 1.5
xcrun simctl openurl "$UDID" "youtrader://qa/tab?id=more" || true
sleep 2
xcrun simctl io "$UDID" screenshot "$OUT/${DEVICE_LABEL}_more_${STAMP}.png"
echo "shot=$OUT/${DEVICE_LABEL}_more_${STAMP}.png"

xcrun simctl openurl "$UDID" "youtrader://qa/tab?id=journal" || true
sleep 1.5
xcrun simctl io "$UDID" screenshot "$OUT/${DEVICE_LABEL}_five_tab_journal_${STAMP}.png"

# Non-allowlisted nav proof
xcrun simctl openurl "$UDID" "youtrader://qa/prop-pass-state?mode=non_allowlisted" || true
sleep 2
xcrun simctl io "$UDID" screenshot "$OUT/${DEVICE_LABEL}_nav_no_prop_pass_${STAMP}.png"

echo "matrix_done stamp=$STAMP"
