# Working Tree Classification Manifest

Build 113. Non-sensitive. Generated for recovery.

Total paths: **430**

| Class | Count |
|---|---|
| A | 51 |
| B | 2 |
| C | 358 |
| D | 1 |
| E | 5 |
| F | 2 |
| G | 1 |
| H | 10 |

| path | class | feature | verified | action | test | commit target |
|---|---|---|---|---|---|---|
| `eas.json` | A | tooling-config | unverified | careful-review-no-prod | build | eas/ios |
| `ios/YouTrader.xcodeproj/project.pbxproj` | A | tooling-config | unverified | careful-review-no-prod | build | eas/ios |
| `scripts/apply-i18n-final-app.mjs` | A | i18n | unverified | review-commit | translations:check | i18n |
| `scripts/apply-i18n-replacements.mjs` | A | i18n | unverified | review-commit | translations:check | i18n |
| `scripts/i18n-batch-add.mjs` | A | i18n | unverified | review-commit | translations:check | i18n |
| `scripts/translations/de.json` | A | i18n | unverified | review-commit | translations:check | i18n |
| `scripts/translations/es.json` | A | i18n | unverified | review-commit | translations:check | i18n |
| `scripts/translations/fr.json` | A | i18n | unverified | review-commit | translations:check | i18n |
| `scripts/translations/it.json` | A | i18n | unverified | review-commit | translations:check | i18n |
| `scripts/translations/uk.json` | A | i18n | unverified | review-commit | translations:check | i18n |
| `src/api/aiCoach.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `src/api/marketIntelligence.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `src/app/ai/animations.tsx` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `src/app/ai/coachRead.tsx` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `src/app/ai/index.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `src/app/ai/propCoach.tsx` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `src/app/ai/sharedUi.tsx` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `src/app/ai/tradeVision.tsx` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `src/auth/ChangeEmailModal.tsx` | A | auth-ui | unverified | review-commit | auth | auth-loading |
| `src/auth/EmailAuthModal.tsx` | A | auth-ui | unverified | review-commit | auth | auth-loading |
| `src/components/propFirm/PropFirmRiskCoachScreen.tsx` | A | prop-pass-pi | unverified | review-commit | pi | prop-pass |
| `src/components/stats/StatsCharts.tsx` | A | stats-ui | unverified | review-commit | stats | stats |
| `src/components/stats/StatsFocus.tsx` | A | stats-ui | unverified | review-commit | stats | stats |
| `src/components/stats/StatsMetricDashboard.tsx` | A | stats-ui | unverified | review-commit | stats | stats |
| `src/components/stats/StatsMetrics.tsx` | A | stats-ui | unverified | review-commit | stats | stats |
| `src/components/stats/StatsOverview.tsx` | A | stats-ui | unverified | review-commit | stats | stats |
| `src/components/stats/StatsSessionHeatmap.tsx` | A | stats-ui | unverified | review-commit | stats | stats |
| `src/components/stats/index.ts` | A | stats-ui | unverified | review-commit | stats | stats |
| `src/components/stats/radarAxes.ts` | A | stats-ui | unverified | review-commit | stats | stats |
| `src/components/ui/AnimatedEntrance.tsx` | A | ui-primitives | unverified | review-commit | ui | premium-ui |
| `src/components/ui/BottomSheetPanel.tsx` | A | ui-primitives | unverified | review-commit | ui | premium-ui |
| `src/components/ui/premium/AnimatedPressable.tsx` | A | ui-primitives | unverified | review-commit | ui | premium-ui |
| `src/components/ui/premium/PremiumLoadingBar.tsx` | A | ui-primitives | unverified | review-commit | ui | premium-ui |
| `src/components/ui/premium/ShimmerPlaceholder.tsx` | A | ui-primitives | unverified | review-commit | ui | premium-ui |
| `src/components/ui/premium/SkeletonCard.tsx` | A | ui-primitives | unverified | review-commit | ui | premium-ui |
| `src/components/ui/premium/StatusInlineMessage.tsx` | A | ui-primitives | unverified | review-commit | ui | premium-ui |
| `src/components/ui/premium/StatusSpinner.tsx` | A | ui-primitives | unverified | review-commit | ui | premium-ui |
| `src/components/ui/premium/index.ts` | A | ui-primitives | unverified | review-commit | ui | premium-ui |
| `src/config/appConfig.ts` | A | google-oauth | unverified | review-commit | auth | google |
| `src/propPass/PerformanceIntelligenceInternalPanel.tsx` | A | prop-pass-pi | unverified | review-commit | pi | prop-pass |
| `supabase/functions/_shared/aiProvider.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `supabase/functions/_shared/aiSchemas.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `supabase/functions/_shared/marketAiProvider.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `supabase/functions/_shared/marketAiSchemas.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `supabase/functions/_shared/rateLimits.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `supabase/functions/_shared/revenueCatEntitlement.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `supabase/functions/ai-coach/index.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `supabase/functions/market-intelligence/index.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `supabase/functions/prop-os-pi-processor/index.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `supabase/functions/prop-os-recalc-processor/index.ts` | A | ai-cleanup | unverified | review-commit | forbiddenAiCopy | ai/terminology |
| `tsconfig.json` | A | tooling-config | unverified | careful-review-no-prod | build | eas/ios |
| `scripts/qa/stats-more-screenshot-matrix.sh` | B | qa-harness | unverified | review-commit | maestro/selftest | qa |
| `scripts/staging-qa-reset-qa.ts` | B | qa-harness | unverified | review-commit | maestro/selftest | qa |
| `docs/releases/1.6.1/first-launch-evidence/nav_allow_boot.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/first-launch-evidence/vis_00_boot.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/first-launch-evidence/vis_03_screen3_previews.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/first-launch-evidence/vis_04_screen4_prep.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/first-launch-evidence/vis_05_after_prep.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/first-launch-evidence/vis_05_paywall.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/first-launch-evidence/vis_after_failed_reset.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/first-launch-evidence/vis_after_simctl_reset.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/first-launch-evidence/vis_live_now.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/first-launch-evidence/vis_now.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/01_fresh_after_reset.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/02_fresh_onboarding_or_next.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/03_fresh_onboarding.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/04_fresh_paywall.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/05_fresh_auth.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/06_returning_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/10_prop_pass_home.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/11_prop_pass_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/12_pi_live_after_maestro.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/12_pi_panel_open.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/13_pi_after_request.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/14_pi_after_poll.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/15_pi_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/16_pi_insufficient_panel.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/17_pi_after_poll_complete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/20_deny_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/21_deny_no_prop_pass.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/22_deny_stats.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/23_deny_settings.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/24_deny_prop_deeplink.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/30_auth_funnel_after_ok.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/31_auth_funnel_paywall_or_next.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/32_auth_ctas.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/40_cold_install_boot.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/41_cold_after_continue_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/42_cold_live_now.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/43_after_continue2_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/44_auth_fail_step.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/45_after_point_continue.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/46_after_point_continue_wait.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/47_continue_left_try.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/50_paywall_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/51_after_paywall_close_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/52_auth_assert_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/55_plans_auth_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/56_paywall_plans_evidence.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/57_purchase_auth_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/58_after_purchase_point_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/60_storekit_sheet_or_cta.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/61_purchase_cancelled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/70_finish_matrix_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/71_core_login_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/72_core_fail_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/73_after_seed_login_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/74_after_seed_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/75_after_force_allow.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/80_core_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/81_core_stats.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/82_core_calc.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/83_core_proppass.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/84_core_news.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/85_core_calendar.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/86_core_settings.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/90_auth_final_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/91_auth_keychain2_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/92_auth_keychain2_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/RUN_DEVICE_QA.sh` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/after_allow_login_now.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/after_deeplink_s6.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/apple_s6_after_tap.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/apple_s6_auth.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/apple_s6_result.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/auth_after_fix_still_loading.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/auth_after_ok_post_reload.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/auth_apple_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/auth_boot_after_reload.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/auth_providers_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/auth_providers_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/auth_reset_dialog_after_reload.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_auth_ready_fail_20260801T032038Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_auth_ready_fail_20260801T032243Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_auth_ready_fail_20260801T032529Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_auth_ready_fail_20260801T032750Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_auth_ready_fail_20260801T033242Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_auth_ready_fail_20260801T033512Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_auth_ready_fail_20260801T034153Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_auth_ready_fail_20260801T034353Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_auth_ready_ok_20260801T030527Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_email_ok_20260801T012353Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_email_ok_20260801T014122Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_email_ok_20260801T024908Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_email_ok_20260801T033331Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_email_ok_20260801T034539Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_email_ok_20260801T041555Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/bootstrap_email_ok_20260801T041719Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/calc_ready.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/calc_s4.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/calc_s6_final.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/calc_s6_home.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/calc_s6_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/calc_s6b_risk2pct.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/calendar_s5_home.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/calendar_s5_next.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/calendar_s5_prev.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_allow_now.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_c_01.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_cal_01.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_i_01_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_i_03_stats.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_i_04_calc.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_i_05_news.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_i_06_calendar.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_i_07_settings.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_j_01.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_n_01.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_s_01.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/core_set_01.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/deny_manual_00_launch.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/deny_manual_01_after_reset.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/deny_manual_02_after_ok.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/deny_manual_03_pre_deny_login.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/deny_manual_04_after_deny_login.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/deny_manual_advance_1.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/deny_manual_advance_2.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/deny_manual_advance_3.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/deny_manual_advance_4.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/deny_manual_advance_5.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/fresh_funnel_final_state.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/google_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/google_s4_after_tap.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/google_s4_oauth_ui.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/google_s5_account_attempt.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/google_s5_after_continue.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/google_s5_oauth_page.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/google_s6_auth_cta.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/google_s6_oauth_page.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud6_01_created.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud6b2_save_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud6b2_stuck.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud6b3_save_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud6b4_seed_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud6b_00_home.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud6b_01_after_save.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud6c_save_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud_fill_01_form.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud_fill_02_after_save.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud_fill_03_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud_fill_04_stats.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jcrud_fill_05_journal_back.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jedit_01_home.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/jedit_mes_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/journal_after_add_attempt.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/journal_before_crud.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/journal_s4_after_add_tap.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/journal_s4_home.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_after_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_before_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_calendar_after_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_calendar_post_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_delete_dismissed.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_jcrud_after_edit.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_jcrud_calendar.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_jcrud_deleted.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_jcrud_precondition.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_jcrud_seeded.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_jcrud_stats.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_journal_after_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_journal_post_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_journal_ready.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_stats_after_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/lane_a_stats_post_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/metro_watch_reconnect.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeA_00_after_reset.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeA_01_onboarding.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeA_02_paywall_or_auth.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeA_03_auth_ctas.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeA_auth_final.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeA_auth_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeA_auth_live2.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeA_auth_live3.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeA_live_now.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeA_post_maestro.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeA_pre_maestro.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeB_01_main.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeB_02_prop_pass.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeB_03_prop_pass_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeC_01_main.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeC_02_stats.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/modeC_03_settings.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/news_s5_home.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/news_s5_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_after_close_attempts.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_after_cta_point.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_auth_final_paywall.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_before_purchase.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_cold_00.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_cold_after_dismiss.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_cold_onboarding.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_core_calc.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_core_calendar.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_core_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_core_news.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_core_prep.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_core_proppass.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_core_settings.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_core_stats.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_deny_00_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_deny_01_no_prop_pass_tab.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_deny_02_stats.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_deny_03_settings.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_deny_04_after_prop_deeplink.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_fresh_00_after_reset.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_fresh_auth.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_fresh_final.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_fresh_onboarding.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_fresh_paywall.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_monthly_tapped.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_paywall_before_close.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_paywall_plans_full.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_paywall_preclose.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_paywall_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_pi_00_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_pi_01_prop_pass_home.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_pi_02_panel_open.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_pi_03_after_request.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_pi_04_after_poll.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_pi_05_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_pi_06_completed_panel.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_pi_07_after_rerequest_poll.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_pi_08_completed_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_post_close_attempt.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_pre_cta_point.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_purchase_cancelled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_returning_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_returning_prop_pass.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/phase4f_returning_prop_pass_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/pi_home_deeplink.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/pi_m_01_home.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/pi_m_02_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/pi_m_03_after_request.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/pi_semantic_snapshot_current.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/pi_semantic_ui.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/qa_deeplink_login_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/returning_prop_pass_final_state.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s10_calc_decimal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s10_calc_invalid_symbols.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s10_calc_large.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s10_calc_neg_balance.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s10_calc_reset_after_error.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s10_calc_small_stop.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s10_calc_valid.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s10_calc_zero_balance.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s10_google_after_continue.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s10_reset_debug.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_after_openurl_reset_auth.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_life_FAIL_S11-041555.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_life_after_delete_cancel.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_life_calendar_after_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_life_calendar_after_edit.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_life_calendar_before_edit.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_life_precondition.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_reset_auth_FAIL_20260801T035947Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_reset_fresh_FAIL_20260801T035947Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_reset_paywall_FAIL_20260801T035947Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_reset_returning-allow_FAIL_20260801T035947Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s11_reset_returning-deny_FAIL_20260801T035947Z.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s12_rc_after_cta.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s12_rc_live_now.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s12_rc_monthly_result.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s12_rc_monthly_selected.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s12_rc_paywall.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s4_current_ui.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_calc_open.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_after_delete_cancel.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_after_relaunch.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_calendar_after_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_calendar_after_edit.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_calendar_before_edit.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_delete_sheet.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_journal_after_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_journal_after_edit.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_journal_create.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_precondition.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_stats_after_delete.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_stats_after_edit.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s8_life_stats_before_edit.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_auth_ready.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_calc_after_reset.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_calc_invalid_amount.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_calc_journal_fail.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_calc_valid_maxrisk.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_calc_valid_result.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_calc_zero_stop.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_google_after_continue.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_google_after_tap.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_google_aswebauth.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_google_precondition.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_manual_after_reset_cold.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/s9_manual_reset_sleep8.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/settings_s4.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/sim_now.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/simctl_launch2.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/simctl_launch_ui.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/stats_populated.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/stats_s4_after_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/stats_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/step-013-assertCondition-Continue_with_Apple.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/step-067-assertCondition-Journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/storekit_after_buy_live.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/storekit_after_rerun.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/storekit_after_xcode_run.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/storekit_live_now.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/storekit_now2.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/phase4f-screenshots/storekit_xcode_launch_ui.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/qa-logs/bootstrap-email-precondition-20260801T012353Z.json` | C | qa-reports | unverified | review-commit | docs | — |
| `docs/releases/1.6.1/qa-logs/bootstrap-email-precondition-20260801T014122Z.json` | C | qa-reports | unverified | review-commit | docs | — |
| `docs/releases/1.6.1/qa-logs/bootstrap-email-precondition-20260801T024908Z.json` | C | qa-reports | unverified | review-commit | docs | — |
| `docs/releases/1.6.1/qa-logs/bootstrap-email-precondition-20260801T033331Z.json` | C | qa-reports | unverified | review-commit | docs | — |
| `docs/releases/1.6.1/qa-logs/bootstrap-email-precondition-20260801T034539Z.json` | C | qa-reports | unverified | review-commit | docs | — |
| `docs/releases/1.6.1/qa-logs/bootstrap-email-precondition-20260801T041555Z.json` | C | qa-reports | unverified | review-commit | docs | — |
| `docs/releases/1.6.1/qa-logs/bootstrap-email-precondition-20260801T041719Z.json` | C | qa-reports | unverified | review-commit | docs | — |
| `docs/releases/1.6.1/qa-logs/bootstrap-email-precondition-20260801T051328Z.json` | C | qa-reports | unverified | review-commit | docs | — |
| `docs/releases/1.6.1/simulator-recovery/03_fresh_onboarding.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/04_fresh_paywall.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/05_fresh_auth.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/10_prop_pass_home.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/allowlisted-after-tab-walk.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/allowlisted-main-after-walk.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/allowlisted-restored-main.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-after-allow-login.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-after-deeplink-reset.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-allow-login-attempt.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-boot-1.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-boot-2.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-boot-3.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-boot-4.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-boot-5.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-boot-6.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-boot-7.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-boot-8.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-env-fixed.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-funnel-after-reset.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-metro-1.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-post-email-login.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-qa-capture-late.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-qa-capture-mid.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/debug-staging-warm-auth.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/device-qa-captures/phase_main.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/device-qa-captures/tab_calc.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/device-qa-captures/tab_calendar.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/device-qa-captures/tab_journal.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/device-qa-captures/tab_news.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/device-qa-captures/tab_propPass.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/device-qa-captures/tab_settings.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/funnel-after-reset.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/phase4f_returning_prop_pass_scrolled.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/simulator-recovery/prop-pass-home-with-snapshot.png` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `docs/releases/1.6.1/stats-redesign-evidence/` | C | qa-evidence | unverified | preserve-selective-commit | manual-device | docs commit |
| `build/` | D | generated-build | unverified | exclude-never-commit | — | — |
| `.codex/` | E | local-tooling | unverified | exclude-or-keep-local | — | — |
| `.cursor/mcp.json` | E | local-docs-tooling | unverified | exclude-or-separate | — | — |
| `.cursor/plans/` | E | local-tooling | unverified | exclude-or-keep-local | — | — |
| `AGENTS.md` | E | local-docs-tooling | unverified | exclude-or-separate | — | — |
| `docs/MY_UI.md` | E | local-docs-tooling | unverified | exclude-or-separate | — | — |
| `docs/releases/1.6.1/SIM_EMAIL_PASSWORD_UNIT.txt` | F | secrets | unverified | secure-relocate-or-ignore | — | — |
| `src/auth/ChangePasswordModal.tsx` | F | secrets | unverified | secure-relocate-or-ignore | — | — |
| `scripts/start-metro-staging.sh.bak` | G | obsolete-or-accidental | unverified | exclude | — | — |
| `scripts/calculator-risk-qa.ts` | H | incomplete-wip | unverified | preserve-until-verified | typecheck | — |
| `scripts/pi-timeout-reaper-qa.ts` | H | incomplete-wip | unverified | preserve-until-verified | typecheck | — |
| `src/app/styles.ts` | H | incomplete-wip | unverified | preserve-until-verified | typecheck | — |
| `src/app/theme.ts` | H | app-extract-wip | unverified | preserve | typecheck | — |
| `src/app/ui/` | H | app-extract-wip | unverified | preserve | typecheck | — |
| `src/app/utils/` | H | app-extract-wip | unverified | preserve | typecheck | — |
| `src/components/traderStatus/TraderStatusDashboard.tsx` | H | incomplete-wip | unverified | preserve-until-verified | typecheck | — |
| `src/config/growthConfig.ts` | H | incomplete-wip | unverified | preserve-until-verified | typecheck | — |
| `src/lib/startupPerf.ts` | H | incomplete-wip | unverified | preserve-until-verified | typecheck | — |
| `supabase/migrations/20260731290000_prop_os_pi_timeout_reaper.sql` | H | db-migration-wip | unverified | preserve-no-prod-apply | migration | — |
