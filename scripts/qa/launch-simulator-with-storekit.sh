#!/usr/bin/env bash
# Launch YouTrader Release-Staging on simulator WITH StoreKit Testing attached
# via the shared YouTrader-Staging scheme StoreKitConfigurationFileReference.
#
# Plain `simctl install` + `simctl launch` does NOT attach StoreKit.
# This helper builds Release-Staging, then runs an Xcode scheme Run so the
# LaunchAction StoreKit config is injected, then hands off to Maestro.
#
# Does not bump build number. Does not use production scheme. Metro OFF (embedded).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/qa/lib/resolve-jdk17.sh"
resolve_jdk17 >/dev/null || true

UDID="${YT_SIMULATOR_UDID:-71CCD561-2C03-4446-8354-DFCE17ED09A9}"
SCHEME="YouTrader-Staging"
CONFIGURATION="${YT_STOREKIT_CONFIGURATION:-Release-Staging}"
WORKSPACE="ios/YouTrader.xcworkspace"
DERIVED="${YT_STOREKIT_DERIVED:-$ROOT/build/DerivedData-storekit-rs}"
BUNDLE_ID="${YT_BUNDLE_ID:-com.youtrader.pro}"
STOREKIT="$ROOT/ios/YouTraderStaging.storekit"
SCHEME_FILE="$ROOT/ios/YouTrader.xcodeproj/xcshareddata/xcschemes/YouTrader-Staging.xcscheme"
ART="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-artifacts}"
mkdir -p "$ART" "$DERIVED"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$ART/storekit-rs-launch-$STAMP.log"

{
  echo "storekit_rs_launch_start stamp=$STAMP udid=$UDID configuration=$CONFIGURATION"
  echo "scheme=$SCHEME storekit_file=$STOREKIT"
} | tee "$LOG"

[[ -f "$STOREKIT" ]] || { echo "error: missing $STOREKIT" | tee -a "$LOG" >&2; exit 1; }
rg -q 'YouTraderStaging\.storekit' "$SCHEME_FILE" || {
  echo "error: staging scheme missing StoreKitConfigurationFileReference" | tee -a "$LOG" >&2
  exit 1
}

# Contract check: Weekly no trial / Monthly P3D / Annual P1W / exact product IDs
python3 - <<'PY' "$STOREKIT" | tee -a "$LOG"
import json,sys
sk=json.load(open(sys.argv[1]))
want={
  'youtrader_pro_weekly': ('P1W', None, '4.99'),
  'youtrader_pro_monthly': ('P1M', 'P3D', '12.99'),
  'youtrader_pro_yearly__': ('P1Y', 'P1W', '99.99'),
}
found={}
for g in sk.get('subscriptionGroups') or []:
  for s in g.get('subscriptions') or []:
    pid=s.get('productID')
    intro=(s.get('introductoryOffer') or {}).get('subscriptionPeriod')
    found[pid]=(s.get('recurringSubscriptionPeriod'), intro, str(s.get('displayPrice')))
for pid,exp in want.items():
  if pid not in found:
    raise SystemExit(f'missing_product {pid}')
  got=found[pid]
  if got[0]!=exp[0] or got[1]!=exp[1]:
    raise SystemExit(f'period_mismatch {pid} got={got} expected={exp}')
print('storekit_contract_ok', sorted(want))
PY

xcrun simctl bootstatus "$UDID" -b

echo "building $CONFIGURATION for simulator..." | tee -a "$LOG"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVED" \
  build 2>&1 | tee -a "$LOG" | tail -25

APP="$(find "$DERIVED/Build/Products" -path "*${CONFIGURATION}-iphonesimulator/YouTrader.app" -type d | head -1)"
if [[ -z "$APP" || ! -d "$APP" ]]; then
  APP="$(find "$DERIVED/Build/Products" -path '*iphonesimulator/YouTrader.app' -type d | head -1)"
fi
[[ -d "$APP" ]] || { echo "error: YouTrader.app missing under $DERIVED" | tee -a "$LOG" >&2; exit 1; }
echo "app=$APP" | tee -a "$LOG"
ver="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Info.plist")"
echo "bundle_version=$ver" | tee -a "$LOG"
[[ "$ver" == "113" ]] || echo "warn: expected build 113, got $ver" | tee -a "$LOG"
test -f "$APP/main.jsbundle" && echo "embedded_bundle=yes" | tee -a "$LOG"

xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl uninstall "$UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"

# Attach StoreKit by running the shared scheme from Xcode (LaunchAction reference).
# simctl launch alone cannot attach StoreKit Testing.
export YT_STOREKIT_WORKSPACE="$ROOT/ios/YouTrader.xcworkspace"
export YT_STOREKIT_SCHEME="$SCHEME"
export YT_STOREKIT_UDID="$UDID"
osascript <<'APPLESCRIPT' 2>&1 | tee -a "$LOG"
set ws to (system attribute "YT_STOREKIT_WORKSPACE")
tell application "Xcode"
  activate
  open POSIX file ws
end tell
delay 6
tell application "System Events"
  tell process "Xcode"
    set frontmost to true
    -- Prefer selecting scheme via menu if needed; ⌘R uses active scheme LaunchAction StoreKit.
    keystroke "r" using {command down}
  end tell
end tell
return "xcode_run_dispatched_storekit"
APPLESCRIPT

for i in $(seq 1 45); do
  if xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | rg -q 'YouTrader|com.youtrader'; then
    echo "app_signal attempt=$i" | tee -a "$LOG"
    break
  fi
  # Fallback: process list via simctl
  if xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data >/dev/null 2>&1; then
    if pgrep -f "YouTrader.app/YouTrader" >/dev/null 2>&1; then
      echo "app_running attempt=$i" | tee -a "$LOG"
      break
    fi
  fi
  sleep 2
done

# Also prove local StoreKit products via YTStoreKitQA unit tests (explicit .storekit)
set +e
xcodebuild test \
  -project ios/YTStoreKitQA/YTStoreKitQA.xcodeproj \
  -scheme YTStoreKitQA \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$ROOT/build/DerivedData-storekit-qa-live" \
  2>&1 | tee -a "$LOG" | tail -30
SK_RC=${PIPESTATUS[0]}
set -e
echo "ytstorekitqa_exit=$SK_RC" | tee -a "$LOG"

echo "storekit_rs_launch_done"
echo "next=YT_SKIP_EMAIL_PREFLIGHT=1 bash scripts/qa/run-maestro-staging.sh .maestro/yt3/phase4f_rs_onboarding_to_paywall.yaml --device $UDID"
exit 0
