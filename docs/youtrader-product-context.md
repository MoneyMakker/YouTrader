# YouTrader Product Context

## What YouTrader Is

YouTrader is a premium Expo React Native TypeScript trading journal and analytics app for futures and prop-firm traders. It focuses on disciplined trade journaling, deterministic analytics, risk awareness, AI-assisted review, premium share/export experiences, and trader development.

YouTrader is not a trade-signal app, market-prediction product, crypto dashboard, or profit-guarantee tool. It must avoid financial advice, buy/sell/hold instructions, market direction predictions, and pass-or-profit guarantees.

## Main Features

- Trade journal with screenshots, media notes, voice notes, tags, setups, emotions, and session context.
- Calendar and P&L tracking for daily review.
- Stats and analytics derived from journaled trades.
- Trader status, career progress, achievements, and premium share cards.
- AI Analytics and coaching as an interpretation layer over user data.
- News, market intelligence, and daily brief surfaces where supported.
- Prop-firm oriented workflows such as risk awareness, consistency, and survival-path review.
- Calculator and planning tools for practical trading workflows.
- Settings, account, subscription, notification, and app readiness surfaces.

## Target Users

- Futures traders who journal their trades.
- Prop-firm challenge and funded-account traders.
- Traders who need risk discipline, consistency review, and post-session analysis.
- Serious mobile-first users who expect premium iOS-quality interactions and clear, compact information.

## Design System

- Visual direction: premium dark iOS fintech terminal with calm glassy surfaces, high readability, and disciplined information density.
- Green means positive, profit, or safe buffer.
- Red means loss, risk, or danger.
- Purple is the premium accent for selected states, AI, and secondary emphasis.
- UI work should reuse existing components and patterns.
- Do not duplicate UI logic or create parallel design systems.
- Animations should target 60 FPS and use lightweight transforms and opacity where possible.
- User-facing strings must stay i18n-ready.

## Architecture And Compatibility

- React Native + Expo + TypeScript.
- Expo compatibility is required.
- Preserve the existing app architecture and navigation/state model unless a focused refactor is explicitly requested.
- Do not add heavy native dependencies without approval.
- Required QA after changes:

```bash
npm run typecheck
npm run translations:check
expo export --platform ios
```

## Supabase Usage

Supabase is used for auth, optional cloud sync, Edge Functions, quotas, server-side Pro entitlement support, and server-side AI routing. Private AI provider keys and service role keys must never be exposed in the mobile app.

Do not change Supabase schema, migrations, RLS, Edge Functions, quotas, or cloud sync behavior unless explicitly requested.

## RevenueCat Usage

RevenueCat is the subscription and purchase provider. It handles purchase and restore flows, product/entitlement state, and Pro access integration.

Do not change RevenueCat product IDs, entitlement IDs, subscription IDs, purchase logic, restore logic, paywall logic, or entitlement behavior unless explicitly requested.

## App Store Notes

- Current app target version/build: `1.5.8 (90)`.
- Bundle identifier: `com.youtrader.pro`.
- App Store rule: never lower or reuse an iOS build number.
- Keep Apple sign-in, privacy strings, encryption posture, and subscription metadata stable unless the task explicitly targets them.
- Copy must not promise returns, account passing, trading signals, or market predictions.

## Current Release Status

- Latest local checkpoint commit: `d67d333 Checkpoint latest YouTrader 1.5.8 build 90 state`.
- The current target release state is `1.5.8 (90)`.
- The working baseline after the checkpoint should be treated as the source of truth for future Cursor/Codex work.
- Future changes should be small, incremental, and validated with typecheck, translation check, and iOS Expo export.
