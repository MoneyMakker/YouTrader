#!/usr/bin/env bash
# Phase 1E — secret / service-role absence scan for App + activation boundary.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0

scan() {
  local path="$1"
  if rg -n --hidden -g '!node_modules' -g '!build' -g '!.tmp' \
    'SUPABASE_SERVICE_ROLE|service_role\s*[:=]|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}' \
    "$path" 2>/dev/null; then
    echo "FAIL: potential secret pattern in $path"
    FAIL=1
  else
    echo "OK  secret scan clean: $path"
  fi
}

scan "App.tsx"
scan "src/propOs/activation"
scan "src/propPass"
if [[ -f src/app/YouTraderApp.tsx ]]; then
  scan "src/app/YouTraderApp.tsx"
fi

# Activation must not hardcode allowlisted production user emails
if rg -n '@youtrader|@gmail\.com|sk-|rk_live' src/propOs/activation 2>/dev/null; then
  echo "FAIL: suspicious hard-coded identity/secret in activation"
  FAIL=1
fi

if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
echo "prop-os-activation-secret-scan: PASS"
