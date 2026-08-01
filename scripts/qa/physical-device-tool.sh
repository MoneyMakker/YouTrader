#!/usr/bin/env bash
# Physical-device QA wrapper for YouTrader Release-Staging 1.6.1 (113).
# Uses absolute QA venv paths + CoreDevice/devicectl. Does not unpair/erase.
#
# Exit codes:
#   0  success
#  20  CoreDevice/devicectl unavailable
#  21  device absent
#  22  device locked
#  23  Developer Mode / DDI unavailable
#  24  app install failure
#  25  app launch failure
#  26  screenshot failure
#  27  pairing/service failure
#  64  usage
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

VENV="${YT_QA_VENV:-$HOME/.youtrader-qa-tools/pyvenv}"
PY="$VENV/bin/python"
PMD="$VENV/bin/pymobiledevice3"
DEVICE_ID="${YT_PHYSICAL_DEVICE_ID:-6FCFF771-7154-5CC0-BC29-858A3C376CAF}"
BUNDLE_ID="${YT_BUNDLE_ID:-com.youtrader.pro}"
EXPECTED_VERSION="${YT_EXPECTED_VERSION:-1.6.1}"
EXPECTED_BUILD="${YT_EXPECTED_BUILD:-113}"
STAGING_HOST="zleojeqkzizeyerhjpur.supabase.co"
PROD_HOST="izzrlsgumyabdvlmwlwn.supabase.co"
EVID_DIR="${YT_PHYSICAL_EVIDENCE_DIR:-$ROOT/docs/releases/1.6.1/phase4f-screenshots/physical}"
ART_DIR="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-artifacts}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$EVID_DIR" "$ART_DIR"
LOG="${YT_PHYSICAL_TOOL_LOG:-$ART_DIR/physical-device-tool-$STAMP.log}"
MODE="${1:-help}"
shift || true

log() { echo "$*" | tee -a "$LOG"; }

die() {
  local code="$1"; shift
  log "error: $* (exit=$code)"
  exit "$code"
}

require_devicectl() {
  command -v xcrun >/dev/null 2>&1 || die 20 "xcrun missing"
  # Prefer list over `version` — some Xcode toolchains omit a stable version subcommand.
  xcrun devicectl list devices >/dev/null 2>&1 || die 20 "devicectl unavailable"
}

require_pmd() {
  [[ -x "$PY" ]] || die 27 "QA venv python missing: $PY"
  [[ -x "$PMD" ]] || die 27 "pymobiledevice3 missing in venv: $PMD (pip install inside $VENV only)"
}

cmd_env() {
  require_devicectl
  require_pmd
  log "stamp=$STAMP"
  log "device_id=$DEVICE_ID"
  log "venv=$VENV"
  log "pymobiledevice3=$PMD"
  "$PY" -c "import importlib.metadata as m; print('pymobiledevice3_version='+m.version('pymobiledevice3'))" | tee -a "$LOG"
  # CLI surface check (version-specific; do not assume older flags)
  "$PMD" developer dvt screenshot --help >/dev/null 2>&1 || die 27 "screenshot subcommand unsupported by this pymobiledevice3"
  log "physical_tool_env_ok"
}

cmd_list() {
  require_devicectl
  require_pmd
  log "## usbmux list (non-sensitive fields only)"
  "$PMD" usbmux list --usb 2>&1 | tee -a "$LOG" | rg -v 'SerialNumber|ECID|PhoneNumber|AppleID|email' || true
  log "## devicectl list"
  xcrun devicectl list devices 2>&1 | tee -a "$LOG" | head -40
  if ! xcrun devicectl list devices 2>&1 | rg -q "$DEVICE_ID"; then
    die 21 "target device $DEVICE_ID not listed"
  fi
  log "physical_list_ok"
}

