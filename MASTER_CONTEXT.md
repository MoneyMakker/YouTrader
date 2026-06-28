# YouTrader Master Context

Last updated: 2026-06-27

This file is the permanent source of truth for YouTrader. Future Cursor chats must read this file first before changing code. Older files such as `PROJECT_HANDOFF.md`, `CONTINUATION.md`, `KNOWLEDGE.md`, `ARCHITECTURE.md`, and `.cursor/project-memory.md` are historical context, but this file supersedes them when there is a conflict.

Every major architectural decision, analytics engine change, AI behavior change, Supabase schema change, RevenueCat/subscription change, or design system change must update this file in the same branch.

## 1. Project Overview

YouTrader is a production Expo React Native trading journal and analytics app for futures and prop-firm traders. It is not a market prediction product and must never become a trade signal app.

The product exists to help traders understand their own execution, behavior, risk, consistency, session performance, emotional patterns, and prop-firm survival path. The journal is the source of truth. Analytics and AI explain the journal. AI does not invent metrics and does not replace deterministic engines.

Target users:

- Futures traders.
- Prop-firm evaluation and funded-account traders.
- Traders who need journaling discipline, risk control, session intelligence, and behavioral feedback.
- Mobile-first users expecting a premium iOS-quality experience.

Product vision:

- A calm, premium, Apple-quality trading terminal.
- iOS 26 / VisionOS inspired Liquid Glass UI.
- Dark, glassy, visual, information-dense, disciplined.
- More like Apple Wallet, Apple Health, Apple Fitness, Apple Stocks, Linear, Arc Browser, Notion Calendar, and a minimal Bloomberg terminal.
- Not cyberpunk, not gamer, not crypto-dashboard, not neon-heavy.

Business constraints:

- Keep RevenueCat subscription logic intact.
- Keep Supabase auth and sync logic intact.
- Do not expose private AI/API keys in the mobile bundle.
- Keep Pro features valuable, but keep free users able to see real app value.
- Preserve App Store safety: legal links, subscription disclosure, no financial advice, no buy/sell/hold signals.
- Do not add heavy native dependencies without explicit approval.

Current app state:

- Expo SDK `~54.0.35`.
- React `19.1.0`.
- React Native `0.81.5`.
- TypeScript `~5.9.2`.
- Main entry: `expo/AppEntry.js`.
- Main app file: `App.tsx`.
- App name: `YouTrader`.
- Slug: `youtrader-pro`.
- Bundle ID: `com.youtrader.pro`.
- App version: `1.5.7`.
- iOS build number: `63`.
- `package.json` version: `1.5.7`.
- Dark UI only.
- iPad/tablet support is enabled.

## 2. Current Repository Structure

High-level structure:

```text
.
├── App.tsx
├── app.json
├── package.json
├── package-lock.json
├── tsconfig.json
├── MASTER_CONTEXT.md
├── PROJECT_HANDOFF.md
├── CONTINUATION.md
├── KNOWLEDGE.md
├── ARCHITECTURE.md
├── FINAL_STEPS.md
├── README.md
├── assets/
├── docs/
│   └── NVIDIA_AI_SETUP.md
├── ios/
├── src/
│   ├── ai/
│   ├── analytics/
│   ├── api/
│   ├── components/
│   ├── config/
│   ├── hooks/
│   ├── lib/
│   ├── observability/
│   ├── reports/
│   ├── theme/
│   └── utils/
└── supabase/
    ├── migrations/
    ├── functions/
    ├── ai-coach-schema.sql
    └── risk-coach-schema.sql
```

Important note: some historical docs are stale in places. For example, older README/final steps mention older pricing or product IDs. Treat this file plus code as authoritative.

## 3. Application Architecture

The app is mostly client-side React Native with optional cloud features.

Primary responsibilities:

- `App.tsx`: main orchestrator, navigation state, journal state, screens, inline terminal UI, RevenueCat flows, Supabase auth/sync, form handlers, many helper calculations.
- `src/analytics`: extracted deterministic analytics engines and normalization helpers.
- `src/ai`: deterministic local AI-adjacent risk/behavior engines.
- `src/api`: client wrappers for AI coach, local trade analysis, Finnhub/calendar data.
- `src/components`: extracted UI, chart, subscription, insight/share components.
- `src/config`: Supabase, RevenueCat, legal URL config.
- `src/observability`: analytics/events/metrics/monitoring wrappers.
- `supabase/functions`: Edge Function implementation for cloud AI.
- `supabase/migrations`: reproducible runtime database schema path.

Navigation:

- Navigation is state-driven in `App.tsx`.
- Do not add React Navigation unless there is an explicit migration plan.
- Tab type:

```ts
type Tab = "journal" | "stats" | "ai" | "calendar" | "news" | "calc" | "settings";
```

Current tab order:

- `journal`
- `stats`
- `calc`
- `ai`
- `news`
- `calendar`
- `settings`

State management:

- No Redux/Zustand/global state library.
- State is mostly React state in `App.tsx`.
- Derived state is preferred over duplicated state.
- Journal trades are persisted locally in AsyncStorage key `trades-v6`.
- Language uses `lang-v1`.
- Prop lock screen buffer uses `prop-lock-screen-v1`.
- Prop risk templates use `prop-risk-templates-cache-v1`.
- Achievement share fallback quota uses local AsyncStorage when Supabase is unavailable.

Data flow:

```text
Journal trades
  -> normalize/sanitize
  -> local AsyncStorage
  -> optional Supabase cloud sync for Pro
  -> deterministic analytics engines
  -> UI cards/charts/radar/heatmap
  -> AI payload builders
  -> local AI fallback and/or Supabase Edge Function
```

Cloud sync flow:

```text
Local trades
  -> normalize
  -> read public.trade_journal for current user
  -> merge by client_id
  -> upsert on (user_id, client_id)
  -> soft delete via deleted_at
  -> realtime refresh on public.trade_journal user filter
```

Current runtime caveat:

- Supabase auth and cloud sync flows exist in code, but current `App.tsx` sets `authConfigured = false` and `cloudSyncEnabled = false`.
- Sign-in and cloud sync are effectively disabled at runtime until those flags are wired back to validated config and QA-tested.
- Do not assume Supabase sign-in/cloud sync are live just because the client, handlers, and schema exist.

Premium access flow:

```text
RevenueCat active entitlement
OR active Apple subscription product
OR server-side Supabase user_subscriptions row
= Pro access
```

## 4. Source Of Truth Policy

The most important engineering rule in this project:

Every metric must have one engine and one source of truth.

Current reality:

- `src/analytics/tradeMetrics.ts` is the emerging official engine for normalized trade analytics.
- `App.tsx` `calcStats(trades)` now delegates core headline metrics to `buildUnifiedTradeAnalytics(trades)` and adapts the result for existing UI.
- Some breakdowns, streaks, prop snapshot helpers, and UI-specific calculations still live in `App.tsx`.
- Future work should move duplicated or UI-specific analytics into shared engines instead of adding new parallel formulas.

