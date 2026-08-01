#!/usr/bin/env bash
# Refuse Phase 4F physical runs when installed/local artifact fingerprint ≠ expected HEAD.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EXPECTED_VERSION="${YT_EXPECTED_VERSION:-1.6.1}"
EXPECTED_BUILD="${YT_EXPECTED_BUILD:-113}"
EXPECTED_SHA="${YT_EXPECTED_GIT_SHA:-$(git rev-parse --short HEAD)}"
EXPECTED_CONFIG="${YT_EXPECTED_XCODE_CONFIG:-Release-Staging}"
STAGING_HOST="zleojeqkzizeyerhjpur.supabase.co"
PROD_HOST="izzrlsgumyabdvlmwlwn.supabase.co"
DD_PATH="${YT_RS113_DERIVED_DATA:-$ROOT/build/DerivedData-yt3-qa-head}"
APP="${YT_RS113_APP:-$DD_PATH/Build/Products/Release-Staging-iphoneos/YouTrader.app}"
FP_JSON="${YT_RS113_FINGERPRINT:-$DD_PATH/Build/Products/Release-Staging-iphoneos/YouTrader.build-fingerprint.json}"
TOKEN="YT_BUILD_FP_v1:${EXPECTED_SHA}:${EXPECTED_BUILD}:${EXPECTED_CONFIG}"

die() { echo "error: $*" >&2; exit 26; }

[[ -d "$APP" ]] || die "fresh RS app missing: $APP — run scripts/qa/build-release-staging-113-device.sh"
[[ -f "$APP/main.jsbundle" ]] || die "embedded main.jsbundle missing"
[[ -f "$FP_JSON" ]] || die "fingerprint sidecar missing: $FP_JSON"

ver="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Info.plist")"
short="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Info.plist")"
[[ "$ver" == "$EXPECTED_BUILD" ]] || die "build=$ver expected=$EXPECTED_BUILD"
[[ "$short" == "$EXPECTED_VERSION" ]] || die "version=$short expected=$EXPECTED_VERSION"

# Sidecar must match HEAD
python3 - <<PY
import json,sys
from pathlib import Path
fp=json.loads(Path("$FP_JSON").read_text())
exp_sha="$EXPECTED_SHA"
exp_build="$EXPECTED_BUILD"
exp_cfg="$EXPECTED_CONFIG"
errs=[]
if fp.get("gitSha")!=exp_sha: errs.append(f"gitSha={fp.get('gitSha')} expected={exp_sha}")
if str(fp.get("buildNumber"))!=exp_build: errs.append(f"buildNumber={fp.get('buildNumber')}")
if fp.get("xcodeConfiguration")!=exp_cfg: errs.append(f"config={fp.get('xcodeConfiguration')}")
if fp.get("searchToken")!="$TOKEN": errs.append(f"token={fp.get('searchToken')}")
if errs:
  print("fingerprint_mismatch:"+" | ".join(errs)); sys.exit(26)
print("sidecar_ok", fp.get("searchToken"))
PY

# Bundle must embed fingerprint parts + staging host + nav-era markers.
# Note: Hermes may split the search token; require parts separately.
# Production host *marker* may appear (fail-closed guard in appConfig) — forbid full production URL only.
python3 - <<PY
from pathlib import Path
b=Path("$APP/main.jsbundle").read_bytes()
need=[
 (b"YT_BUILD_FP_v1:", "fingerprint_prefix"),
 (b"$EXPECTED_SHA", "git_sha"),
 (b"YouTraderSafeArea", "safe_area_fix"),
 (b"$STAGING_HOST", "staging_host"),
 (b"Developer Diagnostics", "developer_diagnostics"),
 (b"embedded-main.jsbundle", "bundle_marker"),
]
forbid=[
 (b"https://$PROD_HOST", "production_supabase_url"),
]
ok_qa = b.find(b"reset-fresh")>=0 or b.find(b"youtrader://qa")>=0
for needle,label in need:
  if b.find(needle)<0:
    raise SystemExit(f"missing:{label}")
for needle,label in forbid:
  if b.find(needle)>=0:
    raise SystemExit(f"forbidden:{label}")
if not ok_qa:
  raise SystemExit("missing:qa_reset_deeplink")
print("jsbundle_ok bytes", len(b))
PY

if lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "warn: Metro ON (physical RS expects OFF)" >&2
else
  echo "metro_off=yes"
fi

echo "physical_build_fingerprint_preflight_ok token=$TOKEN app=$APP"
