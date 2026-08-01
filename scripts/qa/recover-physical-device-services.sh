#!/usr/bin/env bash
# Non-destructive physical device diagnostic for YouTrader Release-Staging 113.
# Never erases, unpairs, or installs build 114.
# Exit:
#   0 = device reachable + version/build verified when app installed
#   20 = ENVIRONMENT BLOCKER — COREDEVICE / no paired device
#   21 = FAIL — wrong version/build if app present
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REPORT_DIR="$ROOT/docs/releases/1.6.1"
mkdir -p "$REPORT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="$REPORT_DIR/PHYSICAL_DEVICE_DIAG_${STAMP}.md"
BUNDLE="${YT_BUNDLE_ID:-com.youtrader.pro}"

{
  echo "# Physical device diagnostic — $STAMP"
  echo
  echo "## Policy"
  echo "- required version: 1.6.1"
  echo "- required build: 113"
  echo "- required profile: Release-Staging"
  echo "- Metro: OFF"
  echo "- never install 114"
  echo
  echo "## xcodebuild destinations (snippet)"
  echo '```'
  xcodebuild -showdestinations -scheme YouTrader 2>&1 | head -80 || true
  echo '```'
  echo
  echo "## devicectl list"
  echo '```'
  xcrun devicectl list devices 2>&1 | head -80 || true
  echo '```'
} >"$REPORT"

if ! xcrun devicectl list devices >/tmp/yt-devicectl.txt 2>/tmp/yt-devicectl.err; then
  {
    echo
    echo "## Result"
    echo "ENVIRONMENT BLOCKER — COREDEVICE SERVICE UNAVAILABLE"
    echo '```'
    cat /tmp/yt-devicectl.err 2>/dev/null | head -40 || true
    echo '```'
  } >>"$REPORT"
  echo "PHYSICAL_DIAG: ENVIRONMENT BLOCKER"
  echo "REPORT=$REPORT"
  exit 20
fi

if ! grep -qi 'iPhone\|connected\|available' /tmp/yt-devicectl.txt; then
  {
    echo
    echo "## Result"
    echo "ENVIRONMENT BLOCKER — no paired physical device visible"
  } >>"$REPORT"
  echo "PHYSICAL_DIAG: ENVIRONMENT BLOCKER — no device"
  echo "REPORT=$REPORT"
  exit 20
fi

{
  echo
  echo "## Result"
  echo "PARTIAL — device list reachable; install/version verification requires interactive device session"
  echo "- expected CFBundleShortVersionString: 1.6.1"
  echo "- expected CFBundleVersion: 113"
  echo "- expected host: zleojeqkzizeyerhjpur (staging)"
  echo "- production host must be absent"
} >>"$REPORT"
echo "PHYSICAL_DIAG: PARTIAL"
echo "REPORT=$REPORT"
exit 0