Do not create another version of:

- Win rate.
- Profit factor.
- Expectancy.
- Max drawdown.
- Consistency.
- Trading Score.
- Pass Probability.
- Prop Survival.
- Session heatmap.
- AI payload generation.

If a screen needs a metric, it must derive it from the shared engine or from `calcStats` while the project is still migrating.

## 5. Trade Data Model

Main app type in `App.tsx`:

```ts
type Trade = {
  id: string;
  date: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entryTime?: string | null;
  exitTime?: string | null;
  entry?: number | null;
  exit?: number | null;
  contracts: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  pnl: number;
  mood: string;
  notes: string;
  tags?: string[];
  photoUri?: string | null;
  voiceUri?: string | null;
  voiceName?: string | null;
  createdAt?: number;
  updatedAt?: number;
};
```

Cloud table mapping:

- `trade_journal.client_id` maps to local `trade.id`.
- `trade_journal.trade_date` maps to `Trade.date`.
- `entry_time` and `exit_time` are text.
- `deleted_at` is used for soft delete sync.
- `tags` is `text[]`.
- Media currently maps to `screenshot_url` and `voice_url`.

Validation rules in `App.tsx`:

- `MAX_SYMBOL_LENGTH = 12`.
- `MAX_NOTES_LENGTH = 2000`.
- `MAX_MOOD_LENGTH = 32`.
- `MAX_CONTRACTS = 1000`.
- `MAX_PRICE = 10000000`.
- `MAX_ABS_PNL = 10000000`.
- `MAX_LOCAL_TRADES = 25000`.
- `MAX_SCREENSHOT_BYTES = 6 * 1024 * 1024`.
- `MAX_VOICE_NOTE_BYTES = 12 * 1024 * 1024`.

## 6. Analytics Engine

### 6.1 Official Normalization

Source file:

- `src/analytics/tradeNormalizer.ts`

Input:

- `TradeInput[]`, accepting app trade fields and alternate field names.

Output:

- `NormalizedTrade[]`.

Important normalized fields:

- `instrument`
- `side`
- `entryPrice`
- `exitPrice`
- `quantity`
- `pnl`
- `fees`
- `netPnl`
- `date`
- `session`
- `hour`
- `dayOfWeek`
- `week`
- `month`
- `tags`
- `mood`
- `notes`
- `screenshots`
- `stopLoss`
- `takeProfit`
- `riskAmount`
- `plannedRisk`
- `actualRisk`
- `rMultiple`
- `isWin`
- `isLoss`
- `isBreakeven`
- `confidence`
- `missingFields`

Session normalization in `tradeNormalizer.ts`:

- `< 8`: Asia
- `< 12`: New York AM when hour >= 9, otherwise London
- `< 14`: Midday
- `15 <= hour < 16`: Power Hour
- `>= 16`: After Hours
- otherwise Afternoon

Important: `App.tsx` also has `sessionLabelForTrade` with simpler Morning/Midday/Afternoon buckets. This is current debt. Do not add a third session definition. Future cleanup should consolidate session grouping into a shared engine with compatibility mapping for current UI.

### 6.2 Unified Trade Analytics

Source file:

- `src/analytics/tradeMetrics.ts`

Primary function:

```ts
buildUnifiedTradeAnalytics(input, shouldNormalize = true, includeGroups = true)
```

Output:

- `trades: NormalizedTrade[]`
- `equityCurve: EquityCurvePoint[]`
- `metrics: OfficialTradeMetrics`
- `sessionStats`
- `symbolStats`
- `dayOfWeekStats`

`App.tsx` uses:

- `buildUnifiedTradeAnalytics(trades)` inside `calcStats`.
- `infinitySafeMetric` to convert infinity-like metrics to UI-safe values.

### 6.3 Net P&L

Source of truth:

- `buildUnifiedTradeAnalytics` for official metrics.
- Adapted through `calcStats`.

Formula:

```text
netPnl = grossProfit - grossLoss
grossProfit = sum(netPnl for winning trades)
grossLoss = abs(sum(netPnl for losing trades))
```

Inputs:

- Normalized trades.
- `netPnl = pnl - fees`.

Output:

- `OfficialTradeMetrics.netPnl`
- `calcStats().pnl`

UI usage:

- Stats dashboard.
- Equity Curve hero.
- Monthly Intelligence.
- AI payloads.
- Share cards.
- Prop risk snapshots.

### 6.4 Win Rate

Source of truth:

- `buildUnifiedTradeAnalytics`.

Formula:

```text
winRate = winningTrades / totalTrades * 100
```

Inputs:

- Trades with `netPnl > 0`.
- Total trades includes breakeven trades.

Outputs:

- `OfficialTradeMetrics.winRate`
- `calcStats().wr`

Dependencies:

- Normalized trade outcomes.

UI usage:

- Stats dashboard.
- Performance Profile radar.
- Trading Score.
- Prop Survival.
- AI confidence score.
- Share cards.

### 6.5 Loss Rate And Breakeven Rate

Source of truth:

- `buildUnifiedTradeAnalytics`.

Formula:

```text
lossRate = losingTrades / totalTrades * 100
breakevenRate = breakevenTrades / totalTrades * 100
```

Inputs:

- `netPnl < 0` for losses.
- `netPnl === 0` for breakevens.

Output:

- `OfficialTradeMetrics.lossRate`
- `OfficialTradeMetrics.breakevenRate`

UI usage:

- Mostly supporting analytics/payload context.
- Win/loss counts shown in Stats dashboard derive from raw trade outcomes.

### 6.6 Gross Profit And Gross Loss

Source of truth:

- `buildUnifiedTradeAnalytics`.

Formula:

```text
grossProfit = sum(all positive netPnl)
grossLoss = abs(sum(all negative netPnl))
```

Inputs:

- Normalized trades.

Outputs:

- `OfficialTradeMetrics.grossProfit`
- `OfficialTradeMetrics.grossLoss`

Dependencies:

- Correct P&L normalization.

UI usage:

- Profit Factor.
- Pattern Detection.
- Analysis payloads.

### 6.7 Profit Factor

Source of truth:

- `buildUnifiedTradeAnalytics`.

Formula:

```text
profitFactor = grossProfit / grossLoss
if grossLoss == 0 and grossProfit > 0 -> Infinity
if no wins and no losses -> null
```

UI-safe adaptation:

- `infinitySafeMetric(value)` returns `99` for positive infinity.

Outputs:

- `OfficialTradeMetrics.profitFactor`
- `OfficialTradeMetrics.profitFactorLabel`
- `calcStats().pf`

UI usage:

