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
3. Create in-app subscriptions: `pro_monthly` and `pro_yearly`.
4. Connect App Store products to RevenueCat offering.
5. Create a Supabase project and set `EXPO_PUBLIC_SUPABASE_URL` plus `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the release build.
6. Run the SQL in `supabase/risk-coach-schema.sql` inside the Supabase SQL editor to create prop firm, journal and risk snapshot tables with RLS.
7. Enable Google and Apple providers in Supabase Auth.
8. Add `com.youtrader.pro://auth` to Supabase Auth redirect URLs.
9. For local device testing, Apple login uses the Supabase browser OAuth fallback and does not require the Sign in with Apple entitlement.
10. Before App Store submission, enable Sign in with Apple for bundle id `com.youtrader.pro` in Apple Developer if you want native Apple sign-in.
11. Then restore `ios.usesAppleSignIn: true`, add `expo-apple-authentication` to plugins, add `com.apple.developer.applesignin` to entitlements and set `EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN=true`.
12. Log in to Expo/EAS:

```bash
NPM_CONFIG_CACHE=/private/tmp/youtrader-npm-cache npx eas-cli@latest login
```

13. Link the project to EAS:

```bash
NPM_CONFIG_CACHE=/private/tmp/youtrader-npm-cache npx eas-cli@latest init
```

14. Build and upload to App Store Connect/TestFlight:

```bash
NPM_CONFIG_CACHE=/private/tmp/youtrader-npm-cache npx eas-cli@latest build -p ios --profile production --auto-submit
```

15. Test purchases, Google sign-in, Apple sign-in, Face ID, push notification permission, screenshots, voice notes and the Prop Firm Risk Coach in TestFlight.
16. Submit for App Review.
