# YouTrader Project Handoff

This document is the complete technical handoff for continuing YouTrader in a new GPT-5.5 session with minimal context loss. It summarizes the current codebase, design direction, business constraints, architecture, implemented work, known risks, and planned-but-not-yet-implemented items.

## 1. Project Overview

YouTrader is a premium Expo React Native trading journal and analytics app for futures/prop-firm traders. The current product direction is a luxury iOS 26 / VisionOS inspired fintech terminal: dark, glassy, calm, highly visual, and designed to feel like an Apple-quality professional trading platform.

Primary user-facing areas:

- Journal: add/edit/delete daily trades, screenshots/photos, voice notes, notes, tags, CSV import, backup/export, calendar-based journaling.
- Stats: core trading metrics, equity curve, Performance Profile radar, heatmap/session intelligence, Trader Status achievements.
- AI Analytics: consolidated AI command center, pattern detection, trading coach, prop firm mission, monthly intelligence.
- Calendar/Economic events: limited free access and Pro-gated extended access.
- News: clean premium market news list without AI CTA after latest visual polish.
- Calculator: prop-firm/risk calculator tools.
- Settings: subscription/paywall, sign-in/sync, legal links, exports, language.

Important business intent:

- Keep the app App Store safe.
- Preserve RevenueCat subscription logic.
- Preserve Supabase auth/sync logic.
- Do not expose private AI/API keys in the mobile bundle.
- Do not rewrite the whole app.
- Continue using real journal data, not mock data.

## 2. Tech Stack

Runtime/app:

- Expo SDK `~54.0.35`
- React `19.1.0`
- React Native `0.81.5`
- TypeScript `~5.9.2`
- Main entry: `expo/AppEntry.js`
- Main app file: `App.tsx`

Key dependencies:

- `@supabase/supabase-js` for auth, Realtime, Edge Functions, cloud journal sync.
- `react-native-purchases` for RevenueCat subscriptions.
- `react-native-svg` for charts/radar/rings.
- `expo-blur` for iOS glass material.
- `expo-apple-authentication`, `expo-auth-session`, `expo-web-browser` for Apple/OAuth sign-in.
- `@react-native-async-storage/async-storage` for local journal/cache.
- `expo-secure-store`, `expo-local-authentication` for secure device features.
- `expo-file-system`, `expo-document-picker`, `expo-print`, `expo-media-library`, `expo-sharing`, `react-native-view-shot` for import/export/share.
- `posthog-react-native` for analytics.
- `lucide-react-native` for icons.

Scripts:

- `npm run start`
- `npm run ios`
- `npm run android`
- `npm run typecheck`
- `npm run build:ios`
- `npm run build:preview`

Current verified checks:

- `npm run typecheck` passes.
- `npx expo-doctor` currently reports 17/18 checks passed with one non-CNG/native-folder warning.

## 3. Folder Architecture

Current relevant structure:

```text
.
├── App.tsx
├── app.json
├── package.json
├── tsconfig.json
├── assets/
│   └── youtrader-bull-mark.png
├── docs/
│   └── NVIDIA_AI_SETUP.md
├── src/
│   ├── ai/
│   │   ├── hiddenLeakDetector.ts
│   │   ├── passProbabilityEngine.ts
│   │   └── revengeTradingDetector.ts
│   ├── analytics/
│   │   ├── achievements.ts
│   │   ├── patternDetector.ts
│   │   ├── propSurvival.ts
│   │   ├── sessionHeatmap.ts
│   │   └── tradingScore.ts
│   ├── api/
│   │   ├── aiCoach.ts
│   │   ├── finnhubCalendar.ts
│   │   └── tradeAnalysis.ts
│   ├── components/
│   │   ├── charts/
│   │   │   └── AnimatedEquityCurve.tsx
│   │   ├── insights/
│   │   │   ├── SharePnLCard.tsx
│   │   │   └── shareExport.ts
│   │   ├── subscription/
│   │   │   └── SubscriptionLegalDisclosure.tsx
│   │   └── ui/
│   │       ├── GlassCard.tsx
│   │       ├── NeonGlowBackground.tsx
│   │       ├── PremiumGlassCard.tsx
│   │       ├── PremiumLockOverlay.tsx
│   │       ├── YouTraderLottie.tsx
│   │       └── haptics.ts
│   ├── config/
│   │   ├── appConfig.ts
│   │   └── legalUrls.ts
│   ├── hooks/
│   │   ├── useResponsiveLayout.ts
│   │   └── useRiskCoach.ts
│   ├── lib/
│   │   ├── logger.ts
│   │   └── posthog.ts
│   ├── observability/
│   │   ├── analytics.ts
│   │   ├── metrics.ts
│   │   └── monitoring.ts
│   ├── reports/
│   │   └── weeklyReportHtml.ts
│   ├── theme/
│   │   └── colors.ts
│   └── utils/
│       ├── alertExportError.ts
│       ├── importTradesCsv.ts
│       ├── propRiskNotification.ts
│       └── readCsvFile.ts
└── supabase/
    ├── ai-coach-schema.sql
    └── functions/
        ├── ai-coach/
        │   └── index.ts
        └── _shared/
            ├── aiProvider.ts
            ├── aiQuota.ts
            ├── aiSchemas.ts
            └── cors.ts
```