- Pro-gated Stats metric.
- Performance Profile radar.
- Trading Score.
- Pattern Detection.
- AI payloads.
- Monthly PDF/export.

### 6.8 Average Win

Source of truth:

- `buildUnifiedTradeAnalytics`.

Formula:

```text
averageWin = grossProfit / winningTrades
```

Output:

- `OfficialTradeMetrics.averageWin`
- `calcStats().avgWin`

UI usage:

- Trade analysis payload.
- Share/export.
- Performance profile support.

### 6.9 Average Loss

Source of truth:

- `buildUnifiedTradeAnalytics`.

Formula:

```text
averageLoss = grossLoss / losingTrades
```

Average loss is a positive magnitude, not a negative number.

Output:

- `OfficialTradeMetrics.averageLoss`
- `calcStats().avgLoss`

UI usage:

- Risk Control.
- Trade analysis payload.
- Export/report.

### 6.10 Average Win/Loss Ratio

Source of truth:

- `buildUnifiedTradeAnalytics`.

Formula:

```text
averageWinLossRatio = averageWin / averageLoss
if averageLoss == 0 and averageWin > 0 -> Infinity
```

UI-safe adaptation:

- `infinitySafeMetric` maps infinity to `99`.

Output:

- `OfficialTradeMetrics.averageWinLossRatio`
- `calcStats().avgWinLoss`

UI usage:

- Pro-gated Stats metric.
- Performance Profile radar Reward Risk axis.
- Trading Score input.

### 6.11 Expectancy

Source of truth:

- `buildUnifiedTradeAnalytics`.

Current official formula:

```text
expectancy = (winRate / 100 * averageWin) - (lossRate / 100 * averageLoss)
```

Historical/product shorthand:

```text
expectancy = total net P&L / total trades
```

Important: the current code uses the weighted win/loss formula in `tradeMetrics.ts`, while some older docs describe net P&L divided by trade count. Do not add another formula. Future cleanup must choose one official definition and migrate all usages. Until then, `buildUnifiedTradeAnalytics` is authoritative for UI and AI payloads.

Output:

- `OfficialTradeMetrics.expectancy`
- `calcStats().exp`
- `calcStats().ev`

UI usage:

- Pro-gated Stats metric.
- Trading Score.
- AI payload.
- Monthly report.

### 6.12 R Multiple And Average R:R

Sources:

- `tradeNormalizer.ts` computes `rMultiple`.
- `App.tsx` `rrForTrade` computes Avg R:R for current UI.

Formulas:

```text
riskAmount = plannedRisk if present
otherwise abs(entryPrice - stopLoss) * quantity
rMultiple = netPnl / riskAmount
```

`App.tsx` Avg R:R fallback:

```text
if entry, stopLoss, takeProfit exist:
  risk = abs(entry - stopLoss)
  reward = abs(takeProfit - entry)
  rr = reward / risk
else if stopLoss and takeProfit are direct values:
  rr = takeProfit / stopLoss
```

Outputs:

- `OfficialTradeMetrics.rExpectancy`
- `calcStats().avgRR`

Current debt:

- R multiple and planned reward/risk are not fully unified.
- Do not add a third R/R engine.

### 6.13 Equity Curve

Sources:

- Official: `src/analytics/equityCurve.ts`.
- Current terminal chart helpers: `App.tsx` `buildEquityPoints`, `TerminalEquitySection`.
- Extracted visual component: `src/components/charts/AnimatedEquityCurve.tsx`.

Official formula:

```text
sort normalized trades chronologically
cumulativePnl += trade.netPnl
peak = max(peak, cumulativePnl)
drawdownFromPeak = cumulativePnl - peak
isNewHigh = cumulativePnl >= peak
```

Outputs:

- `EquityCurvePoint[]`
- `OfficialTradeMetrics.maxDrawdown`
- `calcStats().curve`

UI usage:

- Stats Equity Curve.
- AI context equity summary.
- Reports/share context.

Design rules:

- No haptics on chart interactions.
- Use subtle line/fill gradients, not neon overload.
- Tooltip should explain the selected point.

### 6.14 Max Drawdown

Source of truth:

- `maxDrawdownFromCurve` in `src/analytics/equityCurve.ts`, surfaced through `buildUnifiedTradeAnalytics`.

Formula:

```text
maxDrawdown = minimum drawdownFromPeak across the equity curve
drawdownFromPeak = cumulativePnl - peakCumulativePnl
```

Output:

- Negative number or zero.
- `OfficialTradeMetrics.maxDrawdown`
- `calcStats().maxDd`

UI usage:

- Equity Curve KPI row.
- Recovery Factor.
- Risk Control.
- Performance Profile radar.
- Prop Survival.
- AI payloads.

### 6.15 Recovery Factor

Source:

- `tradeMetrics.ts` for `OfficialTradeMetrics.recoveryFactor`.
- Current UI also computes recovery inside `Stats` and `buildTradeAnalysisPayload`.

Formula:

```text
if maxDrawdown < 0:
  recoveryFactor = netPnl / abs(maxDrawdown)
else if netPnl > 0:
  recoveryFactor = Infinity or UI-safe 99
else:
  null or 0 depending on UI adapter
```

Output:

- `OfficialTradeMetrics.recoveryFactor`
- UI local `recoveryFactor`

UI usage:

- Performance Profile radar Recovery axis.
- Trading Score input.
- AI payload.

Current debt:

- Recovery factor should be read from `buildUnifiedTradeAnalytics` everywhere instead of recalculated in screen code.

### 6.16 Consistency Score

Sources:

- Official-like implementation in `tradeMetrics.ts`.
- Current UI uses `App.tsx` `consistencyScoreFromTrades`.

Formula in `tradeMetrics.ts`:

```text
dailyPnl = sum netPnl by date
if no trades -> 0
if one daily sample -> 62
greenRate = greenDays / totalDays * 100
avgAbs = average(abs(dailyPnl))
stdev = standardDeviation(dailyPnl)
smoothness = 100 - (stdev / avgAbs * 42), clamped by later score
oversizedDependency = max(abs(dailyPnl)) / sum(abs(dailyPnl))
dependencyPenalty = 18 if > 0.55, 9 if > 0.4
drawdownPenalty = min(20, abs(maxDrawdown) / max(1, avgAbs * daily.length) * 35)
consistency = greenRate * 0.45 + smoothness * 0.45 + min(10, trades.length / 3) - penalties
clamp 0..100
```

Formula in older product docs:

```text
consistency = greenRate * 0.55 + stability * 0.45
```

Current rule:

- Do not create new consistency formulas.
- Future cleanup should make `tradeMetrics.ts` the only consistency source.

UI usage:

- Pro-gated Stats metric.
- Performance Profile radar.
- Trading Score.
- Prop Survival.
- AI payloads.
- Monthly report.

