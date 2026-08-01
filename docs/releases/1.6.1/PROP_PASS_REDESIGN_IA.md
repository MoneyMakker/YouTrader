# Prop Pass Product Redesign — Information Architecture

Build **113** · Phase 4F remains **FAILED / OPEN / NO-GO** · Production Supabase untouched

## Product hierarchy

1. Futures Trading Journal  
2. Prop Pass  
3. Trading Statistics  
4. Trading Calendar  
5. More → Calculator, News, Settings, Reports  

Positioning copy (user-facing):

> YouTrader is a futures trading journal built to help prop traders protect drawdown, build discipline, and pass their challenges.

## Five-tab navigation

| Tab | Role |
|-----|------|
| Journal | Primary log loop |
| Prop Pass | Challenge execution (allowlisted only) |
| Stats | Trading statistics |
| Calendar | Economic + journal calendar |
| More | Calculator, News, Settings, secondary |

When Prop Pass is hidden: `Journal · Stats · Calendar · More` (four tabs, no gap).

Calculator also available as a Journal quick action (deeplink/tab More → Calculator).

## Prop Pass home (top → bottom)

1. **AccountSwitcher** — firm · size · phase · freshness (no UUIDs)  
2. **ChallengeHero** — status / P&L vs target / rooms / one insight  
3. **TargetProgress** — balance, % progress, days, best/worst  
4. **BufferHealth** — daily / trailing / max loss with human copy  
5. **TodaysTradingPlan** — max trades, stops, focus (ex-Assignments)  
6. **PropInsights** — readiness / working / risk / next (ex-PI)  
7. **RecentChallengeActivity** — short timeline + “View history”  
8. **AccountOverflow** — Details / Default / Refresh / Disconnect / Archive (secondary)

## Component map

| Component | Path (new or evolve) | Data source |
|-----------|----------------------|-------------|
| `formatPropMoney` | `src/propPass/formatMoney.ts` | minor units → display only |
| `challengeStatusFromModel` | `src/propPass/presentation.ts` | snapshot lifecycle + buffers |
| `PropPassAccountSwitcher` | `src/propPass/ui/PropPassAccountSwitcher.tsx` | view model account |
| `PropPassChallengeHero` | `src/propPass/ui/PropPassChallengeHero.tsx` | progress + buffers + status |
| `PropPassTargetProgress` | `src/propPass/ui/PropPassTargetProgress.tsx` | progress |
| `PropPassBufferHealth` | evolve `BufferHealthSection.tsx` | buffers |
| `PropPassTodaysPlan` | `src/propPass/ui/PropPassTodaysPlan.tsx` | assignment summary |
| `PropPassInsightsCard` | evolve PI panel surface copy | intelligence snapshot |
| `PropPassRecentActivity` | `src/propPass/ui/PropPassRecentActivity.tsx` | history slices |
| `PropPassHistoryScreen` | `src/propPass/PropPassHistoryScreen.tsx` | attempts + events |
| `PropPassAccountMenu` | `src/propPass/ui/PropPassAccountMenu.tsx` | archive / refresh |
| `MoreScreen` | `src/app/MoreScreen.tsx` | nav hub |
| Forbidden AI copy guard | `scripts/qa/forbiddenAiCopy.selftest.ts` | locales + src strings |

## Presentation rules

- Never show minor units, UUIDs, fixture labels, “Confidence unknown”, “Score 0”.  
- Insufficient data → “Building your challenge profile” / assign N more trades.  
- Readiness labels: High / Moderate / Low / More Data Needed (deterministic from existing score or insufficient).  
- Pass probability only if server-authoritative metric exists; otherwise omit.  
- Diagnostics → Settings → Developer Diagnostics (staging/dev only).  
- Archive → destructive YDL sheet, not primary CTA.

## Security / data contracts (unchanged)

Eligibility, RLS, immutable snapshots, processor isolation, stale-write protection, user isolation, polling cancel on logout — client formats and presents only.

## Delivery commits (order)

1. Terminology + forbidden AI-copy guard  
2. Five-tab navigation + More  
3. Shared formatters / presentation  
4. Hero + Target Progress  
5. Buffer Health  
6. Today’s Plan  
7. Prop Insights  
8. History + account menu  
9. States / resilience  
10. A11y + visual coverage  
11–12. Simulator + physical evidence  

## Rename table (user-facing)

| Old | New |
|-----|-----|
| AI Analytics | removed / Trading Review surfaces |
| AI Coach / Daily Coach | Trading Review |
| Performance Intelligence | Prop Insights |
| AI Summary | Trade Summary |
| AI Report | Performance Report |
| Performance Coach | Prop Challenge Tracking |
| Assign Trades (primary) | Review Unassigned Trades / Edit Today’s Plan |
