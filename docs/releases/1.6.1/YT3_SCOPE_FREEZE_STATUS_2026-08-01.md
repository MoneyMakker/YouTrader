# YT3 Scope-Freeze Status — 2026-08-01 (updated)

Phase 4F status: **OPEN / NO-GO for authorizing build 115**

## Freeze compliance

- No App Store / TestFlight upload
- No metadata or screenshot changes
- No Add/Submit for Review
- Public version **1.6.1**
- Configured build number remains **113** — **build 115 NOT CREATED**
- Subscription product IDs / trial config / Settings IA / dependency versions **NOT MODIFIED**
- Production target: `izzrlsgumyabdvlmwlwn` (YouTrader)
- Local CLI link remains staging (`zleojeqkzizeyerhjpur`)

---

## 1. Starting / ending HEAD

| Item | Value |
|------|-------|
| Branch | `release/1.6.1-build-115` |
| Start (this regression run) | `efaeb1e` |
| End | `c1c7c36` |
| Preserved | `a73b40f`, `87c0780`, `efaeb1e` and descendants |
| Checkpoint | `checkpoint/yt3-regression-fix-20260802T054542Z` |
| Commits | `f71904e` stats radar/heatmap · `8cc3eef` journal day + manual P&L + Prop Pass tab · `c1c7c36` tests |

---

## 2. Performance Radar restore

| Item | Value |
|------|-------|
| Restored from | Existing `src/stats/performanceRadar.ts` + new visual `src/stats/StatsRadarCard.tsx` (lime SVG; adapted from prior `StatsPerformanceRadar` approach at `845df8d` / `src/components/stats/StatsPerformanceRadar.tsx`, without purple/profile score) |
| Wired in | `src/stats/StatsDashboard.tsx` (empty + populated paths) |

### Sufficient data

- Lime polygon/line + subtle lime fill, readable grid/labels, dark elevated card
- Deterministic axes from journal (`calcStats` / grouping): Profitability, Consistency, Risk Control, Discipline, Setup Quality, Session Timing
- Accessibility summary of actual scores
- No fake profile score

### Insufficient data

- Section remains visible
- Neutral dashed preview outline (no fabricated polygon)
- Exact progress: `N of 5 trades` + “Log X more trades…”
- Does not duplicate Insights Learning card inside Radar

---

## 3. Trading Heatmap restore

| Item | Value |
|------|-------|
| Restored from | Existing `src/stats/tradingHeatmap.ts` + new visual `src/stats/StatsHeatmapCard.tsx` (adapted from `StatsSessionHeatmap` cell coloring pattern) |
| Filters | Day × Hour · Weekday · Session · Instrument · Setup (horizontal chips, lime selected) |

### Sufficient / insufficient

- Graduated lime (pos) / red (neg) / neutral empty cells; compact legend
- Selected cell: trades, WR, avg, total
- Scaffold grid always present; empty cells stay `count=0` / `pnl=0` (no faked fullness)
- Readiness: `Log N more comparable trades` + `N of 4 trades`

---

## 4. Final Stats structure

Order: Period → Hero → Equity → Core Metrics → **Radar** → **Heatmap** → Breakdown → Insights learning (when needed) → Best Edge / Leak → Risk → Consistency → Recent Trend → Reports.

Zero trades: one primary empty hero + compact Radar/Heatmap previews (no duplicate large empty cards).

---

## 5. Journal selected-day Add Trade

- Journal title / permanent Add Trade / Synced header **remain removed**
- Day tap / compact arrow opens `BottomSheetPanel` day panel immediately
- Empty day: “No trades for this day” + prominent Add Trade
- Populated day: trade list + Add Trade
- `openNew(selectedDate)` prefills date; a11y: `Add trade for {long date}` / `View trades for {long date}`
- Inline day detail Add Trade retained below calendar

---

## 6. Manual P&L amount

- Mode selector: **Calculate** | **Manual**
- Manual: absolute amount field + Profit / Loss / Breakeven (one sign system via `src/journal/manualPnl.ts`)
- Calculate: instrument tick math from entry/exit
- Result card lime/red/neutral matches signed value
- Switching Manual→Calculate confirms when unsaved manual draft would be lost
- Hint `journalFormPnlHintManual` no longer shown without a connected manual field