Notes:

- `App.tsx` is still the main orchestrator and contains many inline screen/components/styles.
- `src/components/stats` and `src/components/ai` were planned as extraction targets but not yet created in the current codebase.
- `supabase/functions` is excluded from the React Native TypeScript build because it contains Deno imports.

## 4. Current App State

Current app config:

- App name: `YouTrader`
- Slug: `youtrader-pro`
- Bundle ID: `com.youtrader.pro`
- App version in `app.json`: `1.5.7`
- iOS build number in `app.json`: `62`
- `package.json` version still says `1.5.6`.
- Supports iPad/tablet via `ios.supportsTablet: true`.
- Dark UI only: `userInterfaceStyle: dark`.

Current UX state:

- The app has gone through a Premium Safe UI pass, NVIDIA AI Coach migration, Premium Terminal redesign, and latest iOS 26 visual polish.
- Stats now uses a premium `Performance Profile` radar instead of the earlier `Trading DNA` ring grid.
- Journal no longer renders the `DailyCoachCard` / "Edge Is Showing" message.
- News no longer shows the `Explain with AI` button/modal.
- AI Analytics keeps five sections, with one refresh button and a `Protect Pass Path` bottom sheet.

## 5. Everything Already Implemented

Premium UI foundations:

- Reusable `GlassCard` with `BlurView` on iOS and translucent fallback on Android.
- `PremiumGlassCard`, `PremiumLockOverlay`, `NeonGlowBackground`, haptic helpers, `YouTraderLottie` placeholder.
- `AnimatedEquityCurve` with SVG/Animated drawing and no chart haptic after visual polish.
- Liquid Glass style primitives inside `App.tsx`: `TerminalGlassCard`, `SegmentedTimeFilter`, `MetricPillRow`, `AppleRing`, `BottomSheetPanel`, `CloudAIStatus`.

Stats:

- Core stats visible for free users where required: Win Rate, Trades, Win/Loss, Month P&L, Biggest Win, Biggest Loss, max winning/losing streak, live news.
- Advanced metrics Pro-gated: Profit Factor, Expectancy, Consistency Score, Sharpe Ratio, Avg Win/Loss.
- `TerminalEquitySection` with chart/time filters/tooltips/KPI rows.
- New `PremiumPerformanceRadar` with 6 axes: Win Rate, Risk Control, Consistency, Recovery, Profit Factor, Reward Risk.
- `TerminalSessionIntelligence` with Hours/Sessions/Days/Months modes, improved fixed heatmap keys, bottom sheet detail.
- `TerminalTraderStatus` with rank, score, unlocked achievements, next targets, pressable achievement share flow.

Journal:

- Local journal storage with AsyncStorage key `trades-v6`.
- Optional cloud sync for Pro users with Supabase `trade_journal`.
- Calendar cells widened/taller and visually polished.
- Month title is white.
- `DailyCoachCard` removed from render path.
- iPad-specific removal of "Scroll to view trades" was previously implemented.

AI:

- Client API in `src/api/aiCoach.ts`.
- Supabase Edge Function `supabase/functions/ai-coach/index.ts`.
- Server-side NVIDIA provider abstraction in `supabase/functions/_shared/aiProvider.ts`.
- Server-side quotas/cooldowns in `supabase/functions/_shared/aiQuota.ts`.
- JSON schemas/normalization in `aiSchemas.ts`.
- AI actions:
  - `weekly_coach`
  - `risk_predictor`
  - `journal_summary`
  - `daily_plan`
  - `news_explainer`
  - `daily_challenge`
- Free users get local preview/fallback.
- Pro users can use NVIDIA if configured and quota allows.
- NVIDIA errors fall back safely to local analysis.

RevenueCat/App Store:

- Monthly and yearly product IDs are supported.
- Both products unlock one shared entitlement.
- Product fallback logic loads products directly if offering packages are missing.
- Debug logging summarizes offering/package/product IDs without private PII.

