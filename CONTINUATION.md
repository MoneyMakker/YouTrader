# Continuation Notes

This is the short takeover checklist for the next senior engineer.

## Recently Completed (2026-06-27)

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
   - AI Analytics order: Eval Account → Eval → Coaching → Signal Timeline → Performance Intelligence → AI Confidence → Funded.
   - Calendar: no empty top gap, events load without manual refresh button.
   - Achievement share still works if re-exposed elsewhere later.

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

- Stats no longer shows Trader Status achievements; confirm product intent before re-adding elsewhere.
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
