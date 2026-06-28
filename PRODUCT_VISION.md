# YouTrader Product Vision

Last updated: 2026-06-27

This document is the long-term product vision for YouTrader. Every future Cursor chat should read it alongside `MASTER_CONTEXT.md`. When product direction conflicts with older docs, this file and `MASTER_CONTEXT.md` win together: this file defines *why* and *what*; `MASTER_CONTEXT.md` defines *how* the codebase implements it today.

---

## What YouTrader Is

YouTrader is a premium, AI-powered trading journal for futures and prop-firm traders on iOS.

It is not a signal app. It is not a market predictor. It is not a crypto dashboard.

YouTrader helps traders understand their own execution: risk, consistency, session behavior, emotional patterns, drawdown control, and prop-firm survival. The journal is the source of truth. Deterministic analytics explain the journal. AI coaches the trader using those analytics — it never replaces them.

The product should feel like it belongs inside Apple's ecosystem: calm, glassy, disciplined, information-dense, and visually confident — closer to Apple Health, Apple Wallet, Apple Stocks, and Linear than to Edgewonk, TradeZella, or TraderSync.

---

## Why Traders Choose YouTrader

YouTrader must clearly outperform legacy journaling platforms in ways traders feel immediately:

| Dimension | YouTrader advantage |
|---|---|
| UI quality | iOS 26 Liquid Glass, premium spacing, no clutter, no dashboard noise |
| Native experience | Mobile-first, haptics, blur, spring motion, iPad-aware layouts |
| AI coaching | Process-focused coaching derived from real journal stats, not generic tips |
| Analytics | One engine, mathematically consistent metrics, visual equity/radar/heatmap |
| Premium feeling | Pro locks show blurred value, not blank punishment |
| Accuracy | Every headline metric comes from `tradeMetrics.ts` / `calcStats()` |
| Animations | Subtle chart draw, press scale, glass depth — never gamer bounce |
| Clarity | One card, one question; no duplicated insights across tabs |
| Performance | Memoized analytics, no repeated heavy calculations per render |

### vs Edgewonk

Edgewonk is powerful but desktop-era, dense, and visually dated. YouTrader wins on mobile-native polish, instant visual feedback, and AI coaching that reads like a calm performance coach — not a spreadsheet export.

### vs TradeZella

TradeZella is web-first and analytics-heavy but often feels like a SaaS dashboard. YouTrader wins on iOS-native feel, prop-firm context, calmer information hierarchy, and tighter integration between journal → stats → AI.

### vs TraderSync

TraderSync emphasizes sync and reporting breadth. YouTrader wins on emotional product quality, prop survival intelligence, session heatmaps, and an Apple-grade interface that traders want to open every day.

---

## Emotional Feeling

When a trader opens YouTrader, they should feel:

- **In control** — risk buffers, pass path, and drawdown are visible and honest
- **Calm** — dark glass surfaces, no neon panic, no signal noise
- **Seen** — the app understands their patterns from their own data
- **Disciplined** — coaching pushes process, not prediction
- **Proud** — achievements and share cards feel premium, not gamified
- **Professional** — this is a performance terminal, not a side hustle toy

The app should never create FOMO, urgency to trade, or implied profit promises.

---

## Product Philosophy

1. **Journal first** — if it is not logged, it does not exist in analytics or AI.
2. **Explain, don't predict** — show what happened and why discipline matters.
3. **One truth per metric** — never show two formulas for the same label.
4. **Premium without punishment** — free users see real value; Pro unlocks depth.
5. **Less, but better** — remove duplicate blocks before adding new ones.
6. **Prop survival before speed** — evaluation and funded safety come before aggression.
7. **Apple bar** — if it would look wrong in Apple Health, it does not ship.
8. **Ship ready** — every change must typecheck and preserve production behavior.

---

## Non-Negotiable Engineering Rules

- Read `MASTER_CONTEXT.md` before coding.
- Never expose private API keys in the mobile bundle.
- Never call cloud AI directly from React Native — use Supabase Edge Functions with local fallback.
- Keep RevenueCat and Supabase auth/sync logic intact unless explicitly migrating.
- Do not add heavy native dependencies without approval.
- Do not create parallel analytics formulas in screens.
- Do not add React Navigation without a migration plan.
- Run `npm run typecheck` after code changes.
- Run Aikido scan after first-party source changes.
- Update `MASTER_CONTEXT.md` when architecture, metrics, AI, backend, or design system changes.
- No financial advice, buy/sell/hold signals, or profit guarantees — ever.