Share/export:

- Achievement share card flow restored in `TerminalTraderStatus`.
- Existing capture/share utilities use `react-native-view-shot`, `expo-sharing`, `expo-print`, `expo-media-library`.
- Achievement share quota uses Supabase table `achievement_share_usage` when available, local fallback otherwise.

## 6. Everything Intentionally NOT Implemented

Not implemented by design:

- No heavy native dependencies such as Skia, Lottie runtime, Victory Native XL, Reanimated, or Gesture Handler were added for the visual polish phases.
- No direct NVIDIA or OpenAI calls from React Native client.
- No `NVIDIA_API_KEY` in Expo public variables.
- No database schema rewrite beyond adding `ai_usage_events` SQL.
- No Transporter upload/build was run during visual polish.
- No RevenueCat business logic rewrite.
- No Supabase auth rewrite.
- No journal save/edit/delete business logic rewrite.
- No mock data added to replace real user journal stats.
- No buy/sell/trade-signal AI output.
- News AI Explainer API still exists, but the News screen no longer exposes its button/modal.
- `DailyCoachCard` component may still exist in `App.tsx`, but it is no longer rendered in Journal.

## 7. Current Database Schema

Only `supabase/ai-coach-schema.sql` is present as a formal SQL schema file in this repository.

Confirmed schema: `public.ai_usage_events`

```sql
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (
    action in (
      'weekly_coach',
      'risk_predictor',
      'journal_summary',
      'daily_plan',
      'news_explainer',
      'daily_challenge'
    )
  ),
  period_key text not null,
  provider text not null default 'local',
  used_fallback boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Indexes:

- `ai_usage_events_user_action_created_idx` on `(user_id, action, created_at desc)`
- `ai_usage_events_user_period_idx` on `(user_id, period_key)`

RLS:

- Enabled on `ai_usage_events`.
- Authenticated users can select/insert only their own rows.

Tables inferred from app code:

`trade_journal`

- Used for Pro cloud journal sync.
- Selected as `*`, upserted on `user_id,client_id`.
- Expected columns:
  - `id`
  - `client_id`
  - `user_id`
  - `trade_date`
  - `symbol`
  - `direction`
  - `entry_time`
  - `exit_time`
  - `contracts`
  - `entry`
  - `exit`
  - `stop_loss`
  - `take_profit`
  - `pnl`
  - `mood`
  - `notes`
  - `screenshot_url`
  - `voice_url`
  - `tags`
  - `created_at`
  - `updated_at`
  - `deleted_at`

`prop_firms`

- Used for remote prop firm templates.
- Expected columns:
  - `slug`
  - `name`
  - `account_name`
  - `account_size`
  - `daily_loss_limit`
  - `max_loss_limit`
  - `evaluation_contracts`
  - `live_contracts`
  - `trailing_drawdown`
  - `rules`
  - `created_at`

`user_subscriptions`

- Used by app and Edge Function for server-side Pro entitlement.
- Expected columns:
  - `user_id`
  - `entitlement_id`
  - `status`
  - `expires_at`

`achievement_share_usage`

- Used to limit daily achievement shares.
- Expected columns:
  - `id`
  - `user_id`
  - `achievement_id`
  - `achievement_title`
  - `is_pro_snapshot`
  - `shared_at`

Security note:

- If continuing database work, create/verify SQL migrations for `trade_journal`, `prop_firms`, `user_subscriptions`, and `achievement_share_usage`.
- Ensure RLS is enabled from day one and policies restrict access by `auth.uid()`.

## 8. Supabase Structure

Client:

- `src/config/appConfig.ts` creates Supabase client only if public URL/key look valid.
- Uses `EXPO_PUBLIC_SUPABASE_URL`.
- Uses `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or fallback `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Mobile auth storage is AsyncStorage.
- Auth options: `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`.

Auth:

- Optional cloud sign-in controlled by `EXPO_PUBLIC_ENABLE_CLOUD_SIGN_IN`.
- Native Apple sign-in controlled by `EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN`, or automatically enabled on iOS when Supabase + cloud sign-in are configured.
- OAuth redirect URI uses scheme `com.youtrader.pro` with path `auth`.

Cloud sync:

- Pro cloud sync loads local trades from AsyncStorage first.
- Then reads `trade_journal` rows for current user.
- Merges local/cloud by `client_id`.
- Upserts merged rows with `onConflict: "user_id,client_id"`.
- Soft delete updates `deleted_at` and `updated_at`.
- Realtime channel listens to `public.trade_journal` filtered by `user_id`.

Edge Functions:

- `ai-coach` requires Authorization JWT.
- Creates user-scoped Supabase client with anon/publishable key.
- Creates admin client with service role key for quota and server entitlement checks.
- Checks `user_subscriptions` for Pro.
- Uses `ai_usage_events` for quota/cooldown.

Required Supabase Edge secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NVIDIA_API_KEY`
- optional `NVIDIA_MODEL`
- optional `REVENUECAT_ENTITLEMENT_ID`

