# Performance Radar — score sources (build 113)

All axes use local Journal trades via `calcStats` / grouping. No AI. Invented values forbidden.

Minimum sample: **5 trades** (`RADAR_MIN_TRADES`). Below that, Radar shows insufficient-data state only.

| Axis | Source | Score rule |
|------|--------|------------|
| Profitability | win rate + profit factor | `0.55 * WR + 0.45 * min(100, PF/2.5*100)` |
| Consistency | green trading days | `% of days with net P&L > 0` |
| Risk Control | `stats.drawdownControl` | existing Journal drawdown-control score |
| Discipline | oversized losses | `100 - (oversizedLosses / tradeCount * 100)` where oversized = loss > 1.5× avg loss |
| Setup Quality | expectancy vs avg \|trade\| | `50 + (expectancy / avgAbs) * 40` (clamped) |
| Session Timing | session P&L concentration | share of strongest session bucket + baseline |

Code: `src/stats/performanceRadar.ts`
