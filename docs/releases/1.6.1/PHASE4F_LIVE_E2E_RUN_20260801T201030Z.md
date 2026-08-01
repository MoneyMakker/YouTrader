# Phase 4F live E2E run — 20260801T201030Z

Build required: 1.6.1 (113)
Status discipline: no false PASS · continue independent gates on branch blockers

## Gate `build113` — PASS
1.6.1 113

## Gate `staging_env` — PASS
staging host present in local env

## Gate `prod_host_absent` — PASS
production host absent from local env

## Gate `revenuecat_packages` — PASS
package_count=3 (Weekly/Monthly/Annual)

## Gate `edge_deploy_state` — PASS
staging PI processor unauth=403 trusted ping=pong

## Gate `pi_contracts` — CONTRACT PASS
reaper + piContract selftests

## Gate `recover_simulator` — PASS

## Gate `jdk17_maestro` — PASS
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home · 2.8.0

## Gate `recover_device` — PASS

## Gate `physical_tool_env` — PASS
5:pymobiledevice3_version=10.3.0;6:physical_tool_env_ok;

## Gate `physical_unlock_status` — PASS
DEVICE_UNLOCKED

## Gate `physical_verify113` — PASS
1.6.1 (113) · Metro OFF · embedded bundle

## Gate `physical_screenshot_proof` — LIVE_FAIL
YouTrader foreground screenshot invalid/near-black — see /tmp/yt-pdev-prove-20260801T201030Z.txt. Continuing independent gates.

## Gate `select_target` — NOT_RUN
Physical YouTrader UI evidence gap (black/invalid screenshot); automation cannot assert product UI

## Gate `install_app` — NOT_RUN
Physical YouTrader UI evidence gap (black/invalid screenshot); automation cannot assert product UI

## Gate `onboarding` — NOT_RUN
Physical YouTrader UI evidence gap (black/invalid screenshot); automation cannot assert product UI

## Gate `paywall` — NOT_RUN
Physical YouTrader UI evidence gap (black/invalid screenshot); automation cannot assert product UI

## Gate `weekly_monthly_yearly` — NOT_RUN
Physical YouTrader UI evidence gap (black/invalid screenshot); automation cannot assert product UI

## Gate `post_purchase_auth` — NOT_RUN
Physical YouTrader UI evidence gap (black/invalid screenshot); automation cannot assert product UI

## Gate `journal_stats_calendar` — NOT_RUN
Physical YouTrader UI evidence gap (black/invalid screenshot); automation cannot assert product UI

## Gate `prop_pass` — NOT_RUN
Physical YouTrader UI evidence gap (black/invalid screenshot); automation cannot assert product UI

## Gate `news` — NOT_RUN
Physical YouTrader UI evidence gap (black/invalid screenshot); automation cannot assert product UI

## Gate `settings_isolation` — NOT_RUN
Physical YouTrader UI evidence gap (black/invalid screenshot); automation cannot assert product UI

## Gate `pi_timeout_retry` — NOT_RUN
Physical YouTrader UI evidence gap (black/invalid screenshot); automation cannot assert product UI

## Gate `collect_artifacts` — NOT_RUN
Services OK; gate-specific Maestro physical matrix still outstanding for collect_artifacts

## Gate `final_report` — NOT_RUN
Services OK; gate-specific Maestro physical matrix still outstanding for final_report

## Orchestrator summary

- first_incomplete: `physical_screenshot_proof:LIVE_FAIL`
- hard_fail_recorded: 1
- Phase 4F remains FAILED / OPEN / NO-GO until live UI/auth/purchase matrices PASS