## 9. RevenueCat Configuration

Client config:

- `REVENUECAT_API_KEY` is read from:
  - iOS: `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
  - Android: `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- iOS key must start with `appl_`.
- Android key must start with `goog_`.
- RevenueCat is disabled on web.

Entitlement:

- `REVENUECAT_ENTITLEMENT_ID = EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "pro"`
- Earlier project notes mention a shared entitlement named "YouTrader Pro"; current code default is `"pro"`.
- Make sure RevenueCat dashboard, app env, and Supabase Edge `REVENUECAT_ENTITLEMENT_ID` all match.

Products:

- Monthly:
  - Env: `EXPO_PUBLIC_REVENUECAT_IOS_PRODUCT_ID`
  - Default: `youtrader_pro_monthly`
  - Display constant: `$12.99/mo`
- Yearly:
  - Env: `EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID`
  - Default: `youtrader_pro_yearly`
  - Display constant: `$99.99/yr`

Pro detection:

- `customerHasRevenueCatProEntitlement(customerInfo)` checks active entitlement and product identifier if present.
- `customerHasActiveProSubscription(customerInfo)` checks active subscriptions and expiration dates for monthly/yearly IDs.
- Final Pro access is true if RevenueCat entitlement OR active Apple subscription OR server entitlement is active.

Offering/product fallback:

- First tries `Purchases.getOfferings()` and uses current offering packages.
- If no packages are available, falls back to `Purchases.getProducts([monthly, yearly])`.

App Store setup requirements:

- Both monthly and yearly subscriptions must exist in App Store Connect.
- Both must be attached to the app version if needed.
- Both must be added to the RevenueCat default offering as packages.
- Both should unlock the same entitlement.
- Paid Apps Agreement must be active.
- App metadata must include Privacy Policy and Terms of Use/EULA links.

## 10. AI Architecture

Mobile client:

- File: `src/api/aiCoach.ts`
- Exports typed fetchers:
  - `fetchAIWeeklyCoach`
  - `fetchAIRiskPredictor`
  - `fetchAIJournalSummary`
  - `fetchAIDailyPlan`
  - `fetchAINewsExplainer`
  - `fetchAIDailyChallenge`
- Calls `supabase.functions.invoke("ai-coach", { body: { action, period, payload } })`.
- Provides local fallback if Supabase is not configured, no session exists, server errors, or quota responses occur.
- Never exposes raw server errors to the user.

Server provider:

- File: `supabase/functions/_shared/aiProvider.ts`
- Base URL: `https://integrate.api.nvidia.com/v1`
- Default model: `meta/llama-3.1-70b-instruct`
- Env override: `NVIDIA_MODEL`
- Timeout: 18 seconds.
- Uses `fetch` with OpenAI-compatible `/chat/completions`.
- `max_tokens: 900`, `temperature: 0.2`.
- Strict system prompt: JSON only, use user data only, no financial advice, no buy/sell/hold signals.
- Compacts payload by removing media fields: `photoUri`, `voiceUri`, `voiceName`, `screenshots`, `images`.
- Retries once for transient network errors and 5xx.
- Does not retry 401/403/429.
- Returns local fallback if NVIDIA fails.

Quota:

- File: `supabase/functions/_shared/aiQuota.ts`
- Pro quotas:
  - `daily_plan`: 1/day, 60s cooldown
  - `risk_predictor`: 3/day, 45s cooldown
  - `weekly_coach`: 1/week, 300s cooldown
  - `journal_summary`: 3/day, 90s cooldown
  - `news_explainer`: 10/day, 15s cooldown
  - `daily_challenge`: 1/day, 60s cooldown

UI:

- AI Analytics now uses five consolidated sections:
  - AI Command Center
  - Pattern Detective
  - Trading Coach
  - Prop Firm Mission
  - Monthly Intelligence
- `Refresh Analysis` runs all core AI calls and trade analysis.
- `Updated HH:MM` timestamp appears after results.
- `Protect Pass Path` opens a bottom sheet.
- News screen no longer exposes `Explain with AI`.

## 11. Analytics Engine Architecture