cmd_status() {
  require_devicectl
  require_pmd
  if ! xcrun devicectl list devices 2>&1 | rg -q "$DEVICE_ID"; then
    die 21 "device absent"
  fi
  local details
  details="$(xcrun devicectl device info details --device "$DEVICE_ID" 2>&1 || true)"
  # Redact personal/hardware identifiers from console evidence
  echo "$details" | rg -v 'serialNumber:|ecid:|tunnelIPAddress:|UDID|UniqueDevice' | tee -a "$LOG" | head -80
  if ! echo "$details" | rg -qi 'developerModeStatus: enabled'; then
    # Some builds omit the key when unavailable
    if echo "$details" | rg -qi 'ddiServicesAvailable: false'; then
      die 23 "Developer Mode / DDI unavailable"
    fi
  fi
  # Lock probe: Preferences launch denied when locked
  local out
  out="$(xcrun devicectl device process launch --device "$DEVICE_ID" com.apple.Preferences 2>&1 || true)"
  if echo "$out" | rg -qi 'Locked|could not be, unlocked|device was not'; then
    log "DEVICE_LOCKED"
    exit 22
  fi
  if echo "$out" | rg -qi 'ERROR|failed' && ! echo "$out" | rg -qi 'Launched application'; then
    log "launch_probe_err=$out"
    die 27 "pairing/service probe failed"
  fi
  log "DEVICE_UNLOCKED"
  # Metro must be OFF for physical RS path
  if lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; then
    log "warn: Metro listening on 8081 (physical RS expects Metro OFF)"
  else
    log "metro_off=yes"
  fi
  xcrun devicectl device info apps --device "$DEVICE_ID" 2>&1 | tee -a "$LOG" | rg -i 'YouTrader|com.youtrader' || true
  log "physical_status_ok"
}

cmd_wait_unlock() {
  require_devicectl
  local max="${1:-180}" i=0
  log "wait_unlock max_attempts=$max"
  while (( i < max )); do
    i=$((i + 1))
    local out
    out="$(xcrun devicectl device process launch --device "$DEVICE_ID" com.apple.Preferences 2>&1 || true)"
    if echo "$out" | rg -qi 'Locked|could not be, unlocked|device was not'; then
      log "attempt=$i LOCKED"
      sleep 5
      continue
    fi
    if echo "$out" | rg -qi 'Launched application|launched'; then
      log "attempt=$i UNLOCKED"
      # Best-effort leave Settings
      "$PMD" developer dvt pkill Preferences >/dev/null 2>&1 || true
      log "DEVICE_UNLOCKED"
      return 0
    fi
    log "attempt=$i PROBE"
    sleep 5
  done
  die 22 "device remained locked after $max attempts"
}

find_app() {
  local c
  for c in \
    "$ROOT/build/YouTrader-1.6.1-113-staging.xcarchive/Products/Applications/YouTrader.app" \
    "$ROOT/build/DerivedData-yt3-qa/Build/Products/Release-Staging-iphoneos/YouTrader.app" \
    "$ROOT/build/DerivedData-ReleaseStaging/Build/Products/Release-Staging-iphoneos/YouTrader.app"
  do
    [[ -d "$c" ]] && { echo "$c"; return 0; }
  done
  return 1
}

