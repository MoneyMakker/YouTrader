#!/usr/bin/env bash
# Phase 4F live E2E orchestrator — resumes from first incomplete gate.
# Never invents PASS. Records branch failures and continues independent gates.
# Build 114 forbidden. Production Supabase forbidden.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_DIR="$ROOT/docs/releases/1.6.1"
mkdir -p "$REPORT_DIR"
STATE="$REPORT_DIR/phase4f-live-e2e-state.json"
REPORT="$REPORT_DIR/PHASE4F_LIVE_E2E_RUN_${STAMP}.md"
EXPECTED_BUILD="113"
EXPECTED_VERSION="1.6.1"
STAGING_MARKER="zleojeqkzizeyerhjpur"
PROD_MARKER="izzrlsgumyabdvlmwlwn"

HARD_FAIL=0
FIRST_INCOMPLETE=""

write_report_header() {
  {
    echo "# Phase 4F live E2E run — $STAMP"
    echo
    echo "Build required: $EXPECTED_VERSION ($EXPECTED_BUILD)"
    echo "Status discipline: no false PASS · continue independent gates on branch blockers"
    echo
  } >"$REPORT"
}

record_gate() {
  local gate="$1" status="$2" reason="${3:-}"
  echo "## Gate \`$gate\` — $status" >>"$REPORT"
  [[ -n "$reason" ]] && echo "$reason" >>"$REPORT"
  echo >>"$REPORT"
  if [[ "$status" != "PASS" && "$status" != "CONTRACT PASS" ]]; then
    if [[ -z "$FIRST_INCOMPLETE" ]]; then
      FIRST_INCOMPLETE="$gate:$status"
    fi
  fi
  case "$status" in
    FAIL|LIVE_FAIL|EXTERNAL_ACCESS_BLOCKER|ENVIRONMENT_BLOCKER)
      HARD_FAIL=1
      ;;
  esac
  printf '{"stamp":"%s","last_gate":"%s","status":"%s","first_incomplete":"%s"}\n' \
    "$STAMP" "$gate" "$status" "${FIRST_INCOMPLETE:-}" >"$STATE"
}

gate_pass() {
  record_gate "$1" "PASS" "${2:-}"
}

write_report_header

# --- Gate: build113 ---
ver="$(node -e "const a=require('./app.json');process.stdout.write(a.expo.version+' '+a.expo.ios.buildNumber)")"
if [[ "$ver" != "$EXPECTED_VERSION $EXPECTED_BUILD" ]]; then
  record_gate build113 FAIL "Expected $EXPECTED_VERSION $EXPECTED_BUILD, got $ver"
  echo "PHASE4F_ABORT fatal build identity mismatch"
  echo "REPORT=$REPORT"
  exit 1
fi
gate_pass build113 "$ver"

# --- Gate: staging_env ---
if ! rg -q "$STAGING_MARKER" .env .env.local 2>/dev/null; then
  record_gate staging_env FAIL "Staging host marker absent from local env files"
  echo "PHASE4F_ABORT fatal staging env"
  echo "REPORT=$REPORT"
  exit 1
fi
gate_pass staging_env "staging host present in local env"

# --- Gate: prod_host_absent ---
if rg -q "$PROD_MARKER" .env .env.local 2>/dev/null; then
  record_gate prod_host_absent FAIL "Production host marker present in local env"
  echo "PHASE4F_ABORT fatal production host in active env"
  echo "REPORT=$REPORT"
  exit 1
fi
gate_pass prod_host_absent "production host absent from local env"

# --- Gate: revenuecat_packages ---
set +e
node --import tsx scripts/qa/revenuecat-offering-audit-staging.ts >"/tmp/yt-rc-audit-$STAMP.txt" 2>&1
rc=$?
set -e
if [[ $rc -ne 0 ]]; then
  record_gate revenuecat_packages EXTERNAL_ACCESS_BLOCKER \
    "Offering incomplete or API fail — see /tmp/yt-rc-audit-$STAMP.txt. Weekly purchase branch blocked; continuing independent gates."
else
  gate_pass revenuecat_packages "package_count=3 (Weekly/Monthly/Annual)"
fi