Main stats still live mostly in `App.tsx`.

Core formula entry points:

- `calcStats(trades)`
- `tradingScoreForTrades(trades)`
- `maxDrawdownFromTrades(trades)`
- `consistencyScoreFromTrades(trades)`
- `periodPnlFromTrades(trades, period)`
- `buildAnalysisBreakdown(trades, keyFn)`
- `buildTradeAnalysisPayload(...)`

Analytics modules:

- `src/analytics/achievements.ts`: achievement and trader-level engine.
- `src/analytics/patternDetector.ts`: pattern detection.
- `src/analytics/propSurvival.ts`: prop survival score.
- `src/analytics/sessionHeatmap.ts`: 24-hour heatmap.
- `src/analytics/tradingScore.ts`: trading score utilities.
- `src/ai/passProbabilityEngine.ts`: prop pass probability.
- `src/ai/revengeTradingDetector.ts`: revenge trading detection.
- `src/ai/hiddenLeakDetector.ts`: hidden leaks.
- `src/api/tradeAnalysis.ts`: local AI-style trade analysis payload/result.

Current philosophy:

- Use real journal data only.
- Keep formulas deterministic and local where possible.
- AI is an interpretation layer, not a source of trading signals.

## 12. Current UI Architecture

Navigation is internal state in `App.tsx`, not React Navigation.

Screens/components are mostly inline in `App.tsx`, including:

- `JournalScreen`
- `StatsScreen`
- `AiAnalysisScreen`
- `NewsScreen`
- `SettingsScreen`
- calculator/calendar sections
- paywall/RevenueCat flows
- many visual primitives and terminal components

Newer terminal UI components inside `App.tsx`:

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

Important debt:

- `App.tsx` is very large and should eventually be split into `src/components/stats`, `src/components/ai`, `src/screens`, and `src/state` modules.
- Do not split aggressively during urgent App Store/build work unless typecheck and runtime checks are kept tight.

## 13. Shared Components

Existing reusable components:

- `src/components/ui/GlassCard.tsx`
  - Base glass material.
  - Uses `BlurView` on iOS.
  - Dark translucent fallback elsewhere.
- `src/components/ui/PremiumGlassCard.tsx`
  - Pressable premium card with optional locked state.
- `src/components/ui/PremiumLockOverlay.tsx`
  - Blur/lock overlay for Pro previews.
- `src/components/ui/NeonGlowBackground.tsx`
  - Ambient background; should be used subtly, not neon-heavy.
- `src/components/ui/YouTraderLottie.tsx`
  - Placeholder/pulse animation, not actual Lottie dependency.
- `src/components/ui/haptics.ts`
  - `lightHaptic`, `successHaptic`, `warningHaptic` with safe fallback.
  - Do not use haptics on chart interactions.
- `src/components/charts/AnimatedEquityCurve.tsx`
  - SVG/Animated equity curve.
- `src/components/subscription/SubscriptionLegalDisclosure.tsx`
  - App Store subscription legal requirements.
- `src/components/insights/SharePnLCard.tsx`
  - Shareable P&L card.
- `src/components/insights/shareExport.ts`
  - Capture/share/PDF utility.

## 14. Theme System

Theme source:

- `src/theme/colors.ts`

Current palette:

```ts
export const C = {
  bg: '#05070A',
  card: '#0B0F14',
  card2: '#11161F',
  text: '#F4F4F5',
  sub: '#9CA3AF',
  muted: '#6B7280',
  white: '#FFFFFF',
  green: '#A3FF12',
  greenSoft: 'rgba(163,255,18,0.12)',
  purple: '#B026FF',
  purpleSoft: 'rgba(176,38,255,0.14)',
  red: '#FF3B5F',
  redSoft: 'rgba(255,59,95,0.14)',
  yellow: '#FFD166',
  yellowSoft: 'rgba(255,209,102,0.14)',
  border: 'rgba(255,255,255,0.10)',
};
```

Visual usage rules:

- 90% black/glass/grey.
- Purple only as a small accent.
- Lime only for positive/performance and key CTA emphasis.
- Red only for danger/loss.
- Avoid neon overload, cyberpunk, gamer, crypto dashboard aesthetics.
- Use glass depth, subtle reflection, soft shadows, and spacing.

## 15. Navigation Structure

Tab type:

```ts
type Tab = "journal" | "stats" | "ai" | "calendar" | "news" | "calc" | "settings";
```

Navigation is state-driven in `App.tsx`:

- `journal`: main trading journal and calendar.
- `stats`: performance metrics and visual analytics.
- `ai`: AI Analytics command center.
- `calendar`: economic/calendar tools.
- `news`: market news.
- `calc`: risk/prop calculator.
- `settings`: account/subscription/legal/export/settings.