cmd_verify113() {
  require_devicectl
  # Installed identity
  local apps
  apps="$(xcrun devicectl device info apps --device "$DEVICE_ID" 2>&1 || true)"
  echo "$apps" | tee -a "$LOG" | rg -i 'YouTrader|com.youtrader' || true
  if ! echo "$apps" | rg -q "YouTrader[[:space:]]+com\.youtrader\.pro[[:space:]]+$EXPECTED_VERSION[[:space:]]+$EXPECTED_BUILD"; then
    # Fallback looser match
    if ! echo "$apps" | rg -q "$EXPECTED_VERSION" || ! echo "$apps" | rg -q "$EXPECTED_BUILD"; then
      die 24 "installed app is not $EXPECTED_VERSION ($EXPECTED_BUILD)"
    fi
  fi
  local app
  if app="$(find_app)"; then
    log "local_rs_app=$app"
    local ver short
    ver="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$app/Info.plist")"
    short="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Info.plist")"
    log "local_bundle_version=$ver short=$short"
    [[ "$ver" == "$EXPECTED_BUILD" ]] || die 24 "local RS candidate build=$ver expected=$EXPECTED_BUILD"
    if [[ -f "$app/main.jsbundle" ]]; then
      log "embedded_bundle=yes sha=$(shasum -a 256 "$app/main.jsbundle" | awk '{print $1}')"
      if rg -q "$PROD_HOST" "$app/main.jsbundle" 2>/dev/null; then
        die 24 "production host found in embedded jsbundle"
      fi
      if rg -q "$STAGING_HOST" "$app/main.jsbundle" 2>/dev/null; then
        log "staging_host_in_jsbundle=yes"
      fi
    else
      die 24 "embedded main.jsbundle missing on local RS candidate"
    fi
  else
    log "warn: local RS .app candidate missing; relying on installed device identity only"
  fi
  if lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; then
    log "warn: Metro ON — physical path expects Metro OFF"
  else
    log "metro_off=yes"
  fi
  log "physical_verify113_ok"
}

cmd_terminate() {
  require_devicectl
  require_pmd
  "$PMD" developer dvt pkill YouTrader 2>&1 | tee -a "$LOG" || true
  log "terminate_ok"
}

cmd_launch() {
  require_devicectl
  local out
  out="$(xcrun devicectl device process launch --terminate-existing --device "$DEVICE_ID" "$BUNDLE_ID" 2>&1 || true)"
  echo "$out" | tee -a "$LOG"
  if echo "$out" | rg -qi 'Locked|could not be, unlocked'; then
    die 22 "DEVICE LOCKED — cannot launch"
  fi
  if ! echo "$out" | rg -qi 'Launched application'; then
    die 25 "app launch failure"
  fi
  log "launch_ok"
}

cmd_relaunch() {
  cmd_terminate
  sleep 1
  cmd_launch
}

cmd_install() {
  require_devicectl
  local app
  app="$(find_app)" || die 24 "no Release-Staging 113 .app candidate to install"
  cmd_verify113 || true
  local ver
  ver="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$app/Info.plist")"
  [[ "$ver" == "$EXPECTED_BUILD" ]] || die 24 "refusing non-$EXPECTED_BUILD install ($ver)"
  log "installing $app"
  if ! xcrun devicectl device install app --device "$DEVICE_ID" "$app" 2>&1 | tee -a "$LOG"; then
    die 24 "app install failure"
  fi
  log "install_ok"
}

