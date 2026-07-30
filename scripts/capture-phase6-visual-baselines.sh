#!/usr/bin/env bash
# Capture Phase 6 YDL visual baselines on iPhone 17 via Storybook + Maestro.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SIM_NAME="${YDL_VR_SIMULATOR:-iPhone 17}"
BUNDLE_ID="com.youtrader.pro"
BASELINES_DIR="$ROOT/.maestro/ydl/baselines"
OUTPUT_DIR="${MAESTRO_TEST_OUTPUT_DIR:-$ROOT/.maestro/ydl/.capture-out}"
STORY_DARK="youtrader-phase6-visualregressiongallery--dark-gallery"
STORY_LIGHT="youtrader-phase6-visualregressiongallery--light-gallery"
STORY_LARGE="youtrader-phase6-visualregressiongallery--large-text-gallery"
STORY_RM="youtrader-phase6-visualregressiongallery--reduce-motion-gallery"

EXPECTED=(
  ydl_vr_dark_gallery
  ydl_vr_dark_buttons
  ydl_vr_dark_cards
  ydl_vr_dark_badges_chips
  ydl_vr_dark_list
  ydl_vr_dark_empty
  ydl_vr_dark_skeleton_static
  ydl_vr_dark_banners
  ydl_vr_dark_radar_fixture
  ydl_vr_light_gallery
  ydl_vr_light_buttons
  ydl_vr_light_radar_fixture
  ydl_vr_large_text_gallery
  ydl_vr_reduce_motion_skeleton
)

mkdir -p "$BASELINES_DIR" "$OUTPUT_DIR/screenshots"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"

UDID="$(xcrun simctl list devices available | grep "${SIM_NAME} (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')"
if [[ -z "${UDID:-}" ]]; then
  echo "ERROR: Simulator '$SIM_NAME' not found." >&2
  exit 1
fi

echo "==> Using $SIM_NAME ($UDID)"
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator --args -CurrentDeviceUDID "$UDID" >/dev/null 2>&1 || true

set_reduce_motion() {
  local enabled="$1" # yes|no
  xcrun simctl spawn "$UDID" defaults write com.apple.Accessibility ReduceMotionEnabled -bool "$enabled" >/dev/null
}

reset_a11y() {
  xcrun simctl ui "$UDID" appearance dark >/dev/null
  xcrun simctl ui "$UDID" content_size medium >/dev/null 2>&1 || true
  set_reduce_motion no || true
}

stop_metro() {
  if lsof -ti:8081 >/dev/null 2>&1; then
    lsof -ti:8081 | xargs kill 2>/dev/null || true
    sleep 2
  fi
}

wait_metro() {
  for _ in $(seq 1 90); do
    if curl -sf "http://127.0.0.1:8081/status" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "ERROR: Metro did not start" >&2
  return 1
}

launch_storybook() {
  local story="$1"
  local log="$OUTPUT_DIR/metro-${story}.log"
  echo "==> Launching Storybook story: $story"
  stop_metro

  npx cross-env STORYBOOK_ENABLED=true "EXPO_PUBLIC_YDL_VR_STORY=$story" \
    expo start --localhost --port 8081 >"$log" 2>&1 &
  echo $! >"$OUTPUT_DIR/metro.pid"
  wait_metro

  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1
  if ! xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data >/dev/null 2>&1; then
    echo "ERROR: $BUNDLE_ID not installed. Run: npx expo run:ios -d \"$SIM_NAME\"" >&2
    exit 1
  fi
  xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
  for _ in $(seq 1 60); do
    if rg -q "iOS Bundled" "$log" 2>/dev/null; then
      sleep 12
      return 0
    fi
    sleep 2
  done
  sleep 20
}

sync_baselines() {
  mkdir -p "$OUTPUT_DIR/screenshots"
  local found=0
  for name in "${EXPECTED[@]}"; do
    if [[ -f "$OUTPUT_DIR/screenshots/${name}.png" ]]; then
      cp -f "$OUTPUT_DIR/screenshots/${name}.png" "$BASELINES_DIR/${name}.png"
      found=$((found + 1))
    fi
  done
  echo "==> Synced $found / ${#EXPECTED[@]} baselines from screenshots/"
}

run_flow() {
  local flow="$1"
  echo "==> Maestro: $(basename "$flow")"
  maestro --device "$UDID" test \
    --test-output-dir "$OUTPUT_DIR" \
    --debug-output "$OUTPUT_DIR" \
    "$flow"
  sync_baselines
}

cleanup() {
  reset_a11y || true
  if [[ "${CAPTURE_KEEP_METRO:-0}" != "1" ]]; then
    stop_metro || true
  fi
}
trap cleanup EXIT

echo "==> Phase 6 visual baseline capture"
reset_a11y

xcrun simctl ui "$UDID" appearance dark
launch_storybook "$STORY_DARK"
run_flow "$ROOT/.maestro/ydl/visual_regression_dark.yaml"

xcrun simctl ui "$UDID" appearance light
launch_storybook "$STORY_LIGHT"
run_flow "$ROOT/.maestro/ydl/visual_regression_light.yaml"

xcrun simctl ui "$UDID" appearance dark
xcrun simctl ui "$UDID" content_size accessibility-extra-extra-extra-large
launch_storybook "$STORY_LARGE"
run_flow "$ROOT/.maestro/ydl/visual_regression_large_text.yaml"

xcrun simctl ui "$UDID" content_size medium
xcrun simctl ui "$UDID" appearance dark
set_reduce_motion yes
launch_storybook "$STORY_RM"
run_flow "$ROOT/.maestro/ydl/visual_regression_reduce_motion.yaml"

reset_a11y
sync_baselines

echo ""
echo "==> Baseline inventory"
missing=0
for name in "${EXPECTED[@]}"; do
  if [[ -f "$BASELINES_DIR/${name}.png" ]]; then
    ls -la "$BASELINES_DIR/${name}.png"
  else
    echo "MISSING: ${name}.png"
    missing=$((missing + 1))
  fi
done

count="$(find "$BASELINES_DIR" -maxdepth 1 -name 'ydl_vr_*.png' | wc -l | tr -d ' ')"
size_bytes="$(find "$BASELINES_DIR" -maxdepth 1 -name 'ydl_vr_*.png' -exec stat -f%z {} + 2>/dev/null | awk '{s+=$1} END {print s+0}')"
echo ""
echo "Captured PNG baselines: $count / ${#EXPECTED[@]}"
echo "Baselines PNG sum: ${size_bytes} bytes"

if [[ "$missing" -gt 0 ]]; then
  echo "ERROR: $missing baseline(s) missing" >&2
  exit 1
fi

echo "OK: all ${#EXPECTED[@]} Phase 6 visual baselines captured."
