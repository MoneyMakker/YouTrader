# YouTrader App Store Prompt

Use this prompt for App Store, TestFlight, release notes, metadata, build readiness, review notes, privacy, encryption, or release QA.

## Current Release Context

- Current target version/build: `1.5.8 (90)`.
- Bundle identifier: `com.youtrader.pro`.
- App Store rule: never lower or reuse an iOS build number.
- Do not change version/build unless explicitly requested.

## Rules

- Preserve existing React Native + Expo + TypeScript architecture.
- Maintain Expo compatibility.
- Do not change bundle id, app scheme, EAS project id, Apple sign-in, RevenueCat, Supabase schema, or auth unless explicitly requested.
- Maintain i18n for App Store-facing and in-app user-facing text.
- Keep copy truthful: no financial advice, no profit guarantees, no market prediction promises.
- Keep privacy language consistent with the app: trading journal, analytics, optional cloud sync, subscriptions, AI coaching.

## Required QA

Run before final status:

```bash
npm run typecheck
npm run translations:check
expo export --platform ios
```
