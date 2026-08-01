#!/usr/bin/env bash
# Pin Maestro to OpenJDK 17 and run staging flows. Does not edit global shell profiles.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/qa/lib/resolve-jdk17.sh"
if ! resolve_jdk17 >/tmp/yt-jdk17-home.txt; then
  echo "error: OpenJDK 17 required for Maestro QA" >&2
  exit 2
fi

ART_DIR="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-artifacts}"
mkdir -p "$ART_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$ART_DIR/maestro-$STAMP.log"

# Maestro 2.8 parses this as milliseconds (default ~15s is too short after driver reinstall).
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"
export PATH="$HOME/.maestro/bin:${PATH:-}"

{
  echo "JAVA_HOME=$JAVA_HOME"
  java -version
  echo "maestro_bin=$(command -v maestro || true)"
} | tee -a "$LOG"

if ! command -v maestro >/dev/null 2>&1; then
  echo "error: maestro CLI not found on PATH (expected ~/.maestro/bin/maestro)" | tee -a "$LOG" >&2
  exit 3
fi
maestro --version 2>&1 | tee -a "$LOG"
# Guard: refuse if java somehow drifted off 17
java -version 2>&1 | tee -a "$LOG" | rg -q 'version "17\.' || {
  echo "error: Java runtime is not 17" | tee -a "$LOG" >&2
  exit 2
}

FLOW="${1:-}"
if [[ -z "$FLOW" ]]; then
  echo "usage: $0 <maestro-flow.yaml> [maestro args...]" | tee -a "$LOG" >&2
  exit 64
fi
shift || true
FLOW_PATH="$FLOW"
if [[ ! -f "$FLOW_PATH" ]]; then
  FLOW_PATH="$ROOT/$FLOW"
fi
if [[ ! -f "$FLOW_PATH" ]]; then
  echo "error: flow not found: $FLOW" | tee -a "$LOG" >&2
  exit 64
fi

# Optional staging credentials for flows that need email login (never echoed).
if [[ -f "$ROOT/.codex/secrets/staging-qa-credentials.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.codex/secrets/staging-qa-credentials.env"
  set +a
fi

# Idempotent email fixture + identity preflight before dependent Maestro flows.
UDID="${YT_SIMULATOR_UDID:-A6BA9300-8C72-44CE-9CDD-19E096070626}"
if [[ "${YT_SKIP_EMAIL_PREFLIGHT:-0}" != "1" ]]; then
  echo "running email fixture preflight udid=$UDID" | tee -a "$LOG"
  if ! "$ROOT/scripts/qa/preflight-email-fixture-staging.sh" "$UDID" 2>&1 | tee -a "$LOG"; then
    echo "error: email fixture preflight failed" | tee -a "$LOG" >&2
    exit 5
  fi
fi

OUT_DIR="$ART_DIR/maestro-$STAMP"
mkdir -p "$OUT_DIR"
echo "running maestro flow=$FLOW_PATH out=$OUT_DIR" | tee -a "$LOG"

set +e
maestro test "$FLOW_PATH" \
  --output "$OUT_DIR" \
  --debug-output "$OUT_DIR/debug" \
  "$@" 2>&1 | tee -a "$LOG"
CODE=${PIPESTATUS[0]}
set -e
echo "maestro_exit=$CODE" | tee -a "$LOG"
exit "$CODE"