cmd_screenshot() {
  require_devicectl
  require_pmd
  local gate="${1:-unspecified}"
  local out="$EVID_DIR/${STAMP}_${gate}.png"
  mkdir -p "$(dirname "$out")"
  # Prefer USB UDID from usbmux when available (JSON Identifier)
  local udid=""
  udid="$("$PMD" usbmux list --usb 2>/dev/null | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  print((d[0].get("UniqueDeviceID") or d[0].get("Identifier") or "") if isinstance(d,list) and d else "")
except Exception:
  print("")' 2>/dev/null || true)"
  if [[ -n "$udid" ]]; then
    if ! "$PMD" developer dvt screenshot --udid "$udid" "$out" 2>&1 | tee -a "$LOG"; then
      die 26 "screenshot failure"
    fi
  else
    if ! "$PMD" developer dvt screenshot "$out" 2>&1 | tee -a "$LOG"; then
      die 26 "screenshot failure"
    fi
  fi
  [[ -f "$out" ]] || die 26 "screenshot file missing"
  local kind
  kind="$(file -b "$out" || true)"
  echo "$kind" | rg -qi 'PNG image' || die 26 "not a PNG: $kind"
  # Non-zero dimensions via sips / file
  local w h
  w="$(sips -g pixelWidth "$out" 2>/dev/null | awk '/pixelWidth/{print $2}')"
  h="$(sips -g pixelHeight "$out" 2>/dev/null | awk '/pixelHeight/{print $2}')"
  [[ -n "$w" && -n "$h" && "$w" != "0" && "$h" != "0" ]] || die 26 "zero dimensions"
  # Reject near-black frames as invalid product evidence (status-bar-only)
  local mean
  mean="$(python3 - "$out" <<'PY'
import struct,zlib,sys
from pathlib import Path
path=Path(sys.argv[1])
data=path.read_bytes(); i=8; idat=b''; w=h=None; ct=2
while i < len(data):
  ln=int.from_bytes(data[i:i+4],'big'); typ=data[i+4:i+8]; chunk=data[i+8:i+8+ln]; i+=12+ln
  if typ==b'IHDR': w,h=struct.unpack('>II', chunk[:8]); ct=chunk[9]
  elif typ==b'IDAT': idat+=chunk
  elif typ==b'IEND': break
raw=zlib.decompress(idat); bpp=3 if ct==2 else (4 if ct==6 else 1); stride=w*bpp
out=bytearray(); prev=bytearray(stride); o=0
for y in range(h):
  f=raw[o]; o+=1; row=bytearray(raw[o:o+stride]); o+=stride
  if f==1:
    for x in range(stride): row[x]=(row[x]+(row[x-bpp] if x>=bpp else 0))&255
  elif f==2:
    for x in range(stride): row[x]=(row[x]+prev[x])&255
  elif f==3:
    for x in range(stride):
      left=row[x-bpp] if x>=bpp else 0; row[x]=(row[x]+((left+prev[x])//2))&255
  elif f==4:
    def paeth(a,b,c):
      p=a+b-c; pa=abs(p-a); pb=abs(p-b); pc=abs(p-c)
      return a if pa<=pb and pa<=pc else (b if pb<=pc else c)
    for x in range(stride):
      a=row[x-bpp] if x>=bpp else 0; b=prev[x]; c=prev[x-bpp] if x>=bpp else 0
      row[x]=(row[x]+paeth(a,b,c))&255
  out.extend(row); prev=row
print(f"{sum(out)/len(out):.3f}")
PY
)"
  log "screenshot path=$out gate=$gate ${w}x${h} mean_luma=$mean"
  # Soft reject: black UI is invalid evidence (exit 26) unless YT_ALLOW_BLACK_SHOT=1
  if awk -v m="$mean" 'BEGIN{exit !(m+0 < 1.5)}'; then
    if [[ "${YT_ALLOW_BLACK_SHOT:-0}" == "1" ]]; then
      log "warn: near-black screenshot allowed by YT_ALLOW_BLACK_SHOT"
    else
      die 26 "near-black screenshot rejected (mean_luma=$mean) — invalid product evidence"
    fi
  fi
  # Sidecar metadata (non-sensitive)
  cat >"${out%.png}.json" <<EOF
{
  "stamp": "$STAMP",
  "device_class": "physical_iphone",
  "device_id": "$DEVICE_ID",
  "version": "$EXPECTED_VERSION",
  "build": "$EXPECTED_BUILD",
  "gate": "$gate",
  "screenshot": "$out",
  "width": $w,
  "height": $h,
  "mean_luma": $mean,
  "metro": "off"
}
EOF
  log "screenshot_ok"
  echo "$out"
}

cmd_prove() {
  # End-to-end screenshot pipeline proof for build 113
  cmd_env
  cmd_list
  cmd_status || {
    local ec=$?
    [[ $ec -eq 22 ]] && die 22 "DEVICE LOCKED — preserve checkpoint; owner unlock only"
    exit "$ec"
  }
  cmd_verify113
  # Cold relaunch alone can yield a solid-black first frame for several seconds.
  # Prefer QA reset deep link so the primary scene paints product UI before capture.
  require_devicectl
  xcrun devicectl device process launch --terminate-existing --device "$DEVICE_ID" \
    --payload-url 'youtrader://qa/reset-fresh' "$BUNDLE_ID" 2>&1 | tee -a "$LOG" || true
  local i mean=0
  for i in 1 2 3 4 5 6 7 8; do
    sleep 2
    local probe="$EVID_DIR/${STAMP}_prove_probe_${i}.png"
    if "$PMD" developer dvt screenshot "$probe" >/dev/null 2>&1; then
      mean="$(python3 - "$probe" <<'PY'
import struct,zlib,sys
from pathlib import Path
path=Path(sys.argv[1]); data=path.read_bytes(); i=8; idat=b''; w=h=None; ct=2
while i < len(data):
  ln=int.from_bytes(data[i:i+4],'big'); typ=data[i+4:i+8]; chunk=data[i+8:i+8+ln]; i+=12+ln
  if typ==b'IHDR': w,h=struct.unpack('>II', chunk[:8]); ct=chunk[9]
  elif typ==b'IDAT': idat+=chunk
  elif typ==b'IEND': break
raw=zlib.decompress(idat); bpp=3 if ct==2 else 4; stride=w*bpp
out=bytearray(); prev=bytearray(stride); o=0
for y in range(h):
  f=raw[o]; o+=1; row=bytearray(raw[o:o+stride]); o+=stride
  if f==1:
    for x in range(stride): row[x]=(row[x]+(row[x-bpp] if x>=bpp else 0))&255
  elif f==2:
    for x in range(stride): row[x]=(row[x]+prev[x])&255
  elif f==3:
    for x in range(stride):
      left=row[x-bpp] if x>=bpp else 0; row[x]=(row[x]+((left+prev[x])//2))&255
  elif f==4:
    def paeth(a,b,c):
      p=a+b-c; pa=abs(p-a); pb=abs(p-b); pc=abs(p-c)
      return a if pa<=pb and pa<=pc else (b if pb<=pc else c)
    for x in range(stride):
      a=row[x-bpp] if x>=bpp else 0; b=prev[x]; c=prev[x-bpp] if x>=bpp else 0
      row[x]=(row[x]+paeth(a,b,c))&255
  out.extend(row); prev=row
print(f"{sum(out)/len(out):.3f}")
PY
)"
      log "prove_probe i=$i mean_luma=$mean"
      if awk -v m="$mean" 'BEGIN{exit !(m+0 >= 1.5)}'; then
        cp "$probe" "$EVID_DIR/${STAMP}_youtrader_foreground_proof.png"
        # Finalize metadata via screenshot helper path
        YT_ALLOW_BLACK_SHOT=0 cmd_screenshot "youtrader_foreground_proof" >/dev/null || true
        log "physical_prove_ok mean=$mean"
        return 0
      fi
    fi
  done
  log "youtrader_screenshot_invalid — recording LIVE_FAIL evidence gap"
  YT_ALLOW_BLACK_SHOT=1 cmd_screenshot "youtrader_black_invalid" || true
  exit 26
}

usage() {
  cat <<EOF
usage: $0 <command> [args]

commands:
  env              verify venv + pymobiledevice3 + devicectl
  list             list usbmux + CoreDevice (non-sensitive)
  status           unlocked/locked + developer mode + apps
  wait-unlock [N]  poll until unlocked (default 180 attempts)
  verify113        installed + local RS 113 identity
  install          install RS 113 only (no 114)
  terminate        kill YouTrader
  launch           launch YouTrader
  relaunch         terminate + launch
  screenshot GATE  capture PNG evidence for GATE
  prove            env→list→status→verify→relaunch→screenshot proof
EOF
}

case "$MODE" in
  env) cmd_env ;;
  list) cmd_list ;;
  status) cmd_status ;;
  wait-unlock) cmd_wait_unlock "${1:-180}" ;;
  verify113|verify) cmd_verify113 ;;
  install) cmd_install ;;
  terminate) cmd_terminate ;;
  launch) cmd_launch ;;
  relaunch) cmd_relaunch ;;
  screenshot) cmd_screenshot "${1:-unspecified}" ;;
  prove) cmd_prove ;;
  help|-h|--help) usage ;;
  *) usage; exit 64 ;;
esac