### 6.17 Stability / Sharpe-Style Daily Ratio

Source:

- `App.tsx` `sharpeRatioFromDaily`.
- `tradeMetrics.ts` exposes `stabilityScore`.

Current `App.tsx` formula:

```text
if fewer than 2 daily samples -> 0
avg = average(dailyPnl)
stdev = standardDeviation(dailyPnl)
if stdev == 0 and avg > 0 -> 99
else avg / stdev
```

Output:

- `calcStats().sharpeRatio`
- Pro-gated UI label currently "Stability Score".

Current debt:

- Naming should be standardized. Do not create another stability metric.

### 6.18 Risk Control

Sources:

- `tradeMetrics.ts` `riskControlScore`.
- `App.tsx` screen-local `drawdownControl`/`riskControl` calculations.

Formula in `tradeMetrics.ts`:

```text
lossStreakPenalty = min(24, currentLossStreak * 8)
drawdownPressure = min(28, abs(maxDrawdown) / max(1, abs(netPnl) + abs(maxDrawdown)) * 45)
lossDayPressure = min(22, maxLossDay / max(1, averageLoss * 3) * 18)
missingRiskPenalty = 14 if more than 50% of trades lack riskAmount
riskControl = clamp(100 - penalties, 0, 100)
```

Formula in current Stats UI:

```text
if netPnl > 0:
  drawdownControl = clamp(100 - absDrawdown / (abs(netPnl) + absDrawdown) * 100, 15, 100)
else:
  drawdownControl = max(10, 100 - absDrawdown / 10)
```

UI usage:

- Performance Profile radar Risk Ctrl axis.
- Trading Score input.
- Prop Survival input.
- Achievements.
- AI payload.

Current debt:

- Consolidate screen-local drawdown control into the shared analytics engine.

### 6.19 Trading Score

Source:

- `src/analytics/tradingScore.ts`.
- Called by `App.tsx` `tradingScoreForTrades`.

Inputs:

- Win Rate.
- Profit Factor.
- Expectancy.
- Consistency.
- Risk Control.
- Recovery Factor.
- Max Drawdown.
- Average Win/Loss Ratio.
- Trade Count.

Formula:

```text
pfScore = clamp(profitFactor / 2.2 * 100, 0, 100)
expectancyScore = if expectancy >= 0:
  min(100, 55 + abs(expectancy) / 8)
else:
  max(0, 45 + expectancy / 8)
recoveryScore = clamp(recoveryFactor / 3 * 100, 0, 100)
sample = clamp(tradeCount / 20 * 100, 0, 100)

score =
  winRate * 0.18
  + pfScore * 0.20
  + expectancyScore * 0.18
  + consistency * 0.16
  + riskControl * 0.18
  + recoveryScore * 0.06
  + sample * 0.04

final = clamp(round(score), 0, 100)
```

Grades:

- `A+`: 85+
- `A`: 75-84
- `B`: 65-74
- `C`: 50-64
- `D`: below 50

Percentile label:

```text
Top max(5, 100 - score)%
```

UI usage:

- Trader Status.
- AI Command Center confidence.
- Monthly intelligence.
- Export/report.
- Achievements.

### 6.20 Trader Level

Source:

- `src/analytics/achievements.ts` `traderLevelFromScore`.

Levels:

- Rookie: score below 58.
- Consistent: 58-75.
- Funded: 76-87.
- Elite: 88+.

UI usage:

- Terminal Trader Status.
- Achievement share cards.

### 6.21 Achievements

Source:

- `src/analytics/achievements.ts`.

Status:

```text
unlocked if progress >= target
next_target if progress >= target * 0.55
locked otherwise
```

Implemented achievements:

- First Trade Logged.
- 10 Trades Logged.
- 100 Green Trades.
- 10 Green Days.
- First Green Week.
- 5R Trade.
- Pass Eval.
- No Revenge Trading Week.
- Risk Discipline Streak.
- New Equity High.
- First $1K Month.
- First $10K Month.
- Top 20% Trader.
- One Step From Funding.

UI usage:

- Terminal Trader Status.
- Achievement share cards.

Share limits:

- Free: 2 achievement shares per day.
- Pro: 10 achievement shares per day.
- Preferred source: Supabase table `achievement_share_usage`.
- Fallback: local AsyncStorage.

### 6.22 Pass Probability

Source:

- `src/ai/passProbabilityEngine.ts`.

Inputs:

- Trades.
- Selected date.
- Prop template with evaluation target and max loss limit.

Formula:

```text
pnl = sum(trade.pnl)
target = max(1, template.evaluationTarget || 3000)
maxLoss = max(1, template.maxLossLimit || 2000)
progress = max(0, pnl / target) * 55
drawdown = abs(min(0, pnl))
buffer = max(0, 1 - drawdown / maxLoss) * 35
sample = min(10, trades.length / 2)
probability = clamp(round(progress + buffer + sample), 3, 98)
```

Statuses:

- `EXCELLENT`: 82+
- `ON_TRACK`: 58-81
- `AT_RISK`: 32-57
- `DANGER`: below 32

Confidence:

- High: 25+ trades.
- Medium: 10-24 trades.
- Low: fewer than 10 trades.

UI usage:

- AI Analytics Prop Firm Mission.
- Protect Pass Path bottom sheet.
- AI Command Center confidence.
- Prop risk context.

### 6.23 Prop Survival Score

Source:

- `src/analytics/propSurvival.ts`.

Inputs:

- Consistency.
- Drawdown.
- Profit Factor.
- Win Rate.
- Day P&L.
- Daily/account remaining buffer.
- Limits and expectancy if available.

Current formula:

```text
drawdownPenalty = min(35, abs(drawdown) / 250)
dayPenalty = dayPnl < 0 ? min(18, abs(dayPnl) / 150) : 0
pfBoost = min(20, max(0, profitFactor - 1) * 14)
probability = clamp(round(consistency * 0.34 + winRate * 0.28 + 30 + pfBoost - drawdownPenalty - dayPenalty), 5, 98)
```

Output:

- `probability`
- `topRisk`
- `biggestAdvantage`
- `recommendedAction`

UI usage:

- Stats achievements.
- Prop Firm Mission.
- Trading/risk context.

### 6.24 Revenge Trading Detection

Source:

- `src/ai/revengeTradingDetector.ts`.

Inputs:

- Trades.
- Selected date.
- Optional danger mode.

Formula:

```text
today = trades where trade.date == selectedDate
losses = count(today pnl < 0)
detected = dangerMode || losses >= 2 || today.length >= 5
severity = HIGH if dangerMode or losses >= 3
           MEDIUM if detected
           LOW otherwise
```

UI usage:

- AI Analytics.
- AI Command Center.
- Prop Firm Mission.

### 6.25 Hidden Leak Detection

Source:

- `src/ai/hiddenLeakDetector.ts`.

