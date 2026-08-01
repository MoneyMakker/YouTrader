#!/usr/bin/env bash
# Expand physical cold×5 + warm×3 with evidence manifest. Refuses non-113.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
ART="${YT_QA_ARTIFACTS_DIR:-$ROOT/docs/releases/1.6.1/qa-logs}"
SHOT="${YT_QA_SCREENSHOT_DIR:-$ROOT/docs/releases/1.6.1/phase4f-screenshots}"
mkdir -p "$ART" "$SHOT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$ART/physical_matrix_s12_$STAMP.log"
MANIFEST="$ART/physical_evidence_manifest_s12_$STAMP.json"
export YT_QA_ARTIFACTS_DIR="$ART"

{
  echo "physical_matrix_start stamp=$STAMP"
  bash scripts/qa/physical-device-harness.sh status
  bash scripts/qa/physical-device-harness.sh verify
} 2>&1 | tee "$LOG"

# Parse installed version from last status if present
if rg -q 'YouTrader.*114' "$LOG"; then
  echo "error: device has build 114 — refuse Phase 4F physical matrix (113 only)" | tee -a "$LOG" >&2
  python3 - <<PY
import json
print(json.dumps({
  "stamp": "$STAMP",
  "status": "REFUSED",
  "reason": "device_build_114_forbidden",
  "required_build": "113",
}, indent=2))
PY
  exit 14
fi

bash scripts/qa/physical-device-harness.sh cold 2>&1 | tee -a "$LOG"
bash scripts/qa/physical-device-harness.sh warm 2>&1 | tee -a "$LOG"

python3 - <<PY | tee "$MANIFEST"
import json, re, pathlib
log=pathlib.Path("$LOG").read_text(errors="ignore")
cold=len(re.findall(r"cold_launch_\\d+=process_ok", log))
warm=len(re.findall(r"warm_launch_\\d+=process_ok", log))
print(json.dumps({
  "stamp": "$STAMP",
  "status": "PASS" if cold>=5 and warm>=3 else "PARTIAL",
  "cold_ok": cold,
  "warm_ok": warm,
  "metro": "OFF_required",
  "build_required": "113",
}, indent=2))
PY
echo "physical_matrix_done manifest=$MANIFEST"