Do not introduce a navigation library without a deliberate migration plan.

## 16. Existing Bugs / Risks / Known Issues

Known current issues:

- `npx expo-doctor` reports one warning: native project folders exist while `app.json` still contains prebuild config fields. In non-CNG projects, EAS will not sync fields such as scheme, orientation, icon, splash, ios/android/plugins into native folders automatically.
- `package.json` version is `1.5.6`, while `app.json` version is `1.5.7` and iOS build number is `62`.
- There are many `.ipa` build artifacts and backup folders in the repository root, currently untracked. Do not commit those accidentally.
- Formal SQL migrations are missing for several tables inferred by code (`trade_journal`, `prop_firms`, `user_subscriptions`, `achievement_share_usage`).
- `App.tsx` is very large and contains substantial technical debt.
- AI News Explainer client/API/server support remains present, but News UI no longer exposes it by design.
- `DailyCoachCard` code may remain unused in `App.tsx`.
- RevenueCat entitlement ID naming must be verified across env, RevenueCat dashboard, and Supabase Edge Function. Code default is `"pro"` but earlier notes referenced `"YouTrader Pro"`.

Recently fixed:

- Missing `assets/youtrader-bull-mark.png` was restored.
- Invalid old App Store versioning was addressed earlier by moving app config to `1.5.7` and build numbers forward.
- Deno Supabase functions are excluded from RN typecheck.
- Latest visual polish typecheck passes.

## 17. Pending TODOs

Latest attached iOS 26 visual polish plan was completed in code:

- Remove purple circles / update Liquid Glass card material.
- Remove `DailyCoachCard` / `Edge Is Showing`, polish Journal calendar.
- Restore premium Performance Profile radar and improve heatmap.
- Make Trader Status achievements pressable and restore share flow.
- Improve AI Analytics buttons/visual feedback and `Protect Pass Path` bottom sheet.
- Remove `Explain with AI` from News render path/modal.
- Run typecheck/expo-doctor.

Outstanding engineering TODOs not yet completed:

- Extract large inline `App.tsx` terminal components into dedicated files.
- Add proper SQL migration files for all inferred Supabase tables.
- Verify RevenueCat entitlement ID consistency.
- Manually test latest UI on iPhone and iPad via Simulator/TestFlight.
- Address or consciously accept the Expo Doctor non-CNG warning.
- Clean root build artifacts/backups before any commit/release packaging.
- Run a security review before production release.

## 18. Files Modified During This Conversation

Modified/created across this broader conversation:

- `App.tsx`
- `app.json`
- `Info.plist`
- `ios/YouTrader.xcodeproj/project.pbxproj`
- `ios/Podfile.lock`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `assets/youtrader-bull-mark.png`
- `src/components/ui/GlassCard.tsx`
- `src/components/ui/PremiumGlassCard.tsx`
- `src/components/ui/PremiumLockOverlay.tsx`
- `src/components/ui/NeonGlowBackground.tsx`
- `src/components/ui/haptics.ts`
- `src/components/ui/YouTraderLottie.tsx`
- `src/components/charts/AnimatedEquityCurve.tsx`
- `src/components/subscription/SubscriptionLegalDisclosure.tsx`
- `src/components/insights/shareExport.ts`
- `src/analytics/achievements.ts`
- `src/analytics/propSurvival.ts`
- `src/analytics/sessionHeatmap.ts`
- `src/analytics/patternDetector.ts`
- `src/analytics/tradingScore.ts`
- `src/ai/passProbabilityEngine.ts`
- `src/ai/revengeTradingDetector.ts`
- `src/ai/hiddenLeakDetector.ts`
- `src/api/aiCoach.ts`
- `src/api/tradeAnalysis.ts`
- `src/api/finnhubCalendar.ts`
- `src/config/appConfig.ts`
- `src/config/legalUrls.ts`
- `src/theme/colors.ts`
- `docs/NVIDIA_AI_SETUP.md`
- `supabase/ai-coach-schema.sql`
- `supabase/functions/ai-coach/index.ts`
- `supabase/functions/_shared/aiProvider.ts`
- `supabase/functions/_shared/aiQuota.ts`
- `supabase/functions/_shared/aiSchemas.ts`
- `supabase/functions/_shared/cors.ts`
- `PROJECT_HANDOFF.md`

Latest immediate visual-polish code changes were concentrated in `App.tsx`.

## 19. Current Design Philosophy

The app should feel like:

- iOS 26
- Apple Wallet
- Apple Health
- Apple Fitness
- Apple Stocks
- Apple Intelligence UI
- VisionOS
- Linear
- Arc Browser
- Notion Calendar
- Minimal Bloomberg Terminal

It should not feel like:

- Cyberpunk
- Gaming UI
- Crypto dashboard
- Neon overload
- Random widget collection

Design principles:

- Every card answers one question.
- Merge duplicated information.
- Large numbers, small labels, minimal copy.
- More visual UI, less explanatory text.
- Subtle animation and glass depth.
- No vibration on chart interactions.
- Free users should see useful previews, not black empty screens.
- Pro lock states should feel premium, not punitive.

## 20. Current Coding Conventions

Conventions followed so far:

- TypeScript types for domain objects.
- Keep business logic stable during visual refactors.
- Prefer existing local helpers/formulas over new abstractions.
- Use `useMemo` for derived stats and payloads.
- Use `useCallback` for async stateful handlers.
- Use `AsyncStorage` for persistent local state.
- Use `logger` and `trackEvent` for important failures/analytics.
- Avoid throwing raw server errors to users.
- Keep comments rare and purposeful.
- Avoid new dependencies unless they are verified and necessary.
- Do not put secrets in chat or client bundle.
- Keep Supabase Edge Function code separate from RN typecheck.

## 21. Important Formulas

`calcStats(trades)`:

- `pnl = sum(trade.pnl)`
- `wins = trades where pnl > 0`
- `losses = trades where pnl < 0`
- `grossWin = sum(wins.pnl)`
- `grossLoss = abs(sum(losses.pnl))`
- `wr = wins.length / trades.length * 100`
- `expectancy = pnl / trades.length`
- `profitFactor = grossLoss ? grossWin / grossLoss : grossWin ? 99 : 0`
- `avgWin = grossWin / wins.length`
- `avgLoss = grossLoss / losses.length`
- `avgWinLoss = avgLoss ? avgWin / avgLoss : avgWin ? 99 : 0`
- `avgRR = average(rrForTrade(trade))`
- `maxDrawdown = maxDrawdownFromTrades(trades)`
- Also calculates win/loss streaks, daily streaks, weekday/session/setup breakdowns.

`maxDrawdownFromTrades(trades)`:

- Orders trades by trade time.
- Accumulates equity.
- Tracks peak equity.
- Drawdown is negative difference from peak.

`calculatePassProbability`:

- `pnl = sum(trade.pnl)`
- `target = template.evaluationTarget || 3000`
- `maxLoss = template.maxLossLimit || 2000`
- `progress = max(0, pnl / target) * 55`
- `drawdown = abs(min(0, pnl))`
- `buffer = max(0, 1 - drawdown / maxLoss) * 35`
- `sample = min(10, trades.length / 2)`
- `probability = clamp(round(progress + buffer + sample), 3, 98)`
- Status:
  - `>=82`: `EXCELLENT`
  - `>=58`: `ON_TRACK`
  - `>=32`: `AT_RISK`
  - else `DANGER`

`calculateAchievements`:

- Tracks count, green trades, green days, green weeks, largest R, risk discipline streak, prop survival score, best month P&L, trading score.
- Status is:
  - `unlocked` if progress >= target
  - `next_target` if progress >= 55% target
  - otherwise `locked`

Achievement share limits:

- Pro: 10/day.
- Free: 2/day.
- Supabase table preferred; local fallback if unavailable.

AI confidence in command center:

- `Math.max(30, Math.min(98, Math.round((passProbability.probability + tradingScoreForTrades(periodTrades).score) / 2)))`

## 22. State Management Architecture

There is no global state library.

State is mostly local React state in `App.tsx`:

- App/tab state: active tab, language, forms, modals, selected dates.
- Journal state: `trades`, `form`, `editingId`, selected date/month, local hydration.
- Cloud sync: session, Supabase state, sync status/message, Realtime subscription.
- RevenueCat: packages, store products, customer info, paywall status/error, Pro access state.
- AI: `aiResults`, `aiBusy`, trade analysis results/error/loading.
- UI: bottom sheets, share targets, photo/voice modals, calendar/month pickers.

Persistence:

- Trades: `AsyncStorage` key `trades-v6`.
- Language: `lang-v1`.
- Prop lock screen buffer: `prop-lock-screen-v1`.
- Prop rules cache: app-specific cache key in `App.tsx`.
- Achievement share fallback uses local AsyncStorage.

Server/session:

- Supabase auth session is persisted via Supabase client AsyncStorage integration.
- RevenueCat customer info is refreshed and applied to `ProAccessState`.