Detected leaks:

- Loss frequency: losses > half of sample.
- Mood-linked losses: losing trades with mood matching angry/fear/fomo/tilt/stress.

Output:

- Up to 3 leak objects with `title`, `impact`, `recommendation`.

UI usage:

- AI Analytics Pattern Detective.
- AI Command Center.

### 6.26 Pattern Detection

Source:

- `src/analytics/patternDetector.ts`.

Inputs:

- Trade P&L.
- Symbol.
- Mood.
- Tags.
- Date.

Current outputs:

- Strengths.
- Risks.
- Opportunity.

Current logic:

- Best instrument by net P&L.
- Positive/negative payoff profile using Profit Factor.
- Loss frequency pressure.
- Gross losses versus gross wins.

UI usage:

- AI Analytics Pattern Detective.
- Monthly Intelligence.
- Export/report context.

Future rule:

- Pattern detection should eventually use unified breakdowns from shared analytics, not isolated formulas.

### 6.27 Session Heatmap

Sources:

- Extracted: `src/analytics/sessionHeatmap.ts`.
- Current terminal UI: `App.tsx` `buildSessionCells` and `TerminalSessionIntelligence`.

`src/analytics/sessionHeatmap.ts`:

- Creates 24 hourly cells.
- Uses `entryTime`, `exitTime`, `createdAt`, or fallback hour 9.
- Outputs `hour`, `label`, `tradeCount`, `pnl`, `winRate`.

`TerminalSessionIntelligence`:

- Modes: Hours, Sessions, Days, Months.
- Uses `buildAnalysisBreakdown`.
- Creates heat intensity by absolute net P&L.
- Opens bottom sheet with trade count, win rate, net P&L, average P&L, and guidance.

Current debt:

- The extracted heatmap and terminal heatmap are not fully unified.
- Do not add another heatmap system.

### 6.28 Performance Profile Radar

Source:

- `App.tsx` `PremiumPerformanceRadar`.

Axes:

- Win Rate.
- Risk Ctrl.
- Consistency.
- Recovery.
- Profit Factor.
- Reward Risk.

Profile score:

```text
average(clamped axis scores)
```

Axis scoring:

- Win Rate: `min(100, stats.wr)`.
- Risk Ctrl: `drawdownControl`.
- Consistency: `consistency`.
- Recovery: `min(100, recoveryFactor / 4 * 100)`.
- Profit Factor: `min(100, stats.pf / 2.5 * 100)`.
- Reward Risk: `min(100, stats.avgWinLoss / 2.5 * 100)`.

UI usage:

- Stats screen after Equity Curve.
- Bottom sheet explains selected axis.

Design rule:

- Keep this premium radar. Do not revert to old ring grid unless explicitly requested.

## 7. AI System

AI in YouTrader is coaching, not prediction. It must never give financial advice, buy/sell/hold signals, market direction predictions, profit promises, or prop pass guarantees.

### 7.1 AI Data Sources

AI payloads are built from:

- Period trades from journal data.
- `calcStats(periodTrades)`.
- `buildAIAnalyticsContext(periodTrades)`.
- `buildTradeAnalysisPayload(...)`.
- Prop snapshot.
- Pass Probability.
- Revenge Trading result.
- Hidden Leaks.
- Recent trades with truncated notes.
- News item only for `news_explainer`.

Media handling:

- Screenshots, images, photo URI, voice URI, and voice name are stripped before cloud provider calls in `compactPayload`.
- The app does not send raw screenshots or voice notes to NVIDIA.

### 7.2 Client AI API

Source:

- `src/api/aiCoach.ts`.

Exports:

- `fetchAIWeeklyCoach`
- `fetchAIRiskPredictor`
- `fetchAIJournalSummary`
- `fetchAIDailyPlan`
- `fetchAINewsExplainer`
- `fetchAIDailyChallenge`

Client behavior:

- If Supabase is not configured: return local fallback.
- If no session exists: return local fallback.
- If Edge Function fails: return local fallback.
- If quota/cooldown response occurs: return local fallback with quota status.
- Do not expose raw server errors to the user.

Provider statuses:

- `nvidia`
- `local_fallback`
- `quota_exceeded`
- `free_preview`

### 7.3 Supabase Edge Function

Source:

- `supabase/functions/ai-coach/index.ts`.

Flow:

```text
POST ai-coach
  -> handle CORS/options
  -> require Authorization JWT
  -> create user-scoped Supabase client
  -> create admin client with service role key
  -> validate user
  -> validate action
  -> check server Pro entitlement in user_subscriptions
  -> if not Pro: return free_preview local analysis
  -> check AI quota/cooldown in ai_usage_events
  -> call generateAI(...)
  -> record usage event
  -> return normalized AI response
```

Server-only secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NVIDIA_API_KEY`
- `NVIDIA_MODEL`

Public/mobile env must never contain these secrets.

### 7.4 Cloud AI Provider

Source:

- `supabase/functions/_shared/aiProvider.ts`.

Provider:

- NVIDIA NIM via OpenAI-compatible API.
- Base URL: `https://integrate.api.nvidia.com/v1`.
- Default model: `meta/llama-3.1-70b-instruct`.
- Override: `NVIDIA_MODEL`.
- Timeout: 18 seconds.
- `temperature: 0.2`.
- `max_tokens: 900`.

System prompt rules:

- Return only strict JSON.
- No markdown.
- Use only the user journal/stat/news payload.
- No financial advice.
- No buy/sell/hold signals.
- Focus on discipline, risk, consistency, journaling behavior, and execution process.
- Include action-specific schema instructions.

Retries:

- Retry once for transient network `TypeError`.
- Retry once for 5xx.
- Do not retry 401, 403, or 429.

Fallback:

- Any cloud failure returns local deterministic fallback.

### 7.5 AI Schemas

Source:

- `supabase/functions/_shared/aiSchemas.ts`.

Actions:

- `weekly_coach`
- `risk_predictor`
- `journal_summary`
- `daily_plan`
- `news_explainer`
- `daily_challenge`

Schema normalization:

- Uses safe defaults.
- Limits arrays to 8 string items.
- Forces `news_explainer.notFinancialAdvice = true`.
- Clamps risk score to 0..100.
- Sanitizes unsupported risk levels and difficulty values.

### 7.6 AI Quotas

Source:

- `supabase/functions/_shared/aiQuota.ts`.

Quotas:

- `daily_plan`: 1/day, 60s cooldown.
- `risk_predictor`: 3/day, 45s cooldown.
- `weekly_coach`: 1/week, 300s cooldown.
- `journal_summary`: 3/day, 90s cooldown.
- `news_explainer`: 10/day, 15s cooldown.
- `daily_challenge`: 1/day, 60s cooldown.

Storage:

- `public.ai_usage_events`.

Behavior:

- Checks latest action timestamp for cooldown.
- Counts usage since day/week window.
- Inserts usage after generation.
- If quota check errors, allows request to avoid blocking Pro users due to telemetry failure.

### 7.7 Local AI / Trade Analysis

Sources:

- `src/api/aiCoach.ts` fallback functions.
- `src/api/tradeAnalysis.ts`.
- `App.tsx` `buildLocalTradeAnalysisResult`.

Trade analysis output includes:

- Summary.
- Disclaimer.
- Mistakes.
- Strengths.
- Recommendations.
- Detective Score.
- Main Blind Spot.
- Hidden Patterns.
- Agent Findings.
- Next Trading Rule.

Current status:

- `src/api/tradeAnalysis.ts` is local deterministic analysis, not true cloud AI.
- Some events still label source as `edge_function`; treat that as naming debt.

### 7.8 AI Analytics UI

Current sections:

- AI Command Center.
- Pattern Detective.
- Trading Coach.
- Prop Firm Mission.
- Monthly Intelligence.

AI Command Center confidence:

```text
confidence = clamp(round((passProbability.probability + tradingScore.score) / 2), 30, 98)
```

Refresh behavior:

- `Refresh Analysis` runs daily plan, risk predictor, weekly coach, journal summary, daily challenge, and local trade analysis.
- Shows updated timestamp from generated AI responses.
- Shows provider status via `CloudAIStatus`.

Free users:

- See blurred premium preview and lock overlay.
- Do not see a black empty screen.

News:

- `news_explainer` API still exists.
- Current product direction intentionally removes the News UI button/modal for "Explain with AI".

### 7.9 AI Caching

Current state:

- No durable AI response cache.
- Generated timestamps are UI state only.
- RevenueCat and Supabase manage their own SDK/session caches.

Future rule:

- If durable AI cache is added, it must be keyed by user, action, period, source data signature, and provider status. It must not duplicate analytics formulas.

## 8. Supabase Backend

Client config:

- Source: `src/config/appConfig.ts`.
- Uses `EXPO_PUBLIC_SUPABASE_URL`.
- Uses `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or fallback `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Placeholder and invalid values disable Supabase gracefully.
- Mobile auth storage uses AsyncStorage.
- Auth options:
  - `autoRefreshToken: true`
  - `persistSession: true`
  - `detectSessionInUrl: false`

Auth:

- Optional cloud sign-in controlled by `EXPO_PUBLIC_ENABLE_CLOUD_SIGN_IN`.
- Native Apple sign-in controlled by `EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGN_IN`, or automatically enabled on iOS when Supabase and cloud sign-in are configured.
- OAuth redirect uses scheme `com.youtrader.pro` and path `auth`.

Current runtime caveat:

- `App.tsx` currently hardcodes `authConfigured = false`.
- Cloud sign-in UI and handlers exist, but they show "Sign-in unavailable" until this is changed.
- Re-enabling auth requires end-to-end QA with Supabase redirect URLs, native Apple/OAuth provider settings, session persistence, and App Review behavior.

Database migration source:

- `supabase/migrations/20260627231000_add_runtime_tables_rls.sql` is now the self-contained migration path.

Runtime tables:

- `prop_firms`
- `user_firm_settings`
- `trade_journal`
- `risk_snapshots`
- `user_subscriptions`
- `ai_usage_events`
- `achievement_share_usage`

RLS:

- Enabled for all runtime public tables in the migration.
- User tables use `auth.uid() = user_id`.
- `prop_firms` templates are readable by authenticated users.

Security rules:

- Never use service role key in mobile.
- Never use user-editable metadata for authorization.
- Keep RLS enabled from day one.
- Use parameterized Supabase client methods and SQL policies.
- Storage bucket policies must be strict if storage features expand.
- Webhook signature verification is required before any server-side RevenueCat/Stripe/App Store webhook sync.

Edge Function CORS:

- `supabase/functions/_shared/cors.ts` currently uses `Access-Control-Allow-Origin: *`.
- Treat wildcard CORS as a temporary development/default state.
- Before production release, replace wildcard CORS with an allow-list for the production app/domain/environment where applicable.

Known backend risk:

- There are standalone historical SQL files (`risk-coach-schema.sql`, `ai-coach-schema.sql`) in addition to migrations. The migration is now authoritative for reproducible schema, but standalone files still exist for reference and may become stale.

## 9. RevenueCat And Subscriptions

Source:

- `src/config/appConfig.ts`.
- RevenueCat flow in `App.tsx`.

