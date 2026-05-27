# YouTrader 1.3.1 Final Build Steps

Use a folder with no spaces, for example: `~/Desktop/youtrader-final`.

## Test on iPhone

```bash
cd ~/Desktop/youtrader-final
npm install
npx expo prebuild --clean
npx expo run:ios --device
```

## Release build for local iPhone testing without Metro

```bash
npx expo run:ios --device --configuration Release
```

## iPad support

This version has `ios.supportsTablet: true` in `app.json`, so the same app supports iPhone and iPad.

## App Store release path

1. Enroll Apple Developer Program.
2. Create app in App Store Connect with bundle id `com.youtrader.pro`.
3. Create in-app subscriptions in App Store Connect: `pro_monthly` and `pro_yearly`.
4. Create a RevenueCat project, connect the iOS app, import both App Store products, create entitlement `pro`, attach the products to it, and create the default/current offering with monthly and yearly packages.
5. Copy `.env.example` to `.env` and fill:

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_YOUR_PUBLIC_REVENUECAT_KEY
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_YOUR_PUBLIC_REVENUECAT_KEY
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro
EXPO_PUBLIC_OWNER_FULL_ACCESS=false
```

For owner/testing builds only, set `EXPO_PUBLIC_OWNER_FULL_ACCESS=true` to unlock all Pro features without a purchase.

6. For EAS production builds, add the same values as EAS environment variables/secrets.
7. Create a Supabase project and set `EXPO_PUBLIC_SUPABASE_URL` plus `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the release build.
8. Run the SQL in `supabase/risk-coach-schema.sql` inside the Supabase SQL editor to create prop firm, journal, Cloud Sync and risk snapshot tables with RLS.
   - `trade_journal.client_id` keeps the same trade ID across devices.
   - `deleted_at` is used for safe cross-device delete sync.
   - Realtime is enabled for `trade_journal` when the project allows it.
9. Enable Google and Apple providers in Supabase Auth.
10. Add `com.youtrader.pro://auth` to Supabase Auth redirect URLs.
11. For local device testing, Apple login uses the Supabase browser OAuth fallback and does not require the Sign in with Apple entitlement.
12. Before App Store submission, enable Sign in with Apple for bundle id `com.youtrader.pro` in Apple Developer if you want native Apple sign-in.
13. Then restore `ios.usesAppleSignIn: true`, add `expo-apple-authentication` to plugins, add `com.apple.developer.applesignin` to entitlements and set `EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN=true`.
14. Log in to Expo/EAS:

```bash
NPM_CONFIG_CACHE=/private/tmp/youtrader-npm-cache npx eas-cli@latest login
```

15. Link the project to EAS:

```bash
NPM_CONFIG_CACHE=/private/tmp/youtrader-npm-cache npx eas-cli@latest init
```

16. Build and upload to App Store Connect/TestFlight:

```bash
NPM_CONFIG_CACHE=/private/tmp/youtrader-npm-cache npx eas-cli@latest build -p ios --profile production --auto-submit
```

17. Test purchases and restore in TestFlight with a sandbox Apple account. Confirm that buying monthly/yearly unlocks unlimited journal, Cloud Sync, advanced news sentiment and full Stats.
18. Test Cloud Sync on two devices: sign in to the same account, add a trade on device A, open device B, press Sync Now in Settings and confirm the trade appears. Then delete it on one device and confirm it disappears on the other.
19. Test Google sign-in, Apple sign-in, Face ID, push notification permission, screenshots, voice notes and the Prop Firm Risk Coach in TestFlight.
20. Submit for App Review.