## 23. Premium Feature Logic

Pro is true if any of these are active:

- RevenueCat entitlement active.
- Apple active subscription for monthly/yearly product ID.
- Server entitlement active in `user_subscriptions`.

Free behavior:

- Core app must remain useful.
- Basic stats remain open.
- News list remains open.
- Calendar restrictions remain: today available, future/next-week gated by Pro.
- AI Analytics free users see blurred premium preview/lock overlay, not black screen.
- AI server returns local preview for non-Pro users.

Pro behavior:

- Advanced stats.
- Full AI Analytics/NVIDIA coaching within quota.
- Premium calendar access.
- Cloud sync/journal tools.
- Higher share/export limits.
- Premium exports and analytics.

Do not gate everything. User must see that the app works before subscribing.

## 24. Share Card Architecture

Achievement sharing:

- `TerminalTraderStatus` now owns local `shareTarget`, `shareBusy`, and `achievementShareRef`.
- On unlocked achievement press:
  1. Check quota with `checkAndRecordAchievementShareUsage`.
  2. Set `shareTarget`.
  3. Wait two frames plus timeout so offscreen card renders.
  4. Dynamically import `shareCapturedView` from `src/components/insights/shareExport`.
  5. Capture `AchievementShareCard` via `react-native-view-shot`.
  6. Share PNG through `expo-sharing`.
  7. Track `achievement_share_generated`.

Offscreen render:

- Uses `styles.offscreenShareCard`.
- `AchievementShareCard` receives:
  - `item`
  - `level`
  - `stats`
- Stats include:
  - `tradesLogged`
  - `winRate`
  - `totalPnl`
  - `dateLabel`

Share utilities:

- `shareCapturedView(ref, title, { width, height })`
- `saveCapturedViewToPhotos(ref)`
- `shareWeeklyPdfReport(stats)`
- `shareMonthlyPdfReport(stats)`

The share card must include the YouTrader logo/branding and a beautiful reward/result visual.

## 25. Planned But Not Yet Implemented

Architecture cleanup:

- Extract Stats components from `App.tsx` into `src/components/stats/`.
- Extract AI components from `App.tsx` into `src/components/ai/`.
- Extract screen-level components into `src/screens/`.
- Extract journal form/calendar components.
- Add unit-level tests for formulas where possible.

Database/security:

- Add formal migrations for `trade_journal`, `prop_firms`, `user_subscriptions`, `achievement_share_usage`.
- Review all RLS policies.
- Add indexes for sync-heavy tables.
- Add webhook signature verification for any RevenueCat/Stripe/App Store server-side subscription sync if implemented later.
- Add server-side audit logs for critical actions if backend expands.

AI:

- Keep NVIDIA as primary provider for Pro.
- Keep local fallback.
- Do not remove OpenAI/local fallback code unless NVIDIA production path is fully verified.
- Consider richer AI visual summaries, but keep no-financial-advice constraints.
- News Explainer API exists but UI is removed; only reintroduce if the product direction changes.

UI:

- More Apple-quality motion polish without new heavy dependencies.
- Better iPad layouts for Stats/AI if time allows.
- More compact visual cards in AI Analytics.
- More interactive heatmap evidence/detail views.
- Make monthly intelligence expandable with a polished timeline.

Release/build:

- Resolve `expo-doctor` non-CNG warning or document that native folders are authoritative.
- Align `package.json` version with app release version if desired.
- Clean root `.ipa` artifacts before commit/package handoff.
- Manually test on:
  - iPhone small screen
  - iPhone Pro/Max
  - iPad Air 11-inch
  - TestFlight sandbox subscription flow
  - free vs Pro account
  - Supabase unavailable
  - NVIDIA unavailable/rate-limited

## Recent Verification

Commands run after latest visual polish:

```bash
npm run typecheck
```

Result: passed.

```bash
npx expo-doctor
```

Result: 17/18 passed. One warning about native folders plus app config fields in a non-CNG project.

## Critical Safety Notes For Next GPT-5.5 Session

- Always answer the user in Russian.
- Do not edit attached plan files unless the user explicitly requests it.
- Do not expose API keys or ask the user to paste secrets into chat.
- Do not change RevenueCat/Supabase auth/subscription logic during visual-only tasks.
- Do not add heavy native dependencies without explicit approval.
- Do not remove existing fallback logic.
- Do not commit `.ipa`, backup folders, or secrets.
- Always run `npm run typecheck` after code edits.
- Run `npx expo-doctor` when dependency/build config changes.
- Before important release/security changes, request a security review.