Public env:

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_PRODUCT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID`

Defaults:

- Entitlement: `pro`.
- Monthly product: `youtrader_pro_monthly`.
- Yearly product: `youtrader_pro_yearly`.
- Monthly display: `$12.99/mo`.
- Yearly display: `$99.99/yr`.

API key validation:

- iOS key must start with `appl_`.
- Android key must start with `goog_`.
- RevenueCat disabled on web.

Pro access:

- `customerHasRevenueCatProEntitlement`.
- `customerHasActiveProSubscription`.
- Server entitlement through `user_subscriptions`.
- Final `ProAccessState` is true if any source is active.

Offering/product fallback:

- First tries `Purchases.getOfferings()`.
- If packages are missing, falls back to direct `Purchases.getProducts`.
- Purchase flow accepts known Pro product IDs only.
- Yearly purchase never silently falls back to monthly.

Critical external setup:

- RevenueCat dashboard entitlement must match `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` and Supabase Edge `REVENUECAT_ENTITLEMENT_ID`.
- Monthly and yearly products must unlock the same entitlement.
- Both products should be in current/default offering.
- App Store Connect products must be attached and approved for TestFlight/App Store flow.

## 10. UI Design System

Design principle:

- Premium iOS 26 Liquid Glass, not neon dashboard.
- Every card answers one question.
- Prefer large numbers, small labels, minimal copy.
- Use visual hierarchy, spacing, blur, translucent material, and subtle motion.
- Do not simplify UI or reduce visual quality.

Color source:

- `src/theme/colors.ts`

Palette:

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

Color usage:

- 90% black/glass/grey.
- Lime green only for positive performance and key CTA emphasis.
- Purple only as a careful accent.
- Red only for loss/danger.
- Yellow only for caution.
- Avoid large neon glows, harsh outlines, gamer/cyberpunk look.

Glass surfaces:

- `src/components/ui/GlassCard.tsx` is base glass material.
- iOS uses `BlurView`.
- Android/non-iOS uses translucent dark fallback.
- Default radius: 24.
- Compact radius: 18.
- Default blur intensity: 38.
- Compact blur intensity: 22.
- Use compact glass for dense grids to reduce simultaneous blur cost.

Premium cards:

- `src/components/ui/PremiumGlassCard.tsx`.
- Uses press scale animation.
- Optional glow: green, purple, red, none.
- Default press scale: 0.985.
- Uses light haptic on valid press.

Premium locks:

- `src/components/ui/PremiumLockOverlay.tsx`.
- Must show blurred preview, not blank screen.
- Lock halo pulses subtly.
- CTA uses green.
- Secondary action uses purple.

Motion:

- Use subtle spring, opacity, blur, scale, and chart draw animations.
- No excessive bounce.
- Respect reduced motion where feasible.
- Do not add heavy animation dependencies without explicit approval.

Haptics:

- Source: `src/components/ui/haptics.ts`.
- Use haptics for meaningful taps and actions.
- Do not use haptics on chart interactions.

Typography:

- React Native system font stack.
- Heavy weights for hero values and important titles (`800`/`900`).
- Small uppercase labels for context.
- Keep copy short.

Spacing:

- Prefer spacious cards and rails over cramped grids.
- Dense stat tiles may use compact cards.
- Use bottom padding on screens to avoid tab overlap.

Component hierarchy:

- Screen container.
- Terminal stack.
- Hero/stat card.
- Visual analytic card.
- Supporting chips/metric pills.
- Bottom sheet for deeper explanation.

Core visual primitives:

- `GlassCard`
- `PremiumGlassCard`
- `PremiumLockOverlay`
- `NeonGlowBackground`
- `YouTraderLottie` placeholder
- `TerminalGlassCard`
- `SegmentedTimeFilter`
- `MetricPillRow`
- `AppleRing`
- `BottomSheetPanel`
- `CloudAIStatus`

Important UI features:

- Stats Dashboard.
- Equity Curve.
- Performance Profile radar.
- Session Heatmap.
- Trader Status achievements.
- AI Command Center.
- Pattern Detective.
- Trading Coach.
- Prop Firm Mission.
- Monthly Intelligence.
- Premium Paywall Preview.

## 11. Screens And Feature Areas

Journal:

- Add/edit/delete trades.
- Calendar-based journaling.
- Screenshots/photos.
- Voice notes.
- Notes, mood, tags.
- CSV import.
- Local storage.
- Optional Pro cloud sync.
- `DailyCoachCard` code may still exist, but current product direction does not render it in Journal.

Stats:

- Free-visible core stats:
  - Win Rate.
  - Trades.
  - Win/Loss.
  - Month P&L.
  - Biggest Win.
  - Biggest Loss.
  - Max streak basics where surfaced.
  - Live news remains generally visible.
- Pro-gated advanced stats:
  - Profit Factor.
  - Expectancy.
  - Consistency.
  - Stability/Sharpe-style metric.
  - Avg Win/Loss.
  - Full AI/advanced exports.

AI Analytics:

- Pro-gated with premium preview for free users.
- Five-section command center structure.
- Uses local deterministic engines and cloud AI where available.

Calendar:

- Journal-first calendar.
- Today usable.
- Extended/future access can be Pro-gated.
- Calendar should show calm green/red performance context.

News:

- Clean premium market awareness list.
- Free users can see news list.
- No current `Explain with AI` button/modal.
- News must not imply trade signals.

Calculator / Prop Risk:

- Prop firm risk calculator and risk coach.
- Uses prop firm templates and current journal data.
- Survival before speed.

Settings:

- Subscription/paywall.
- Sign-in/sync.
- Export/import tools.
- Legal links.
- Language.
- Cloud sync state.

## 12. Import, Export, Share, Reports

CSV import:

- Source: `src/utils/importTradesCsv.ts`, `src/utils/readCsvFile.ts`.
- UI: `App.tsx` document picker flow.
- Requires header row such as date, symbol, direction, pnl.
- Optional fields include entry, exit, contracts, notes.

Share/export:

- `src/components/insights/shareExport.ts`.
- Dynamically imports:
  - `react-native-view-shot`
  - `expo-sharing`
  - `expo-print`
  - `expo-media-library`

Functions:

- `shareCapturedView`
- `saveCapturedViewToPhotos`
- `shareMonthlyPdfReport`
- `shareWeeklyPdfReport`

Report HTML:

- `src/reports/weeklyReportHtml.ts`.
- Escapes HTML.
- Includes educational disclaimer.

Achievement share:

- Owned by `TerminalTraderStatus`.
- Checks quota.
- Renders offscreen `AchievementShareCard`.
- Waits for layout.
- Captures PNG.
- Opens native share sheet.
- Tracks `achievement_share_generated`.

## 13. Observability

Sources:

- `src/lib/logger.ts`
- `src/lib/posthog.ts`
- `src/observability/analytics.ts`
- `src/observability/metrics.ts`
- `src/observability/monitoring.ts`

Current implementation status:

- `src/lib/posthog.ts` currently exports `posthogClient = undefined`.
- `src/observability/monitoring.ts` is a no-op wrapper except development `console.error` / `console.log`.
- `wrapAppWithSentry` currently returns the component unchanged.
- Treat production observability as placeholder until real PostHog/Sentry/Crashlytics wiring is implemented or intentionally removed.

Rules:

- Track important user and revenue events.
- Log caught errors with feature/action metadata.
- Do not log secrets.
- Avoid logging private journal notes unnecessarily.

Tracked areas include:

- Paywall viewed.
- Subscribe pressed.
- Purchase success/failure.
- Restore success/failure.
- AI generation success/failure.
- Share/export flows.
- Signup started/completed.

## 14. Security Rules

Permanent rules:

- Never put private keys in chat or client code.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `NVIDIA_API_KEY`, or webhook secrets in Expo public env.
- Keep JWT/session lifetimes short in backend config where controllable. Target maximum JWT lifetime: 7 days with refresh-token rotation.
- Use Supabase Auth, Clerk, or Auth0. Do not build auth entirely from scratch.
- RLS must be enabled on every public user-data table.
- Storage buckets must be user-scoped if storage is added/expanded.
- Validate and sanitize user input.
- Use Supabase query builder or parameterized SQL. No string-concatenated SQL.
- Verify webhook signatures before processing payment/subscription events.
- Rate limit every server endpoint, including mobile APIs and password reset flows.
- AI API usage must have dashboard and code-level cost limits.
- Separate test and production environments.
- Test webhooks must never affect production systems.
- Rotate secrets at least every 90 days.
- Run dependency vulnerability checks before release.
- Do not run `npm audit fix` without reviewing risk.
- Remove debug `console.log` before release.
- CORS for Edge Functions must not use wildcard for production if credentials or sensitive operations are involved.
- Redirect URLs must be allow-listed.

## 15. Engineering Rules

Rules for all future development:

- Read `MASTER_CONTEXT.md` first.
- If unclear, inspect code before asking the user.
- Do not ask questions already answered here.
- Never rewrite working architecture without a focused migration plan.
- Never simplify premium UI.
- Never remove existing features silently.
- Never create duplicate calculations.
- Never create duplicate AI prompts.
- Never create duplicate analytics engines.
- Every metric must have one engine.
- Every screen must derive data from shared analytics.
- Reuse existing services, helpers, and components.
- Keep journal trades as the source of truth.
- AI interprets analytics; it does not replace deterministic metrics.
- Keep free user value visible.
- Keep Pro locks premium and non-punitive.
- Avoid heavy native dependencies unless explicitly approved.
- Keep changes scoped and production-ready.
- Run `npm run typecheck` after code edits.
- Run `npx expo-doctor` after dependency or build config changes.
- Run Aikido scan after modifying first-party source code.
- Update this file after any major architecture, engine, AI, backend, subscription, or design-system change.

## 16. Current Known Risks And Debt

Architecture debt:

- `App.tsx` is very large and mixes orchestration, screens, components, styles, and some calculations.
- Stats and AI terminal components should eventually move to `src/components/stats` and `src/components/ai`.
- Screen-level code should eventually move to `src/screens`.

Analytics debt:

- `tradeMetrics.ts` is the emerging official engine, but `App.tsx` still contains screen-local versions of consistency, recovery, drawdown control, session grouping, breakdowns, and heatmap logic.
- Session definitions differ between `tradeNormalizer.ts` and `App.tsx`.
- Expectancy definition differs between older product docs and current official implementation.
- Heatmap exists in both `src/analytics/sessionHeatmap.ts` and terminal-specific `App.tsx`.

Documentation debt:

- Older docs remain useful historically but can be stale.
- `README.md` and `FINAL_STEPS.md` contain old pricing/version/product notes.
- This file is authoritative.

Release/build debt:

- `npx expo-doctor` currently reports 17/18 checks with one known warning: native folders exist while `app.json` still contains native configuration fields. EAS will not automatically sync those fields in non-CNG mode.
- Native folders are present, so native config must be kept in sync deliberately.
- Build artifacts and backups may exist in the repo root; do not commit `.ipa`, secrets, or backups.

External setup risks:

- RevenueCat entitlement ID must match app env, RevenueCat dashboard, App Store products, and Supabase Edge Function env.
- Supabase migrations must be deployed and verified in the target project.
- NVIDIA production usage may require paid/approved deployment and can rate-limit.
- TestFlight subscription flow must be manually verified.

Current scan issue:

- Aikido MCP login can report "Already signed in" while `aikido_full_scan` returns `Invalid token provided`. If this happens, re-authenticate Aikido before relying on scan results.

## 17. Roadmap

### Completed

- Expo SDK 54 / React Native 0.81 app baseline.
- GitHub repository connected.
- Aikido repository/plugin connected, though current token may need re-auth for scanning.
- Supabase client config with safe placeholder detection.
- Supabase auth session persistence.
- Optional cloud sign-in.
- Optional Pro cloud journal sync with Realtime.
- RevenueCat subscription integration.
- Monthly and yearly product support.
- Product fallback when offerings are missing.
- App Store subscription legal disclosure component.
- NVIDIA AI through Supabase Edge Function.
- Server-side AI quota/cooldown table.
- Local AI fallback.
- AI Analytics five-section command center.
- News AI Explainer removed from News UI.
- Journal `DailyCoachCard` removed from render path.
- Premium iOS 26 visual polish.
- Performance Profile radar.
- Equity Curve.
- Session Heatmap.
- Trader Status achievements and share flow.
- CSV import.
- PDF/report/share utilities.
- Supabase runtime migration made self-contained.
- `package.json` and `package-lock.json` aligned to version `1.5.7`.

### In Progress

- Stabilizing release readiness.
- Manual iPhone/iPad UI QA.
- RevenueCat dashboard/App Store/TestFlight verification.
- Supabase migration deployment/verification.
- Aikido authentication repair for successful scans.
- Consolidating source-of-truth analytics.
- Reducing `App.tsx` technical debt safely.

### Planned

- Extract Stats terminal components:
  - `TerminalEquitySection`
  - `PremiumPerformanceRadar`
  - `TerminalSessionIntelligence`
  - `TerminalTraderStatus`
- Extract AI components:
  - `TerminalAICommandCenter`
  - `TerminalPatternDetective`
  - `TerminalTradingCoach`
  - `TerminalPropFirmMission`
  - `TerminalMonthlyIntelligence`
- Move screen-level code into `src/screens`.
- Move remaining formulas from `App.tsx` into shared analytics modules.
- Standardize session buckets.
- Standardize expectancy definition.
- Add focused tests for analytics formulas and AI payload builders.
- Add Supabase migration verification workflow.
- Update stale docs or replace them with pointers to `MASTER_CONTEXT.md`.

### Blocked / Requires Human Or External Decision

- RevenueCat dashboard entitlement/product verification.
- App Store Connect subscription setup and approval.
- TestFlight sandbox purchase/restore testing.
- Real device/simulator visual QA on iPhone and iPad.
- Decision to accept non-CNG warning or migrate config strategy.
- Aikido MCP token repair if scan remains invalid.
- Production NVIDIA capacity/licensing decision.

### Future Ideas

- Richer iPad layouts for Stats and AI.
- Better monthly intelligence timeline.
- More interactive heatmap evidence views.
- Durable AI result cache keyed by data signature.
- More granular prop firm templates and remote updates.
- More robust local analytics tests.
- Server-side audit logs for critical actions if backend expands.
- Webhook-driven subscription sync with signature verification.
- Account deletion/GDPR flow.
- Automated backup and restore test workflow.

## 18. Development Checklist For Future Chats

Before changing code:

1. Read `MASTER_CONTEXT.md`.
2. Inspect the exact files involved.
3. Check current Git status.
4. Identify the existing engine/component/service to reuse.
5. Explain current state, remaining work, and implementation plan.

After changing code:

1. Update `MASTER_CONTEXT.md` if the change affects architecture, metrics, AI, Supabase, RevenueCat, UI system, or roadmap.
2. Run `npm run typecheck`.
3. Run `npx expo-doctor` if dependencies/build config changed.
4. Run Aikido scan for first-party source-code changes.
5. Do not commit `.env`, secrets, `.ipa`, generated backups, or unrelated artifacts.

## 19. Immediate Next Steps

Recommended next work order:

1. Re-authenticate Aikido and run scan successfully.
2. Deploy/verify Supabase migrations in the target project.
3. Verify RevenueCat entitlement/product IDs across app env, dashboard, App Store Connect, and Supabase Edge Function.
4. Run iPhone simulator QA.
5. Run iPad simulator QA.
6. Verify achievement share capture.
7. Verify Supabase auth and Pro cloud sync.
8. Decide/document Expo Doctor non-CNG warning strategy.
9. Clean release artifacts before any release commit/package.
10. Start analytics consolidation only after release-critical checks are stable.
