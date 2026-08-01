#!/usr/bin/env bash
# Deterministic Gitleaks scan over tracked release source only.
# Does NOT walk local DerivedData / Pods / node_modules / evidence dumps.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONFIG="${GITLEAKS_CONFIG:-$ROOT/.gitleaks.toml}"
REPORT="${GITLEAKS_REPORT:-/tmp/youtrader-gitleaks-tracked-$(date -u +%Y%m%dT%H%M%SZ).json}"
SNAP="${GITLEAKS_SNAPSHOT_DIR:-/tmp/youtrader-gitleaks-snapshot-$$}"

cleanup() { rm -rf "$SNAP"; }
trap cleanup EXIT

command -v gitleaks >/dev/null 2>&1 || {
  echo "error: gitleaks CLI not found on PATH" >&2
  exit 2
}

[[ -f "$CONFIG" ]] || {
  echo "error: missing gitleaks config $CONFIG" >&2
  exit 2
}

# Prefer git archive of HEAD (committed tracked tree). When the worktree has
# staged/unstaged release changes that must be included before commit, set
# GITLEAKS_INCLUDE_WORKTREE=1 to export an index snapshot of tracked paths only.
mkdir -p "$SNAP"
if [[ "${GITLEAKS_INCLUDE_WORKTREE:-0}" == "1" ]]; then
  # Tracked files only (including local modifications to tracked paths).
  git ls-files -z | while IFS= read -r -d '' f; do
    mkdir -p "$SNAP/$(dirname "$f")"
    # Copy file contents; skip if deleted in worktree
    if [[ -f "$f" ]]; then
      cp "$f" "$SNAP/$f"
    fi
  done
else
  git archive --format=tar HEAD | tar -x -C "$SNAP"
fi

echo "gitleaks_tracked_scan snapshot=$SNAP report=$REPORT"
# Count files for evidence (no secret content)
file_count="$(find "$SNAP" -type f | wc -l | tr -d ' ')"
echo "gitleaks_tracked_file_count=$file_count"

set +e
gitleaks detect \
  --no-git \
  --source "$SNAP" \
  --config "$CONFIG" \
  --report-path "$REPORT" \
  --report-format json \
  --redact
RC=$?
set -e

if [[ "$RC" -eq 0 ]]; then
  echo "gitleaks_tracked_scan PASS findings=0 report=$REPORT"
  exit 0
fi

# Summarize redacted findings by path (never print secret bodies).
if [[ -f "$REPORT" ]]; then
  python3 - "$REPORT" <<'PY'
import json,sys,collections
from pathlib import Path
raw=Path(sys.argv[1]).read_text() or "[]"
try:
  data=json.loads(raw)
except Exception:
  print("gitleaks_report_unreadable")
  sys.exit(0)
if not isinstance(data, list):
  data=data.get("findings") or data.get("leaks") or []
by=collections.Counter()
rules=collections.Counter()
for item in data:
  fp=item.get("File") or item.get("file") or item.get("Path") or "?"
  rule=item.get("RuleID") or item.get("Rule") or item.get("Description") or "?"
  by[fp]+=1
  rules[str(rule)]+=1
print(f"gitleaks_findings={len(data)}")
print("by_path_top:")
for p,n in by.most_common(40):
  print(f"  {n}\t{p}")
print("by_rule:")
for r,n in rules.most_common(20):
  print(f"  {n}\t{r}")
PY
fi

echo "gitleaks_tracked_scan FAIL exit=$RC report=$REPORT" >&2
exit "$RC"
