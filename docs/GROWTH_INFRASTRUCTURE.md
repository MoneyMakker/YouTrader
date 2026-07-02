# Growth Infrastructure Readiness

Last updated: 2026-07-02

This document covers safe free growth and iteration infrastructure for YouTrader `1.5.7` build `72`. These systems are for copy, flags, QA, and OTA discipline only. They must not change RevenueCat product IDs, Supabase security, subscription entitlement IDs, prices, or secrets.

## Current Status

- Firebase Remote Config: readiness only; Firebase SDK is not installed yet.
- Firebase A/B Testing: readiness through Remote Config experiment keys; no experiment is live by default.
- EAS Update OTA: `runtimeVersion` is configured with `policy: appVersion`; `updates.url` and preview/production channels are configured. See `docs/EAS_UPDATE_PLAYBOOK.md`.
- GitHub Actions QA: `.github/workflows/qa.yml` runs typecheck, security check, npm audit, and Expo Doctor.

The app must build and run when Firebase config is missing.

## Firebase Remote Config Readiness

Safe Remote Config keys:

- `paywall_headline`
- `paywall_cta_text`
- `upgrade_button_text`
- `show_trial_offer`
- `show_yearly_discount`
- `show_locked_insight_after_7_trades`
- `show_push_prompt`
- `copy_variant`

Never put these in Remote Config:

- RevenueCat product IDs
- RevenueCat entitlement IDs
- subscription prices
- Supabase URLs/keys beyond already-public publishable values
- service role keys
- private AI keys
- security rules
- upload limits or RLS behavior

Code readiness:

- `src/config/growthConfig.ts` defines safe local defaults and typed experiment keys.
- `loadGrowthConfig()` currently returns local defaults.
- Future Firebase integration should replace only the loading source, not the business rules.
- Missing Firebase must always fall back to defaults.

Manual Firebase setup later:

1. Create or select a Firebase project.
2. Add iOS app with bundle ID `com.youtrader.pro`.
3. Download `GoogleService-Info.plist`.
4. Add Firebase Remote Config through a React Native compatible package only after Expo SDK compatibility is confirmed.
5. Do not commit private local Firebase admin credentials.
6. Keep Remote Config keys limited to safe copy/flags.

## Firebase A/B Testing Readiness

Initial experiment keys:

- `upgrade_button_copy`: `upgrade` vs `go_pro`
- `paywall_plan_order`: `monthly_first` vs `yearly_first`
- `locked_insight_headline`: `hidden_leaks` vs `protect_bad_trade`

Initial experiment ideas:

1. Upgrade button copy:
   - Control: `Upgrade`
   - Variant: `Go Pro`
2. Paywall plan order:
   - Control: monthly first
   - Variant: yearly first
3. Locked insight headline:
   - Control: `Unlock Hidden Leaks`
   - Variant: `Protect One Bad Trade`

Rules:

- Do not run an experiment that changes prices or product IDs.
- Do not hide subscription legal copy.
- Do not remove Restore Purchases.
- Do not make free mode feel blocked everywhere.
- Use PostHog/RevenueCat analytics only with safe metadata.

## Expo Updates OTA Readiness

Current safe config:

```json
"runtimeVersion": {
  "policy": "appVersion"
}
```

Meaning:

- OTA updates are scoped to app version.
- Native/runtime-breaking changes require a new App Store build.
- JavaScript-only fixes can be shipped with EAS Update after a compatible preview/production build is installed and tested.

Safe OTA candidates:

- copy changes
- minor layout fixes
- non-native JavaScript bug fixes
- non-security UI state fixes
- local defaults for safe flags

Do not ship OTA for:

- RevenueCat product ID changes
- entitlement changes
- native dependency changes
- Info.plist permission changes
- iOS build/version changes
- Supabase schema/security changes
- privacy policy/legal requirement changes
- upload/security limit changes

Manual OTA process:

1. Keep `runtimeVersion.policy = appVersion`.
2. Use the `preview` channel for internal QA.
3. Use the `production` channel only after preview QA passes.
4. Never ship native dependency, permission, RevenueCat, Supabase schema, or privacy-label changes OTA.
5. Keep rollback instructions in release notes.

## GitHub Actions QA

Added workflow:

- `.github/workflows/qa.yml`

Checks:

- `npm ci`
- `npm run typecheck`
- `npm run security:check`
- `npm audit --audit-level=high`
- `npx expo-doctor` as an optional/non-blocking check

Notes:

- Existing `.github/workflows/market-intelligence.yml` is unchanged.
- Expo Doctor currently reports the known non-CNG/native-folder warning because `ios/` is present; this should be reviewed before native config changes but should not block documentation-only growth work.
- Playwright MCP is documented for local/Cursor QA, but no Playwright CI job was added because this React Native app has no stable web E2E test suite yet.
- Add Playwright CI only after a deterministic web route/test script exists.

## Release Checklist

Before enabling live Remote Config or OTA:

1. Confirm app still builds with no Firebase config.
2. Confirm Remote Config defaults match product/legal requirements.
3. Confirm A/B test variants preserve Restore Purchases and subscription disclosure.
4. Confirm OTA channel is preview-tested.
5. Run:
   ```bash
   npm run typecheck
   npm run security:check
   npm audit
   npx expo-doctor
   ```
6. Test on real iPhone/TestFlight before production rollout.
