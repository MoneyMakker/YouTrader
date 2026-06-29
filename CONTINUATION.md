# Continuation Notes

This is the short takeover checklist for the next senior engineer.

## Recently Completed (2026-06-28)

- Confirmed current working baseline is `/Users/valentynborovyk/Projects/youtrader-final`, matching YouTrader `1.5.7` build `64` / `build-1782614005662.ipa`; do not use the older `2026-05-23` Codex folder as a source.
- Removed AI Confidence and unified Refresh Analysis from AI Analytics.
- Fixed Evaluation/Funded account plan so each mode renders its own data with no "Switch to Funded" prompt.
- Restored premium Trader Status achievements inside AI Analytics/Funded flow.
- Updated achievement share limits to monthly Free 5 / Pro 15, with Free unlocked cards capped at 5 before upgrade messaging.
- Added monthly AI allowance handling and server-side quota messaging for Pro AI features.
- Added Photos add permission and safer save-to-library handling.
- Redesigned P&L card and Monthly PDF exports with premium YouTrader branding.
- Moved Journal scroll cue slightly higher.

## Previously Completed (2026-06-27)

- Created `PRODUCT_VISION.md` as the long-term product direction doc.
- Stats screen reordered: Equity Curve → Stats Dashboard → Trading Radar → Heatmap.
- Removed Eval Account / Funded controls and Trader Status from Stats.
- AI Analytics reordered and de-duplicated; renamed Expandable Report → Performance Intelligence.
- Moved Eval Account + Funded panel into AI Analytics.
- Journal scroll hint replaced with subtle centered glass chevron.
- Calendar header and Refresh button removed; compact top layout.
- Performance: removed duplicate analytics work from Stats render path; memoized AI trading score.

## Highest Priority Tasks

1. Manually test the latest iOS 26 visual polish on iPhone and iPad.
   - Journal: subtle scroll cue below calendar, trades list readable.
   - Stats order: Equity → Dashboard → Radar → Heatmap; no Eval Account block.
   - AI Analytics order: Eval Account → Eval → Coaching → Signal Timeline → Performance Intelligence → Evaluation/Funded → Trader Status.
   - Calendar: no empty top gap, events load without manual refresh button.
   - Achievement share works from Trader Status and respects monthly limits.

2. Verify RevenueCat setup before the next App Store/TestFlight upload.
   - Monthly product: `youtrader_pro_monthly`.
   - Yearly product: `youtrader_pro_yearly`.
   - Both products unlock the same entitlement.
   - Confirm entitlement ID matches env, app code, RevenueCat dashboard, and Supabase Edge Function.
   - Confirm both packages are in the current/default RevenueCat offering.

3. Resolve release/build hygiene.
   - Decide whether to accept or fix the `expo-doctor` non-CNG warning.
   - Do not commit `.ipa` artifacts or backup folders.

4. Deploy/verify Supabase migrations in the target project.

## Unfinished Tasks

- Manual UI QA is still needed after latest screen reordering.
- `App.tsx` remains very large and should eventually be split into `src/components/stats`, `src/components/ai`, and `src/screens`.
- Aikido MCP token may still need re-auth for successful scans.
- `expo-doctor` still has one non-CNG/native-folder warning.

## Next Logical Implementation Order

1. Run the app locally on iPhone simulator.
2. Run the app locally on iPad simulator.
3. Fix any visual/runtime regressions from screen reordering.
4. Verify RevenueCat sandbox purchase/restore for monthly and yearly.
5. Verify Supabase auth and Pro cloud sync when re-enabled.
6. Run:
   - `npm run typecheck`
   - `npx expo-doctor`
7. Only after QA, prepare a clean release build.

## Files That Must Be Edited Next

Most likely:

- `App.tsx` — continue extracting terminal components after QA stabilizes.
- `supabase/migrations/` — verify/deploy runtime schema.
- `src/config/appConfig.ts` — only if RevenueCat env alignment needs changes.

Possible later extraction targets:

- `src/components/stats/`
- `src/components/ai/`
- `src/screens/`

## Possible Risks

- Stats no longer shows Trader Status achievements; they are exposed from AI Analytics/Funded flow.
- Funded mode in AI Analytics uses AsyncStorage key `prop-risk-mode-v1` shared with prop calculator.
- Large `App.tsx` makes regressions easy during UI changes.
- Aikido scan can fail with invalid token until re-authenticated.

## Assumptions That Should NOT Be Changed

- Do not rewrite business logic during visual polish.
- Do not change RevenueCat purchase/restore/pro entitlement logic unless specifically fixing subscription setup.
- Do not expose `NVIDIA_API_KEY` or any private server key in the mobile app.
- Keep NVIDIA behind Supabase Edge Functions with local fallback.
- Keep free users able to see basic working value.
- Keep AI output educational: no financial advice, no buy/sell signals, no market direction prediction.
- Keep visual direction premium Apple/iOS 26/Liquid Glass, not cyberpunk/gamer/crypto/neon.
- Every metric must have one source of truth in `tradeMetrics.ts` / `calcStats()`.

## Market Intelligence Follow-Up (2026-06-28)

- Worker supports scheduled cached jobs for news, prop firms, calendar, daily brief, watchlist, and summary.
- Calendar now falls back to deterministic high-impact macro events when `ECONOMIC_CALENDAR_JSON_URL` is missing or empty.
- GitHub Actions workflow `.github/workflows/market-intelligence.yml` runs the worker without paid hosting.
- News / Market Intelligence screen reads all cached Supabase tables read-only and does not expose worker triggers.
- Required GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Optional: `ECONOMIC_CALENDAR_JSON_URL`.
- Next QA: verify scheduled workflow logs in GitHub Actions and confirm Supabase row counts after the first cron run.

## Security Hardening Notes

- Never paste service role keys, private API tokens, Apple signing keys, or full `.env` files into AI chats/prompts.
- Never put `SUPABASE_SERVICE_ROLE_KEY` or private AI keys into `EXPO_PUBLIC_*` env variables.
- Never run destructive database commands against production without human review.
- Never give AI agents unrestricted production access; prefer scoped, reviewed secrets and read-only access where possible.
- Run `npm run security:check` and `npm run typecheck` before release.

## Release Polish Follow-Up (2026-06-29)

- Current release polish was applied incrementally on `/Users/valentynborovyk/Projects/youtrader-final`.
- Do not reintroduce Market Intelligence blocks into the News tab; News should remain readable source-linked headline cards.
- AI Analytics owns cached Market Intelligence plus the consolidated Prop Firm Coach.
- Prop Firm Coach replaces the previous duplicate Eval and Evaluation/Funded blocks in the rendered AI Analytics flow.
- Stats export visuals use `src/components/insights/exportDesign.ts` as the shared branding source.
- Before release, manually QA Share P&L, Save image to Photos, Monthly PDF, News tap-through, AI Analytics Prop Firm Coach, Radar color, Heatmap colors, and Journal scroll cue on device.
