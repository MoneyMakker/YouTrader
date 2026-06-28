# YouTrader Architecture

This document explains the current application architecture so another engineer can continue development quickly.

## High-Level Architecture

YouTrader is an Expo React Native app with a mostly client-side architecture and optional Supabase-backed cloud features.

Main responsibilities:

- The mobile app owns navigation, local state, journal entry, visual analytics, subscriptions, paywall, and local fallback AI.
- Supabase owns auth, optional journal sync, server-side Pro entitlement checks, Edge Functions, and AI usage quotas.
- RevenueCat owns purchase, restore, customer info, active subscriptions, and entitlement detection.
- NVIDIA AI is accessed only through Supabase Edge Functions.

The app currently has one large orchestrator file, `App.tsx`, plus extracted helper modules under `src/`.

## Folder Structure

```text
.
├── App.tsx
├── app.json
├── package.json
├── tsconfig.json
├── assets/
├── docs/
│   └── NVIDIA_AI_SETUP.md
├── src/
│   ├── ai/
│   ├── analytics/
│   ├── api/
│   ├── components/
│   │   ├── charts/
│   │   ├── insights/
│   │   ├── subscription/
│   │   └── ui/
│   ├── config/
│   ├── hooks/
│   ├── lib/
│   ├── observability/
│   ├── reports/
│   ├── theme/
│   └── utils/
└── supabase/
    ├── ai-coach-schema.sql
    └── functions/
        ├── ai-coach/
        └── _shared/
```

## Dependency Graph

```text
App.tsx
├── src/config/appConfig.ts
│   ├── Supabase client
│   └── RevenueCat env/config validation
├── src/theme/colors.ts
├── src/components/ui/*
│   ├── GlassCard
│   ├── PremiumGlassCard
│   ├── PremiumLockOverlay
│   ├── NeonGlowBackground
│   └── haptics
├── src/components/charts/AnimatedEquityCurve.tsx
├── src/components/insights/*
│   ├── share cards
│   └── capture/share/export helpers
├── src/components/subscription/SubscriptionLegalDisclosure.tsx
├── src/api/*
│   ├── aiCoach
│   ├── tradeAnalysis
│   └── finnhubCalendar
├── src/analytics/*
│   ├── achievements
│   ├── pattern detection
│   ├── prop survival
│   ├── session heatmap
│   └── trading score
├── src/ai/*
│   ├── pass probability
│   ├── revenge trading detection
│   └── hidden leak detection
├── src/hooks/*
├── src/utils/*
└── src/observability/*

src/api/aiCoach.ts
└── Supabase Edge Function: ai-coach
    ├── _shared/aiProvider.ts
    ├── _shared/aiQuota.ts
    ├── _shared/aiSchemas.ts
    └── _shared/cors.ts
```

## Application Entry

`App.tsx` is the primary entry and orchestration layer.

It currently contains:

- Domain types for trades, news, economic events, and subscription state.
- Tab/navigation state.
- Journal screen and form.
- Stats screen and terminal analytics UI.
- AI Analytics screen.
- News screen.
- Settings/paywall/subscription UI.
- RevenueCat purchase/restore flows.
- Supabase auth and cloud sync flows.
- Several inline visual components that should later be extracted.

Important: `App.tsx` is large and should be refactored carefully. Avoid broad rewrites during release work.

## Shared Hooks

Current shared hooks:

- `src/hooks/useResponsiveLayout.ts`
  - Centralizes responsive/tablet layout decisions.
  - Used to keep iPhone and iPad behavior separate where needed.

- `src/hooks/useRiskCoach.ts`
  - Risk coach helper hook for prop/risk guidance.

Most state is still managed directly in `App.tsx`; hooks are not yet the main state architecture.

## Shared Components

### UI Components

- `GlassCard`
  - Base glass material.
  - Uses iOS blur where available.
  - Uses translucent dark fallback where needed.

- `PremiumGlassCard`
  - Premium pressable card surface.
  - Supports locked/premium states.

- `PremiumLockOverlay`
  - Blurred Pro preview overlay with title, subtitle, CTA, and secondary action.