---

## Single Source Of Truth Architecture

```text
Journal trades
  → normalize (tradeNormalizer.ts)
  → buildUnifiedTradeAnalytics (tradeMetrics.ts)
  → calcStats() adapter in App.tsx
  → UI / AI payloads / exports
```

Rules:

- `src/analytics/tradeMetrics.ts` is the official metrics engine.
- `calcStats()` surfaces UI-safe values including consistency, recovery factor, drawdown control, and risk control.
- AI payloads must be built from `calcStats()`, `buildTradeAnalysisPayload()`, and deterministic engines — never invented numbers.
- Session, heatmap, and breakdown logic should consolidate over time; do not add a third parallel system.

Forbidden duplicates:

- Win rate, profit factor, expectancy, max drawdown, consistency, recovery factor, trading score, pass probability, prop survival, session heatmap, AI payload builders.

---

## AI Philosophy

AI in YouTrader is **coaching**, not **prediction**.

AI may:

- Interpret journal statistics
- Highlight behavioral leaks and discipline gaps
- Suggest process rules and risk adjustments
- Summarize weekly/monthly performance patterns
- Explain news context educationally

AI may not:

- Invent metrics not present in the payload
- Give buy/sell/hold signals
- Predict market direction
- Guarantee prop pass or profits
- Replace deterministic engines

Flow:

```text
Journal → analytics engines → structured payload → Edge Function / local fallback → normalized JSON UI
```

Cloud AI uses NVIDIA NIM behind Supabase with quotas, Pro entitlement checks, and strict JSON schemas. Local fallback always remains available.

---

## UI Philosophy

Design reference: **iOS 26 Liquid Glass**.

Principles:

- 90% black, glass, and grey; lime green for positive performance; purple as careful accent; red for loss only
- One card answers one question
- Large numbers, small uppercase labels
- GlassCard / PremiumGlassCard / BottomSheetPanel hierarchy
- Pro locks use blurred preview via PremiumLockOverlay
- No cyberpunk, neon overload, gamer UI, or crypto-dashboard aesthetics
- No UI clutter — merge blocks that repeat the same insight
- Spacing stays generous; dense areas use compact glass intentionally
- Haptics on meaningful actions, never on chart scrubbing

Screen information hierarchy:

1. Hero metric or status
2. Visual analytic (curve, radar, heatmap)
3. Supporting pills/chips
4. Bottom sheet for deeper explanation

---

## Performance Philosophy

Optimize only where it improves the real product:

- Memoize `calcStats`, trading score, heatmap cells, and period filters
- Avoid recalculating analytics inside render paths
- Remove dead computations when sections are removed
- Prefer derived state over duplicated state
- Keep blur layers intentional — compact glass in dense grids
- Do not refactor for aesthetics alone

Target: instant tab switches, smooth scroll, stable chart frames on iPhone and iPad.

---

## Analytics Philosophy

Analytics exist to answer trader questions honestly:

- Am I profitable?
- Is my edge stable?
- Where do I leak?
- Which session/day/instrument works?
- Can I survive this prop evaluation?
- Am I improving over time?

Every answer must trace back to logged trades. Visualizations (equity curve, trading radar, heatmap) are first-class — numbers without context are insufficient.

Prop-firm analytics (pass probability, survival score, buffers, contract plan) are core differentiation and must remain prominent in AI Analytics, not buried in settings.

---

## Future Roadmap

### Near term

- Manual iPhone/iPad QA and TestFlight verification
- RevenueCat / App Store Connect alignment
- Supabase migration deploy and auth/cloud sync QA
- Extract Stats and AI terminal components from `App.tsx`
- Consolidate session definitions and remaining screen-local formulas
- Focused tests for analytics engines and AI payload builders

### Medium term

- Richer iPad layouts for Stats and AI Analytics
- Durable AI cache keyed by data signature
- Server-side subscription webhook sync with signature verification
- Account deletion / GDPR flow
- Observability wiring (PostHog / Sentry) or intentional removal

### Long term

- More granular prop firm templates with remote updates
- Interactive heatmap evidence views
- Better monthly intelligence timeline
- Automated backup/restore verification
- Server audit logs for critical account actions

---

## How To Use This Document

Before building a feature, ask:

1. Does this make YouTrader feel more Apple-native and premium?
2. Does it duplicate an existing metric or insight?
3. Does AI use only real journal-derived data?
4. Does it help traders understand themselves — not the market?
5. Would we be proud to show this beside Apple Health on the App Store?

If any answer is no, redesign before shipping.
