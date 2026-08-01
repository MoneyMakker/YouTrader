#!/usr/bin/env bash
# Bounded, non-destructive Apple Simulator services recovery.
# Never erases all simulators. Never uses sudo.
# Exit codes:
#   0 = list/bootstatus healthy
#   10 = ENVIRONMENT BLOCKER — CORESIMULATOR SERVICE UNAVAILABLE
#   11 = partial recovery (list works, selected boot failed)
#   12 = disk pressure
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REPORT_DIR="$ROOT/docs/releases/1.6.1"
mkdir -p "$REPORT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="$REPORT_DIR/SIMULATOR_SERVICE_RECOVERY_${STAMP}.md"
MAX_ATTEMPTS="${YT_SIM_RECOVERY_ATTEMPTS:-3}"
UDID="${YT_SIM_UDID:-}"

{
  echo "# Simulator service recovery — $STAMP"
  echo
  echo "## Host"
  echo "- date_utc: $STAMP"
  echo -n "- xcode-select: "; xcode-select -p 2>&1 || true
  echo -n "- xcodebuild version: "; xcodebuild -version 2>&1 | tr '\n' ' ' || true
  echo
  echo
  echo "## Disk"
  df -h / 2>&1 | tail -1 || true
  AVAIL_G=$(df -g / 2>/dev/null | awk 'NR==2{print $4}')
  echo "- available_gi: ${AVAIL_G:-unknown}"
  if [[ -n "${AVAIL_G:-}" && "$AVAIL_G" -lt 5 ]]; then
    echo
    echo "## Result"
    echo "ENVIRONMENT BLOCKER — disk pressure (<5Gi)"
    exit 12
  fi
  echo
  echo "## Runtimes"
  xcrun simctl list runtimes 2>&1 | head -40 || true
  echo
  echo "## Devices (attempt list)"
} >"$REPORT"

list_ok=0
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  {
    echo "### Attempt $attempt"
    echo '```'
    xcrun simctl list devices available 2>&1 | head -60 || true
    echo '```'
  } >>"$REPORT"
  if xcrun simctl list devices available >/tmp/yt-sim-list.txt 2>/tmp/yt-sim-list.err; then
    if grep -qi 'iPhone' /tmp/yt-sim-list.txt; then
      list_ok=1
      break
    fi
  fi
  # Safe user-level nudge only — do not kill unrelated apps
  launchctl kickstart -k "gui/$(id -u)/com.apple.CoreSimulator.CoreSimulatorService" >>"$REPORT" 2>&1 || true
  sleep 2
done

if [[ "$list_ok" -ne 1 ]]; then
  {
    echo
    echo "## Result"
    echo "ENVIRONMENT BLOCKER — CORESIMULATOR SERVICE UNAVAILABLE"
    echo
    echo "stderr:"
    echo '```'
    cat /tmp/yt-sim-list.err 2>/dev/null | head -40 || true
    echo '```'
  } >>"$REPORT"
  echo "SIMULATOR_RECOVERY: ENVIRONMENT BLOCKER — CORESIMULATOR SERVICE UNAVAILABLE"
  echo "REPORT=$REPORT"
  exit 10
fi

# Pick device
if [[ -z "$UDID" ]]; then
  UDID=$(awk -F '[()]' '/iPhone 16 \(/ && /Shutdown|Booted/ {print $2; exit}' /tmp/yt-sim-list.txt || true)
fi
{
  echo
  echo "## Selected UDID"
  echo "- udid: ${UDID:-none}"
} >>"$REPORT"

if [[ -z "$UDID" ]]; then
  echo "## Result" >>"$REPORT"
  echo "ENVIRONMENT BLOCKER — no iPhone 16 UDID parsed" >>"$REPORT"
  exit 10
fi

xcrun simctl boot "$UDID" >>"$REPORT" 2>&1 || true
if xcrun simctl bootstatus "$UDID" -b >>"$REPORT" 2>&1; then
  {
    echo
    echo "## Result"
    echo "CODE PASS — simctl list + bootstatus healthy"
  } >>"$REPORT"
  echo "SIMULATOR_RECOVERY: PASS"
  echo "REPORT=$REPORT"
  exit 0
fi

{
  echo
  echo "## Result"
  echo "ENVIRONMENT BLOCKER — CORESIMULATOR SERVICE UNAVAILABLE (bootstatus failed)"
} >>"$REPORT"
echo "SIMULATOR_RECOVERY: PARTIAL/BLOCKED"
echo "REPORT=$REPORT"
exit 11
