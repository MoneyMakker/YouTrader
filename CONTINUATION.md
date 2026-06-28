# Continuation Notes

This is the short takeover checklist for the next senior engineer.

## Highest Priority Tasks

1. Manually test the latest iOS 26 visual polish on iPhone and iPad.
   - Journal calendar sizing, white month title, no `Edge Is Showing`.
   - Stats contains premium `Performance Profile` radar.
   - Heatmap cells are readable and selected detail opens.
   - Trader Status achievements are pressable and share card exports correctly.
   - AI Analytics refresh shows useful updated advice and timestamp.
   - `Protect Pass Path` opens the detail bottom sheet.
   - News no longer shows `Explain with AI`.

2. Verify RevenueCat setup before the next App Store/TestFlight upload.
   - Monthly product: `youtrader_pro_monthly`.
   - Yearly product: `youtrader_pro_yearly`.
   - Both products unlock the same entitlement.
   - Confirm entitlement ID matches env, app code, RevenueCat dashboard, and Supabase Edge Function.
   - Confirm both packages are in the current/default RevenueCat offering.

3. Resolve release/build hygiene.
   - Decide whether to accept or fix the `expo-doctor` non-CNG warning.
   - Align `package.json` version with `app.json` if desired.
   - Do not commit `.ipa` artifacts or backup folders.

4. Create/verify SQL migrations for inferred Supabase tables.
   - `trade_journal`
   - `prop_firms`
   - `user_subscriptions`
   - `achievement_share_usage`
   - Keep RLS strict by `auth.uid()`.

## Unfinished Tasks

- Manual UI QA is still needed after latest polish.
- No simulator/TestFlight screenshots were verified in this session.
- Formal SQL migrations are incomplete except `ai_usage_events`.
- `App.tsx` remains very large and should eventually be split.
- `DailyCoachCard` code may still exist but is no longer rendered.
- AI News Explainer API still exists but News UI intentionally no longer exposes it.
- `expo-doctor` still has one non-CNG/native-folder warning.

## Next Logical Implementation Order

1. Run the app locally on iPhone simulator.
2. Run the app locally on iPad simulator.
3. Fix any visual/runtime regressions from `App.tsx` polish.
4. Verify achievement share card capture on device/simulator.
5. Verify RevenueCat sandbox purchase/restore for monthly and yearly.
6. Verify Supabase auth and Pro cloud sync.
7. Add missing Supabase SQL migrations with RLS.
8. Run:
   - `npm run typecheck`
   - `npx expo-doctor`
9. Only after QA, prepare a clean release build.

## Files That Must Be Edited Next

Most likely:

- `App.tsx`
  - Fix any UI regressions from visual polish.
  - Continue extracting oversized components later.

- `supabase/*.sql` or a new migrations folder
  - Add formal schemas/RLS for inferred tables.

- `src/config/appConfig.ts`
  - Only if RevenueCat entitlement/product env alignment needs changes.

- `app.json`
  - Only if release version/build config changes are needed.

- `package.json`
  - Only if version alignment or script changes are needed.

Possible later extraction targets:

- `src/components/stats/`
- `src/components/ai/`
- `src/screens/`

## Possible Risks

- RevenueCat entitlement mismatch: code default is `pro`, earlier notes referenced `YouTrader Pro`.
- `expo-doctor` non-CNG warning means native `ios/` config may not reflect `app.json` changes automatically.
- Root folder contains many untracked `.ipa` files and backups; accidental commit risk is high.
- Missing SQL/RLS migrations for several tables could break new Supabase environments.
- Large `App.tsx` makes regressions easy during UI changes.
- AI quota/server entitlement depends on `user_subscriptions`; if that table or entitlement ID is wrong, Pro cloud AI may fall back/free-preview incorrectly.
- Achievement sharing depends on `react-native-view-shot`, sharing availability, and offscreen render timing.

## Current Blockers

- No current TypeScript blocker: `npm run typecheck` passes.
- No current code blocker from `expo-doctor`; only the non-CNG warning remains.
- Manual device/simulator verification is still missing.
- Supabase production schema completeness is not fully represented in repo migrations.
- RevenueCat dashboard/App Store Connect configuration must be verified outside code.

## Assumptions That Should NOT Be Changed

- Do not rewrite business logic during visual polish.
- Do not change RevenueCat purchase/restore/pro entitlement logic unless specifically fixing subscription setup.
- Do not change Supabase auth/session/cloud sync behavior without a focused plan.
- Do not expose `NVIDIA_API_KEY` or any private server key in the mobile app.
- Do not call NVIDIA directly from React Native.
- Keep NVIDIA behind Supabase Edge Functions with local fallback.
- Do not remove local fallback AI.
- Do not add heavy native dependencies without explicit approval.
- Keep free users able to see basic working value.
- Keep advanced AI/stats/export/sync as Pro-gated where already designed.
- Keep AI output educational: no financial advice, no buy/sell signals, no market direction prediction.
- Keep visual direction premium Apple/iOS 26/Liquid Glass, not cyberpunk/gamer/crypto/neon.