- `NeonGlowBackground`
  - Ambient background effect.
  - Should be used subtly; current design direction is soft ambient glow, not neon.

- `YouTraderLottie`
  - Lightweight placeholder animation component.
  - Does not require a real Lottie dependency.

- `haptics`
  - Safe haptic helpers with silent fallback.
  - Do not use on chart interactions.

### Chart Components

- `AnimatedEquityCurve`
  - SVG/Animated equity curve.
  - Supports animated drawing and markers.
  - Chart haptics were removed by design.

### Subscription Components

- `SubscriptionLegalDisclosure`
  - Required subscription legal disclosure surface.
  - Important for App Store compliance.

### Insight/Share Components

- `SharePnLCard`
  - Visual P&L share card.

- `shareExport`
  - Dynamic capture/share/PDF export helpers.
  - Uses view capture, sharing, print, and media library modules.

## Inline Terminal Components

The latest premium terminal UI still lives inside `App.tsx`.

Important inline components:

- `TerminalGlassCard`
- `SegmentedTimeFilter`
- `MetricPillRow`
- `AppleRing`
- `BottomSheetPanel`
- `CloudAIStatus`
- `TerminalEquitySection`
- `PremiumPerformanceRadar`
- `TerminalSessionIntelligence`
- `TerminalTraderStatus`
- `TerminalAICommandCenter`
- `TerminalPatternDetective`
- `TerminalTradingCoach`
- `TerminalPropFirmMission`
- `TerminalMonthlyIntelligence`

Recommended future extraction:

```text
src/components/stats/
├── TerminalEquitySection.tsx
├── PremiumPerformanceRadar.tsx
├── TerminalSessionIntelligence.tsx
└── TerminalTraderStatus.tsx

src/components/ai/
├── TerminalAICommandCenter.tsx
├── TerminalPatternDetective.tsx
├── TerminalTradingCoach.tsx
├── TerminalPropFirmMission.tsx
└── TerminalMonthlyIntelligence.tsx
```

## Analytics Engine

Analytics are split between `App.tsx` helpers and `src/analytics` / `src/ai`.

Core analytics concepts:

- Basic stats: net P&L, win rate, expectancy, profit factor, average win/loss, average R:R.
- Equity curve and max drawdown.
- Daily series and streaks.
- Session/day/hour/instrument/direction/mood/setup breakdowns.
- Consistency score.
- Trading score.
- Prop survival and pass probability.
- Achievements and trader levels.
- Hidden leaks and revenge trading risk.

Current analytics modules:

- `src/analytics/achievements.ts`
  - Achievement list, progress, unlocked/locked/next-target state.
  - Trader level mapping.

- `src/analytics/patternDetector.ts`
  - Strength/risk/opportunity detection from trade performance.

- `src/analytics/propSurvival.ts`
  - Prop firm survival probability and recommended action.

- `src/analytics/sessionHeatmap.ts`
  - Hourly heatmap cells.

- `src/analytics/tradingScore.ts`
  - Composite trader score and grade.

- `src/ai/passProbabilityEngine.ts`
  - Prop firm pass probability.

- `src/ai/revengeTradingDetector.ts`
  - Revenge trading detection.

- `src/ai/hiddenLeakDetector.ts`
  - Hidden performance/behavior leak detection.

- `src/api/tradeAnalysis.ts`
  - Local AI-style trade analysis result.

Important architectural rule:

- Analytics should stay deterministic and based on journal data.
- AI should interpret analytics, not replace core calculations.

## AI Engine

AI has two layers: client wrapper and server provider.

### Client AI Flow

```text
AI Analytics UI
└── src/api/aiCoach.ts
    └── supabase.functions.invoke("ai-coach")
        └── returns AIResponse<T>
```

Client behavior:

- Builds payload from journal stats and selected context.
- Calls Supabase Edge Function when configured and signed in.
- Falls back to local safe analysis when:
  - Supabase is unavailable.
  - User is not signed in.
  - Edge Function fails.
  - Cloud AI is unavailable.
  - Quota is exceeded.

Client exported actions:

- `fetchAIWeeklyCoach`
- `fetchAIRiskPredictor`
- `fetchAIJournalSummary`
- `fetchAIDailyPlan`
- `fetchAINewsExplainer`
- `fetchAIDailyChallenge`

### Server AI Flow

```text
ai-coach Edge Function
├── validates JWT
├── checks user identity
├── checks server Pro entitlement
├── checks quota/cooldown
├── calls generateAI(...)
│   ├── NVIDIA provider if allowed
│   └── local fallback if unavailable/not allowed
└── records usage event
```

Server files:

- `supabase/functions/ai-coach/index.ts`
- `supabase/functions/_shared/aiProvider.ts`
- `supabase/functions/_shared/aiQuota.ts`
- `supabase/functions/_shared/aiSchemas.ts`
- `supabase/functions/_shared/cors.ts`

Security rules:

- NVIDIA API key only lives in Supabase Edge Function secrets.
- React Native must never call NVIDIA directly.
- React Native must never receive private server keys.
- AI must not provide financial advice or buy/sell signals.

## State Management

There is no Redux/Zustand/global state library.

State is managed with React state in `App.tsx`.

Major state groups:

- Navigation/tab state.
- Language.
- Journal trades and form state.
- Selected date/month.
- Trade editing/photo/voice modals.
- Local hydration.
- Supabase auth session.
- Cloud sync status.
- RevenueCat customer info, packages, store products, paywall errors.
- Pro access state.
- Prop firm templates and selected risk context.
- AI results and loading states.
- Share/export target state.

Derived state:

- Stats, achievements, pass probability, prop survival, patterns, heatmap, and AI payloads are mostly derived from `trades`, selected period/date, and premium/subscription state.

Architectural rule:

- Prefer derived values over duplicating calculated state.
- Keep journal data as the source of truth.

## Caching

### Local Journal Cache

Trades are stored locally in AsyncStorage.

Primary key:

- `trades-v6`

Behavior:

- Load local trades on startup.
- Normalize trades after load.
- Persist normalized trades whenever hydrated trades change.

### Language Cache

Language preference is stored locally.

Key:

- `lang-v1`

### Prop Firm Rules Cache

Prop firm templates can be loaded from Supabase and cached locally.

Behavior:

- Start with fallback templates.
- Try local cache.
- Try Supabase remote `prop_firms`.
- If remote succeeds, cache templates and metadata.
- If remote fails, keep cache/fallback.

### Achievement Share Fallback Cache

Achievement share limits use Supabase when available.

If Supabase is unavailable or fails, a local fallback limit is used.

### AI Cache

There is no durable AI response cache in the current architecture.

AI generated timestamps are UI state only.

### RevenueCat Cache

RevenueCat SDK manages its own customer info cache.

The app also keeps current `CustomerInfo`, packages, and products in React state.

## Database Flow

### Auth Flow

```text
User sign-in
├── Native Apple Sign-In on iOS when enabled/available
│   └── Supabase signInWithIdToken
└── OAuth provider flow
    ├── Supabase creates auth URL
    ├── WebBrowser auth session opens
    └── app creates session from redirect URL
```

### Journal Cloud Sync Flow

```text
Local trades
└── normalize
    └── compare with Supabase trade_journal rows
        ├── merge local and cloud rows
        ├── update local state if cloud has newer data
        └── upsert merged rows back to trade_journal
```

Rules:

- Cloud sync is Pro-gated.
- Sync is user-scoped.
- Deleted trades are soft-deleted with `deleted_at`.
- Realtime subscription listens to current user’s `trade_journal` changes.
- AppState active event can trigger resync.

### Prop Firm Template Flow

```text
Fallback templates
├── local cache if available
└── Supabase prop_firms remote templates if available
```

### Server Entitlement Flow

```text
Supabase user_subscriptions
└── status/expires_at
    └── server entitlement active/inactive
```

This server entitlement is combined with RevenueCat customer info for final Pro access.

### AI Usage Flow

```text
AI request
└── ai_usage_events
    ├── check latest action timestamp for cooldown
    ├── count usage in day/week window
    └── insert usage row after generation
```

## API Flow

### Internal Local API Flow

