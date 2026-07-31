#!/usr/bin/env bash
# Resolve a project/local JDK without sudo and run Maestro staging flows.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ART_DIR="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-artifacts}"
mkdir -p "$ART_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$ART_DIR/maestro-$STAMP.log"

resolve_java_home() {
  local cand
  for cand in \
    "${JAVA_HOME:-}" \
    "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
    "/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home" \
    "/opt/homebrew/opt/openjdk@17" \
    "/opt/homebrew/opt/openjdk" \
    "$ROOT/.tools/jdk-17" \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  do
    [[ -z "$cand" ]] && continue
    if [[ -x "$cand/bin/java" ]]; then
      echo "$cand"
      return 0
    fi
  done
  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    local home
    home="$(/usr/libexec/java_home 2>/dev/null || true)"
    if [[ -n "$home" && -x "$home/bin/java" ]]; then
      echo "$home"
      return 0
    fi
  fi
  return 1
}

if ! JAVA_HOME="$(resolve_java_home)"; then
  echo "error: no usable JDK found without sudo. Tried Homebrew openjdk@17/openjdk and .tools/jdk-17." >&2
  exit 2
fi
export JAVA_HOME
export PATH="$JAVA_HOME/bin:${PATH:-}"

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
