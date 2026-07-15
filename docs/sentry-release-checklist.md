# Sentry Release Checklist

Use this checklist before and after a local Xcode archive for YouTrader.

## Current Release Format

- App version: `1.5.8`
- iOS build: `91`
- Sentry release format: `YouTrader@1.5.8+91`
- Sentry dist: `91`
- Environment comes from app runtime config and should resolve to `production`, `staging`, or `development`.

## Before Archive

1. Run the release stability check:

   ```sh
   npm run release:stability
   ```

2. Confirm Sentry DSN is present only in local environment or native build configuration, not committed secrets.
3. Confirm the release name in startup events includes the app version and build.
4. Confirm users are identified in Sentry only by non-sensitive user id after login.
5. Confirm no trade journal details, account balances, notes, or private analytics payloads are attached to Sentry user context.

## Source Maps

For Expo/React Native, source map upload depends on the final local build pipeline and Sentry CLI configuration.

Recommended checks:

1. Confirm `@sentry/react-native` is configured.
2. Confirm the Sentry Expo plugin remains in `app.json`.
3. After creating the local archive, verify Sentry shows release `YouTrader@1.5.8+91`.
4. If using Sentry CLI locally, upload source maps for the exact release and dist:

   ```sh
   npx sentry-cli releases files YouTrader@1.5.8+91 list
   ```

5. If upload is not configured, keep the release visible in Sentry and use unsymbolicated events only for high-level crash triage until source maps are wired.

## After TestFlight Upload

1. Install the TestFlight build on a physical iPhone.
2. Launch the app from a cold start.
3. Verify no permanent black screen.
4. Sign in and confirm Sentry user context is set only to the user id.
5. Open Journal, Stats, AI, News, Calendar, Settings, and Paywall.
6. Check Sentry for new events under `YouTrader@1.5.8+91`.

## Warnings That Are Usually Not Blocking

- dSYM upload warnings during App Store Connect upload.
- Missing source map warnings if the app runs correctly and Sentry release tracking is visible.
- Low-volume non-fatal network errors caused by offline devices or simulator-only behavior.

## Errors That Must Be Fixed

- Cold-start crashes.
- Permanent black screen.
- Auth hydration never completing.
- RevenueCat initialization throwing an uncaught render error.
- Sentry events containing sensitive user trade data.
- Any crash reproduced on a physical TestFlight device.