Most analytics are local:

```text
trades
└── local formulas/modules
    ├── stats
    ├── score
    ├── achievements
    ├── heatmap
    ├── pass probability
    ├── prop survival
    └── pattern detection
```

### Supabase API Flow

```text
React Native app
└── Supabase JS client
    ├── auth
    ├── trade_journal
    ├── prop_firms
    ├── user_subscriptions
    ├── achievement_share_usage
    ├── Realtime channel
    └── Edge Function invoke
```

### RevenueCat API Flow

```text
App startup / refresh
├── configure Purchases SDK
├── getCustomerInfo
├── getOfferings
│   └── current offering packages
└── fallback getProducts(monthly, yearly)
```

Purchase flow:

```text
User selects package/product
└── RevenueCat purchase
    └── customer info refresh
        └── ProAccessState recalculated
```

Restore flow:

```text
Restore purchases
└── RevenueCat restore
    └── customer info refresh
        └── ProAccessState recalculated
```

### News/Calendar API Flow

Market news and economic calendar data are loaded through app-level API helpers and configured public API URLs/keys.

Rules:

- Calendar/news must not become trade-signal systems.
- News currently remains a clean premium list without AI CTA.

## Premium Access Flow

Final Pro state is derived from three possible sources:

```text
RevenueCat active entitlement
OR active monthly/yearly Apple subscription
OR server-side Supabase entitlement
= Pro access
```

If none are active:

- User is free.
- Free user still sees basic working app value.
- Advanced features show premium previews/locks.

## Share/Export Flow

Share card flow:

```text
User taps shareable achievement/result
├── check daily share quota
├── render offscreen share card
├── capture card as PNG
└── open native share sheet
```

PDF/report export flow:

```text
Stats/report data
└── build HTML report
    └── print to PDF
        └── native share sheet
```

## Observability

Observability modules:

- `src/lib/logger.ts`
- `src/lib/posthog.ts`
- `src/observability/analytics.ts`
- `src/observability/metrics.ts`
- `src/observability/monitoring.ts`

Usage:

- Track important events such as purchase attempts, share generation, auth flows.
- Log caught errors with feature/action metadata.
- Avoid logging secrets or private journal details unnecessarily.

## Configuration

Important public app env variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_PRODUCT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID`
- `EXPO_PUBLIC_ENABLE_CLOUD_SIGN_IN`
- `EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN`
- `EXPO_PUBLIC_FINNHUB_API_KEY`
- `EXPO_PUBLIC_CALENDAR_API_URL`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_TERMS_OF_USE_URL`

Important server-only secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NVIDIA_API_KEY`
- `NVIDIA_MODEL`

Never place server-only secrets in Expo public variables.

## Current Architectural Risks

- `App.tsx` is too large and mixes orchestration, screens, components, and styles.
- Supabase schemas for several runtime tables are inferred but not fully represented as migrations.
- RevenueCat entitlement naming must stay consistent across app env, dashboard, and Edge Function.
- Native folders exist, so some `app.json` config may not sync automatically.
- Many generated `.ipa` and backup files exist in the project root and should not be committed.
- AI relies on server-side entitlement and quota tables being correctly deployed.

## Recommended Development Order

1. Stabilize release-critical UI/runtime issues in `App.tsx`.
2. Verify RevenueCat monthly/yearly subscription flow.
3. Verify Supabase auth and Pro cloud sync.
4. Add missing Supabase migrations and RLS policies.
5. Extract Stats components from `App.tsx`.
6. Extract AI components from `App.tsx`.
7. Extract screen-level Journal/Settings/News code.
8. Add focused tests for formulas and payload builders.
9. Clean release artifacts before committing/building.

## Rules For Future Engineers

- Treat journal trades as the source of truth.
- Keep analytics deterministic.
- Keep AI as a coaching layer, not a signal layer.
- Preserve RevenueCat and Supabase auth logic unless the task explicitly targets them.
- Do not expose private keys.
- Do not add heavy native dependencies without explicit approval.
- Run `npm run typecheck` after edits.
- Run `npx expo-doctor` after dependency/config changes.