# --- Gate: edge_deploy_state / PI trusted ping ---
set +e
(
  set -a
  # shellcheck disable=SC1090
  [[ -f "$HOME/.youtrader-qa-secrets/staging-processor.env" ]] && source "$HOME/.youtrader-qa-secrets/staging-processor.env"
  [[ -f .codex/secrets/staging-api-keys.env ]] && source .codex/secrets/staging-api-keys.env
  set +a
  python3 - <<'PY'
import json, os, urllib.request
base=(os.environ.get('SUPABASE_URL') or '').rstrip('/')
secret=(os.environ.get('PROP_OS_PROCESSOR_SHARED_SECRET') or '')
assert 'zleojeqkzizeyerhjpur' in base
assert 'izzrlsgumyabdvlmwlwn' not in base
url=base+'/functions/v1/prop-os-pi-processor'
# unauth
req=urllib.request.Request(url, data=b'{}', method='POST', headers={'Content-Type':'application/json'})
try:
  urllib.request.urlopen(req, timeout=15)
  raise SystemExit('unauth unexpectedly ok')
except urllib.error.HTTPError as e:
  assert e.code in (401,403), e.code
# trusted
headers={'Content-Type':'application/json','x-prop-os-processor-secret':secret}
req2=urllib.request.Request(url, data=json.dumps({'op':'ping'}).encode(), method='POST', headers=headers)
with urllib.request.urlopen(req2, timeout=15) as r:
  body=r.read().decode()
  assert r.status==200 and 'pong' in body
print('PI_TRUSTED_PING_OK')
PY
) >"/tmp/yt-edge-$STAMP.txt" 2>&1
edge_rc=$?
set -e
if [[ $edge_rc -ne 0 ]]; then
  record_gate edge_deploy_state PARTIAL "Trusted PI ping failed — see /tmp/yt-edge-$STAMP.txt"
else
  gate_pass edge_deploy_state "staging PI processor unauth=403 trusted ping=pong"
fi

# --- Gate: pi contracts (always independent) ---
set +e
node --import tsx scripts/pi-timeout-reaper-qa.ts >"/tmp/yt-pi-reaper-$STAMP.txt" 2>&1
r1=$?
node --import tsx scripts/qa/piContract.selftest.ts >"/tmp/yt-pi-contract-$STAMP.txt" 2>&1
r2=$?
set -e
if [[ $r1 -eq 0 && $r2 -eq 0 ]]; then
  record_gate pi_contracts "CONTRACT PASS" "reaper + piContract selftests"
else
  record_gate pi_contracts FAIL "contract selftests failed (reaper=$r1 contract=$r2)"
fi

# --- Gate: recover_simulator ---
set +e
bash scripts/qa/recover-apple-simulator-services.sh >"/tmp/yt-sim-$STAMP.txt" 2>&1
sim_rc=$?
set -e
if [[ $sim_rc -ne 0 ]]; then
  record_gate recover_simulator ENVIRONMENT_BLOCKER \
    "CoreSimulator unavailable (exit $sim_rc). Simulator matrix NOT RUN; continuing device/API gates."
else
  gate_pass recover_simulator
fi

# --- Gate: recover_device ---
set +e
bash scripts/qa/recover-physical-device-services.sh >"/tmp/yt-dev-$STAMP.txt" 2>&1
dev_rc=$?
set -e
if [[ $dev_rc -ne 0 ]]; then
  record_gate recover_device ENVIRONMENT_BLOCKER \
    "CoreDevice unavailable (exit $dev_rc). Physical matrix NOT RUN; continuing non-device gates."
else
  gate_pass recover_device
fi

# Remaining live UI gates require device/simulator automation hooks
for g in select_target install_app onboarding paywall weekly_monthly_yearly post_purchase_auth \
         journal_stats_calendar prop_pass news settings_isolation pi_timeout_retry \
         collect_artifacts final_report; do
  if [[ $sim_rc -ne 0 && $dev_rc -ne 0 ]]; then
    record_gate "$g" NOT_RUN "No simulator and no physical device available on this host"
  elif [[ $sim_rc -ne 0 ]]; then
    record_gate "$g" NOT_RUN "Simulator blocked; physical-only path not yet automated for gate $g"
  elif [[ $dev_rc -ne 0 ]]; then
    record_gate "$g" NOT_RUN "Device blocked; simulator automation hooks not wired for gate $g on this host"
  else
    record_gate "$g" NOT_RUN "Services recovered but live UI automation hooks not wired for gate $g"
  fi
done

{
  echo "## Orchestrator summary"
  echo
  echo "- first_incomplete: \`${FIRST_INCOMPLETE:-none}\`"
  echo "- hard_fail_recorded: $HARD_FAIL"
  echo "- Phase 4F remains FAILED / OPEN / NO-GO until live UI/auth/purchase matrices PASS"
  echo
} >>"$REPORT"

echo "PHASE4F_COMPLETE_WITH_GAPS first_incomplete=${FIRST_INCOMPLETE:-none} hard_fail=$HARD_FAIL"
echo "REPORT=$REPORT"
if [[ $HARD_FAIL -ne 0 ]]; then
  exit 31
fi
exit 0
