#!/usr/bin/env bash
# Launch YouTrader-Staging (Debug-Staging) on simulator WITH StoreKit Testing
# injected via the shared scheme's StoreKitConfigurationFileReference.
# Production scheme is never used. Build number is not changed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

UDID="${YT_SIMULATOR_UDID:-A6BA9300-8C72-44CE-9CDD-19E096070626}"
SCHEME="YouTrader-Staging"
WORKSPACE="ios/YouTrader.xcworkspace"
DERIVED="${YT_STOREKIT_DERIVED:-$ROOT/build/DerivedData-storekit-staging}"
BUNDLE_ID="${YT_BUNDLE_ID:-com.youtrader.pro}"
STOREKIT="$ROOT/ios/YouTraderStaging.storekit"
SCHEME_FILE="$ROOT/ios/YouTrader.xcodeproj/xcshareddata/xcschemes/YouTrader-Staging.xcscheme"
ART="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-artifacts}"
mkdir -p "$ART" "$DERIVED"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$ART/storekit-launch-$STAMP.log"

{
  echo "storekit_launch_start stamp=$STAMP udid=$UDID"
  echo "scheme=$SCHEME"
  echo "storekit_file=$STOREKIT"
} | tee "$LOG"

if [[ ! -f "$STOREKIT" ]]; then
  echo "error: missing $STOREKIT" | tee -a "$LOG" >&2
  exit 1
fi
if ! rg -q 'YouTraderStaging\.storekit' "$SCHEME_FILE"; then
  echo "error: staging scheme missing StoreKitConfigurationFileReference" | tee -a "$LOG" >&2
  exit 1
fi
# Refuse production scheme attachment
if rg -q 'StoreKitConfigurationFileReference' "$ROOT/ios/YouTrader.xcodeproj/xcshareddata/xcschemes/YouTrader.xcscheme" 2>/dev/null; then
  echo "error: production YouTrader.xcscheme unexpectedly has StoreKit — refuse" | tee -a "$LOG" >&2
  exit 2
fi

# Validate product IDs vs staging env
python3 - <<'PY' "$STOREKIT" "$ROOT/ios/.xcode.env.staging" | tee -a "$LOG"
import json, re, sys
sk=json.load(open(sys.argv[1]))
env=open(sys.argv[2]).read()
monthly=re.search(r'EXPO_PUBLIC_REVENUECAT_IOS_PRODUCT_ID=(\S+)', env)
yearly=re.search(r'EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID=(\S+)', env)
ent=re.search(r'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=(.+)', env)
m=monthly.group(1).strip() if monthly else ''
y=yearly.group(1).strip() if yearly else ''
e=(ent.group(1).strip() if ent else '')
ids=[]
for g in sk.get('subscriptionGroups') or []:
  for s in g.get('subscriptions') or []:
    ids.append((s.get('productID'), s.get('displayPrice'), s.get('recurringSubscriptionPeriod')))
print('storekit_products', ids)
print('env_monthly', m, 'env_yearly', y, 'env_entitlement', e)
have={i[0] for i in ids}
missing=[x for x in (m,y) if x and x not in have]
if missing:
  raise SystemExit(f'product_id_mismatch missing_in_storekit={missing}')
print('product_id_match=ok')
PY

xcrun simctl bootstatus "$UDID" -b

echo "building Debug-Staging for simulator..." | tee -a "$LOG"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Debug-Staging \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVED" \
  -quiet \
  build 2>&1 | tee -a "$LOG" | tail -30

APP="$(find "$DERIVED/Build/Products" -path '*iphonesimulator/YouTrader.app' -type d | head -1)"
if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "error: YouTrader.app not found under $DERIVED" | tee -a "$LOG" >&2
  exit 1
fi
echo "app=$APP" | tee -a "$LOG"
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Info.plist" | tee -a "$LOG"
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist" | tee -a "$LOG"

xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"

# Launch via Xcode so scheme StoreKitConfigurationFileReference is injected.
# simctl launch alone does NOT attach StoreKit Testing.
export YT_STOREKIT_WORKSPACE="$ROOT/ios/YouTrader.xcworkspace"
export YT_STOREKIT_SCHEME="$SCHEME"
export YT_STOREKIT_UDID="$UDID"
osascript <<'APPLESCRIPT' 2>&1 | tee -a "$LOG"
set ws to (system attribute "YT_STOREKIT_WORKSPACE")
set sch to (system attribute "YT_STOREKIT_SCHEME")
tell application "Xcode"
  activate
  open POSIX file ws
end tell
delay 4
tell application "System Events"
  tell process "Xcode"
    set frontmost to true
    -- Product > Scheme > YouTrader-Staging is assumed selected via workspace state;
    -- force Run (⌘R) which uses LaunchAction StoreKit config.
    keystroke "r" using {command down}
  end tell
end tell
return "xcode_run_dispatched"
APPLESCRIPT

# Wait for app process
for i in $(seq 1 60); do
  if xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data >/dev/null 2>&1; then
    if pgrep -f "YouTrader.app/YouTrader" >/dev/null 2>&1; then
      echo "app_running attempt=$i" | tee -a "$LOG"
      break
    fi
  fi
  sleep 2
done

echo "storekit_launch_ok note=Xcode_Run_with_scheme_StoreKit" | tee -a "$LOG"
echo "next=run Maestro purchase flows against simulator with StoreKit session"