---

## 7–8. Five-tab Prop Pass contract

Final order: Journal → **Prop Pass** → Stats → Settings → More

| Entitlement | Behavior |
|-------------|----------|
| None | Tab visible; `PropPassLockedPreview` (capabilities + Unlock / View Plans / Restore). Paywall only via CTA → More subscription |
| Active Pro | Existing `PropPassInternalScreen` (engine untouched) |
| CustomerInfo change | Content swaps; tab order unchanged |

`propPassTabVisible` no longer requires `isPremium` (QA force-hide only).

---

## 9–10. Physical build-113 regression QA

| Step | Result |
|------|--------|
| RS 113 rebuild from `c1c7c36` | **PASS** (`build_ok`, fingerprint `YT_BUILD_FP_v1:c1c7c36:113:Release-Staging`) |
| Install on physical iPhone 14 Pro Max | **PASS** |
| `physical-device-tool verify113` | **PASS** |
| Launch + interactive checklist (Radar/Heatmap/Journal/Manual P&L/5 tabs) | **BLOCKED** — device **Locked** (`SBMainWorkspace` denied launch) |
| Screenshots | **NOT RUN** (need unlock; store in gitignored `phase4f-screenshots/physical/pre115-regression-20260802/`) |

---

## 11. Automated gates (this run)

| Check | Result |
|-------|--------|
| typecheck | PASS |
| translations:check | PASS |
| test:email-password | PASS |
| test:revenuecat-mobile-identity | PASS |
| test:revenuecat-entitlement | PASS |
| regression-restore-pre115 | PASS |
| bottomNavContract | PASS |
| test:ui-polish | PASS |
| release:stability | PASS |
| security:check | PASS |
| security:audit | 0 high/critical; 3 moderate Storybook/valibot |
| security:gitleaks | PASS findings=0 |
| security:semgrep | PASS findings=0 |
| expo-doctor | 16/18 (known app.json / non-CNG notes; non-blocking for this freeze) |
| npx expo export ios → `/tmp/youtrader-regression-fix-pre115` | PASS |
| Aikido MCP scan | **FAILED** (invalid auth token — `/aikido:setup` needed) |
| Build number | **113** (not raised) |

---

## 12–14. Apple/Google deletion smoke / Build 115 / purchase matrix

| Item | Result |
|------|--------|
| Apple `stored:true` + revoke | **NOT RUN** |
| Google disposable delete | **NOT RUN** |
| ASC sandbox session | **BLOCKED** (interactive 2FA) |
| Build 115 creation | **NOT CREATED** |
| Purchase/auth matrix | **NOT RUN** |

---

## 15. Remaining blockers before build 115

1. **Unlock physical iPhone** → launch RS 113 → complete Phase 9 interactive regression checklist + screenshots
2. Interactive App Store Connect login for sandbox testers
3. Physical SIWA disposable `stored:true` + revoke
4. Disposable Google delete smoke
5. Only then: set build **115**, signed production build, purchase matrix

---

## 16. Final verdict

**NO-GO** for creating build 115 until physical interactive regression QA passes and deletion smokes / ASC session blockers close.

Code regressions (Radar, Heatmap, Journal Add Trade, Manual P&L, always-visible Prop Pass) are implemented and automated-contract covered; physical launch verification remains pending device unlock.

---

## Confirmations

```text
Public version: 1.6.1
Configured build number: 113
Build 115 physical QA: NOT RUN
Performance Radar: PASS (code) / physical NOT RUN
Trading Heatmap: PASS (code) / physical NOT RUN
Journal Add Trade: PASS (code) / physical NOT RUN
Manual P&L Amount: PASS (code) / physical NOT RUN
Prop Pass Tab: PASS (code) / physical NOT RUN
TestFlight upload: NOT PERFORMED
App Store upload: NOT PERFORMED
App Store screenshots: NOT CHANGED
App Store metadata: NOT CHANGED
Added for review: NO
Submitted for review: NO
Public release: NO
```
