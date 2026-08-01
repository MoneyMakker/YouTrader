#!/usr/bin/env bash
# Phase 4F live E2E orchestrator — resumes from first incomplete gate.
# Never invents PASS. Stops on external/environment blockers.
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

gates=(
  build113
  staging_env
  prod_host_absent
  revenuecat_packages
  edge_deploy_state
  recover_simulator
  recover_device
  select_target
  install_app
  onboarding
  paywall
  weekly_monthly_yearly
  post_purchase_auth
  journal_stats_calendar
  prop_pass
  news
  settings_isolation
  pi_timeout_retry
  collect_artifacts
  final_report
)

write_report_header() {
  {
    echo "# Phase 4F live E2E run — $STAMP"
    echo
    echo "Build required: $EXPECTED_VERSION ($EXPECTED_BUILD)"
    echo "Status discipline: no false PASS"
    echo
  } >"$REPORT"
}

gate_fail() {
  local gate="$1" reason="$2" status="${3:-FAIL}"
  echo "## Gate \`$gate\` — $status" >>"$REPORT"
  echo "$reason" >>"$REPORT"
  echo
  echo "PHASE4F_GATE_STOP gate=$gate status=$status"
  echo "REPORT=$REPORT"
  # Persist resume pointer
  printf '{"stamp":"%s","stopped_at":"%s","status":"%s"}\n' "$STAMP" "$gate" "$status" >"$STATE"
  case "$status" in
    EXTERNAL_ACCESS_BLOCKER) exit 30 ;;
    ENVIRONMENT_BLOCKER) exit 31 ;;
    NOT_RUN) exit 32 ;;
    *) exit 1 ;;
  esac
}

gate_pass() {
  local gate="$1" note="${2:-}"
  echo "## Gate \`$gate\` — PASS" >>"$REPORT"
  [[ -n "$note" ]] && echo "$note" >>"$REPORT"
  echo >>"$REPORT"
}

write_report_header

# --- Gate: build113 ---
ver="$(node -e "const a=require('./app.json');process.stdout.write(a.expo.version+' '+a.expo.ios.buildNumber)")"
if [[ "$ver" != "$EXPECTED_VERSION $EXPECTED_BUILD" ]]; then
  gate_fail build113 "Expected $EXPECTED_VERSION $EXPECTED_BUILD, got $ver"
fi
gate_pass build113 "$ver"

# --- Gate: staging_env ---
if ! rg -q "$STAGING_MARKER" .env .env.local 2>/dev/null; then
  gate_fail staging_env "Staging host marker absent from local env files"
fi
gate_pass staging_env "staging host present in local env"

# --- Gate: prod_host_absent ---
if rg -q "$PROD_MARKER" .env .env.local 2>/dev/null; then
  gate_fail prod_host_absent "Production host marker present in local env"
fi
gate_pass prod_host_absent "production host absent from local env"

# --- Gate: revenuecat_packages ---
set +e
node --import tsx scripts/qa/revenuecat-offering-audit-staging.ts >"/tmp/yt-rc-audit-$STAMP.txt" 2>&1
rc=$?
set -e
if [[ $rc -ne 0 ]]; then
  gate_fail revenuecat_packages "Weekly missing or offering incomplete — see RC operator handoff" EXTERNAL_ACCESS_BLOCKER
fi
gate_pass revenuecat_packages "package_count=3"

# --- Gate: edge_deploy_state ---
echo "## Gate \`edge_deploy_state\` — NOT RUN (manual staging deploy)" >>"$REPORT"
echo "Use docs/releases/1.6.1/PI_STAGING_DEPLOYMENT_HANDOFF.md. Code is committed; live deploy not asserted." >>"$REPORT"
echo >>"$REPORT"
# Continue — edge deploy is parallel track, not hard-stop for sim recovery
printf '{"stamp":"%s","note":"edge_deploy_state NOT RUN"}\n' "$STAMP" >"$STATE"

# --- Gate: recover_simulator ---
set +e
bash scripts/qa/recover-apple-simulator-services.sh >"/tmp/yt-sim-$STAMP.txt" 2>&1
sim_rc=$?
set -e
if [[ $sim_rc -ne 0 ]]; then
  gate_fail recover_simulator "CoreSimulator unavailable (exit $sim_rc)" ENVIRONMENT_BLOCKER
fi
gate_pass recover_simulator

# --- Gate: recover_device ---
set +e
bash scripts/qa/recover-physical-device-services.sh >"/tmp/yt-dev-$STAMP.txt" 2>&1
dev_rc=$?
set -e
if [[ $dev_rc -ne 0 ]]; then
  gate_fail recover_device "CoreDevice unavailable (exit $dev_rc)" ENVIRONMENT_BLOCKER
fi
gate_pass recover_device

# Remaining gates require live services — mark NOT RUN if somehow reached without implementation hooks
for g in select_target install_app onboarding paywall weekly_monthly_yearly post_purchase_auth journal_stats_calendar prop_pass news settings_isolation pi_timeout_retry collect_artifacts final_report; do
  gate_fail "$g" "Live runner reached beyond recovery without device automation hooks wired for this host — resume after services PASS" NOT_RUN
done
