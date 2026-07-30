# Prop OS Phase 0 — Data Foundation Audit

**Status:** FINAL APPROVED (Product Owner, 2026-07-30)  
**Mode:** Audit-only (no production code, schema, navigation, UI, or package changes)  
**Date:** 2026-07-30  
**Commit:** `6aa3339`  
**Related:** [`docs/YOUTRADER_3_ROADMAP.md`](../YOUTRADER_3_ROADMAP.md) · [`PROP_OS_PHASE_0A_DOMAIN_SPEC.md`](./PROP_OS_PHASE_0A_DOMAIN_SPEC.md)

> **Verdict:** YouTrader today is a **user-scoped trading journal** with a **template-level Prop Risk overlay** and strong deterministic Stats utilities. It is **not** yet an account/challenge-scoped Prop Operating System. Passing UI (Prop Pass, Buffer Health, calibrated probability) before a domain model would invent numbers.
>
> **PO addendum:** add **Data Confidence Layer** (sample size + confidence on every engine insight) as a critical gap — addressed in Phase 0A domain contract.

---

## 1. Executive summary

| Area | Current state | Prop OS readiness |
|---|---|---|
| Trade journal (local + cloud) | Solid local-first `Trade` ↔ `trade_journal` sync | Reusable core; missing account/challenge linkage |
| Prop firm templates | Rich `PropFirmTemplate` + `prop_firms` catalog | Reusable rule *catalog*; not versioned rule *instances* |
| User prop settings | Local overrides; SQL `user_firm_settings` exists | One setting / user; not multi-account; cloud path unused by client |
| Risk snapshots table | Schema exists (`risk_snapshots`) | **Unused** by TypeScript client |
| Deterministic Stats | `tradeMetrics`, `calcStats`, equity, radar, breakdowns | Strong reuse for Performance Intelligence |
| Pass / survival “probability” | Heuristic engines (`passProbabilityEngine`, survival in prop engine) | **Not** calibrated probability — must not ship as % without Phase 0 model + honesty layer |
| AI Analytics tab | Consumes Stats + prop snapshot + cloud `ai-coach` for copy | Keep; do not delete; Prop Pass should later replace *entry*, not delete consumers blindly |
| Broker / live feed | Absent | Blocks true Smart Intervention |
| Fees / R / HWM on trade | Partial in analytics normalizer only | Not persisted on `Trade` / CSV / cloud |

---

## 2. Repository audit — entity inventory

### 2.1 Local `Trade` (canonical journal row)

**Path:** `src/app/types.ts`

| Field group | Fields |
|---|---|
| Identity / time | `id`, `date`, `createdAt`, `updatedAt`, `entryTime`, `exitTime` |
| Instrument / size | `symbol`, `direction`, `contracts` |
| Prices / risk marks | `entry`, `exit`, `stopLoss`, `takeProfit`, `pnl` |
| Journal context | `mood`, `notes`, `tags` |
| Media | `photoUri`, `voiceUri`, cloud URIs, `voiceName` |

**Absent on `Trade`:** `accountId`, `challengeId`, `propFirmId`, `userId`, fees, broker IDs, session (stored), R-multiple, planned risk, balance before/after, import provenance, timezone, rule context snapshot.

### 2.2 Cloud `TradeJournalRow` / `trade_journal`

**Paths:** `src/app/types.ts`, `supabase/migrations/20260627231000_add_runtime_tables_rls.sql`

Adds `user_id`, `client_id`, soft `deleted_at`, media URLs. Still **no** account/challenge FK.

RLS: owner-only (`auth.uid() = user_id`). Trigger `security_validate_trade_journal` sanitizes and forces `user_id`.

### 2.3 Prop domain (existing)

| Entity | Path | Notes |
|---|---|---|
| `PropFirmTemplate` | `src/propFirm/types.ts` | Targets, daily/max loss, static/trailing flags, contracts, phases, JSON rules blobs |
| `PropFirmUserOverrides` | `src/propFirm/types.ts` | Phase, balance, limit overrides — local |
| `prop_firms` | migrations + client read in `YouTraderApp.tsx` | Active catalog; client read-only |
| `user_firm_settings` | SQL | `unique(user_id)` — one firm profile per user; **no client sync found** |
| `risk_snapshots` | SQL | Designed for daily risk metrics; **no client R/W found** |

### 2.4 Persistence map

| Store | Key / location | Contents |
|---|---|---|
| AsyncStorage | `trades-v6` (guest), `trades-v7:<userId>` | Journal |
| AsyncStorage | `prop-risk-template-v1`, `prop-risk-mode-v2`, `prop-firm-user-overrides-v1` | Prop UI settings (`src/propFirm/userSettings.ts`) |
| FileSystem | `youtrader-media/{photos,voice}/` | Local media |
| SecureStore | Auth session only | Not trades |
| SQLite | — | **Not used** |
| Supabase | `trade_journal`, `user_app_state`, media via `secure-upload` | Cloud journal + prefs |

### 2.5 Import / data flow

```text
Manual form | CSV import
  → validate / normalize
  → React trades state
  → AsyncStorage
  → (if authed) trade_journal upsert (user_id, client_id) + secure-upload media
  → merge LWW by updatedAt
  → tradeNormalizer → tradeMetrics / calcStats / propRiskEngine / AI context
```

**CSV** (`src/utils/importTradesCsv.ts`): date, symbol, direction, pnl; optional entry/exit/contracts/mood/notes. Forces `stopLoss`/`takeProfit` null. No fees, account, broker, times beyond date.

**Broker / live account feed:** **absent**.

**Screenshot → trade OCR:** **absent** (attachment only; vision review is AI coaching, not journal write).

### 2.6 Futures / instruments

Static catalog in `src/app/constants.ts` (ES/NQ/GC/CL + micros) with tick size/value. Not snapshotted per trade. No expiry/month/exchange/currency on the row.

Session is **derived** in `src/analytics/tradeNormalizer.ts` from entry/exit hour — not persisted.

---

## 3. Supabase / data model map

### 3.1 Migrations (14)

| Migration | Domain relevance |
|---|---|
| `20260627231000_add_runtime_tables_rls.sql` | `trade_journal`, prop settings, risk snapshots, subscriptions, AI usage, prefs foundations |
| `202606280002_security_hardening.sql` | Validation trigger on journal, security helpers, private buckets |
| `202606280003_secure_uploads.sql` | `upload_files` |
| `20260703121500_prop_firm_risk_assistant.sql` | Expands prop templates / user firm settings |
| `20260703140000_fix_prop_firms_rls.sql` | Public read of active templates |
| `20260703160000_user_app_state.sql` | Preferences sync |
| `20260703025327_add_rag_knowledge_base.sql` | RAG (rules knowledge) — service role |
| `20260708180000_ai_platform_v2_foundation.sql` | Future AI observability tables |
| Later grants / quota RPC | Entitlement + AI quota |

**Views:** none found for journal/prop equity aggregates.

**No generated `Database` TypeScript types** in repo.

### 3.2 Tables relevant to Prop OS

| Table | Purpose | Client usage |
|---|---|---|
| `trade_journal` | Cloud journal | Active sync |
| `prop_firms` | Firm templates | Catalog fetch |
| `user_firm_settings` | Per-user firm profile | Schema only / unused sync |
| `risk_snapshots` | Risk metric history | Unused |
| `user_app_state` | Preferences JSON | Active |
| `upload_files` | Media metadata | Via edge |
| `ai_usage_events` | AI quota | Edge |
| `user_subscriptions` | RC cache | Edge / billing |
| Knowledge / market / AI platform tables | Adjacent | Not prop account ledger |

### 3.3 Edge functions

| Function | Role for Prop OS |
|---|---|
| `ai-coach` | Coaching text / vision — **not** source of deterministic metrics |
| `secure-upload` | Media for journal |
| `market-intelligence` | Market context |
| `transactional-email` | Email prefs |

### 3.4 Notable schema risks (observe only)

- Client may call `security_claim_idempotency_key` while hardening migrations revoked client `EXECUTE` — verify against **deployed** DB.
- `ai_usage_events.action` constraint vs expanded actions in `rateLimits.ts` — verify deployed DB.
- Dual sources of truth: local prop overrides vs unused `user_firm_settings`.

---

## 4. Calculation inventory

### 4.1 Deterministic (reuse)

| Calculation | Path | Notes |
|---|---|---|
| Normalize trade | `src/analytics/tradeNormalizer.ts` | Session, R, fees **if provided** |
| Core metrics | `src/analytics/tradeMetrics.ts` | WR, PF, expectancy, DD, consistency… |
| Stats facade | `src/app/utils/stats.ts` | `calcStats` for Stats + AI Analytics |
| Equity / DD series | `src/analytics/equityCurve.ts` | |
| Trading score | `src/analytics/tradingScore.ts` | Heuristic 0–100 |
| Radar axes | `src/components/stats/radarAxes.ts` | |
| Session/symbol breakdowns | `tradeBreakdown`, `sessionHeatmap` | Edge Discovery substrate |
| Prop risk engine | `src/propFirm/propRiskEngine.ts` | Daily/account remaining, warnings, contract hint |
| Local AI OS / patterns | `aiInsightEngine`, `patternDetector`, revenge/leak detectors | Deterministic heuristics |

### 4.2 Heuristic “probability” (honesty required)

| Name | Path | Reality |
|---|---|---|
| `calculatePassProbability` | `src/ai/passProbabilityEngine.ts` | Weighted progress+buffer+sample → **3–98**; not calibrated P(pass) |
| Survival / account health in prop engine | `propRiskEngine.ts` | Product heuristic |
| `calculatePropSurvival` | `src/analytics/propSurvival.ts` | Legacy; **no invocation found** |
| `useRiskCoach` | `src/hooks/useRiskCoach.ts` | Legacy; **no consumer found** |

**Trailing drawdown gap:** account remaining ≈ `drawdownLimit + min(totalPnl, 0)` — does **not** implement high-water-mark / trailing floor from `currentBalance`. Flag `trailingDrawdown` only changes messaging/limit source, not true trailing math.

### 4.3 Cloud AI (not metric source of truth)

`weekly_coach`, `risk_predictor`, `journal_summary`, `daily_plan`, `daily_challenge`, `trade_vision_review` via `src/api/aiCoach.ts` → `ai-coach` edge. Text may mention risk; **must not** become Pass Probability or Buffer Health.

### 4.4 Dependency graph

```text
Trade[] (journal)
 ├─ normalizeTradeForAnalytics → tradeMetrics / equity / groups
 │    ├─ calcStats → StatsScreen (metrics, radar, heatmap, equity)
 │    └─ buildAIAnalyticsContext / TradeAnalysisPayload
 │         └─ AiAnalysisScreen (tab "ai")
 │              ├─ local OS / patterns / passProbability heuristic
 │              └─ aiCoach → Edge LLM (copy only)
 └─ buildPropRiskEngine(template, phase, trades)
      ├─ PropFirmRiskCoach / PropFirmRiskDashboard
      └─ injected into AI Analytics + journal risk UI
```

**AI Analytics consumers (do not delete in Phase 0):**

- Tab `"ai"` + `AiAnalysisScreen` in `YouTraderApp.tsx`
- Journal `onContinueToReview`
- Stats sharing period stats into AI payloads
- `src/api/aiCoach.ts`, `src/analytics/aiContextBuilder.ts`, `src/ai/*` detectors
- Edge `supabase/functions/ai-coach`

---

## 5. Gap analysis vs YouTrader 3.0 Phase 0 needs

| Need (roadmap) | Present? | Gap |
|---|---|---|
| Multi account / challenge instances | No | Only one logical firm setting / user |
| Trade ↔ account/challenge binding | No | All trades pool at user level |
| Configurable `PropRuleSet` versioned | Partial | Templates exist; JSON rules not evaluated; no version/effective date |
| Trade normalization completeness | Partial | fees/R/session not persisted; CSV incomplete |
| Deterministic calc layer with fixtures | Partial | Engines exist but overlapping + unversioned |
| Versioned readiness score + snapshots | No | `risk_snapshots` unused; pass % heuristic live |
| True trailing / EOD vs intraday DD | No | Simplified buffer formula |
| Consistency / scaling / news / payout evaluators | No | Stored as untyped records |
| Live / pre-trade event source | No | Blocks Smart Intervention (Phase 4) |
| Calibrated probability | No | Must ship as **Prop Readiness Score** until validated |
| **Data Confidence Layer** (sample size + confidence on every insight) | Partial | Some confidence fields exist ad hoc; **not** a mandatory engine contract on all recommendations/edges |

### Reusable as-is

- Journal sync + media pipeline  
- Instrument tick catalog  
- `PropFirmTemplate` field vocabulary  
- `tradeMetrics` / `calcStats` / equity / breakdowns  
- Prop warning categories taxonomy  
- AI Analytics as coaching layer **on top of** deterministic metrics  

### New entities required (proposed — **not implemented**)

See §8.

### Unsafe to start before data model work

- UI showing “Pass Probability %” as statistical claim  
- Multi-account Buffer Health as single color  
- Smart Intervention as real-time  
- Deleting AI Analytics before consumer map + flag strategy  
- Server migrations that rewrite historical `trade_journal` without account backfill plan  
- Treating `risk_snapshots` or `user_firm_settings` as live without sync design  

---

## 6. Risk register

| ID | Risk | Severity | Notes |
|---|---|---|---|
| R-01 | Heuristic pass % presented as real probability | High | `passProbabilityEngine` already surfaces in Stats/AI |
| R-02 | Trailing DD miscomputed → false CLEAR/STOP | High | Formula ignores HWM |
| R-03 | All trades attributed to one challenge | High | Wrong buffers if user has resets/multi accounts |
| R-04 | Dual prop settings (local vs SQL) diverge | Medium | Cloud table unused |
| R-05 | Unused `risk_snapshots` invites conflicting writers later | Medium | Need single ownership before enabling |
| R-06 | Idempotency / AI action constraint drift vs deployed DB | Medium | Verify production before migrations |
| R-07 | CSV missing risk fields → low-confidence metrics shown confidently | Medium | Confidence Test failures |
| R-08 | Deleting AI Analytics breaks Journal “continue to review” | Medium | Soft-retire via nav only |
| R-09 | LLM coaching used as decision engine | High | Product Safety Test |
| R-10 | Migration adding NOT NULL account_id without backfill | High | Data loss / sync break |

---

## 7. Recommended Phase 0 implementation sequence

*(Documentation/spec/code for domain only — after this audit is approved. Still no Prop Pass UI.)*

1. **Product decisions** — answer §9 (account model, honesty of score, timezone, multi-account).  
2. **Domain schema spec** — entities in §8 as ADR + TypeScript *types-only* package or `src/propOs/domain/` stubs **without** UI wiring (separate approve).  
3. **Calculation specification** — freeze formulas for daily buffer, static DD, trailing HWM, readiness score v0; add golden fixtures.  
4. **Deprecate / quarantine heuristics** — document that `calculatePassProbability` is provisional; rename product copy to Readiness where shown (copy-only change needs separate approve).  
5. **Trade enrichment plan** — optional fees, stop, times, `accountId`; CSV mapping; no forced rewrite of old rows.  
6. **Persistence plan** — choose: extend `user_firm_settings` vs new `prop_accounts` / `prop_challenges`; activate or replace `risk_snapshots` with versioned `pass_timeline_snapshots`.  
7. **Migration design** — backfill strategy (single default account per user); RLS; sync keys; rollback.  
8. **Rule engine interface** — evaluate `PropRuleSet` version; leave firm JSON as input, not execution.  
9. **Only then** — Phase 1 Prop OS Foundation UI (nav soft-swap AI → Prop Pass behind flag).

---

## 8. Proposed domain entities (design only)

```ts
// Proposed — not implemented in this audit

type PropAccountId = string;
type PropChallengeId = string;
type PropRuleSetVersion = string;

type PropAccount = {
  id: PropAccountId;
  userId: string;
  firmKey: string;
  accountSize: number;
  label?: string;
  status: "active" | "passed" | "failed" | "reset" | "archived";
  timezone: string;
  createdAt: string;
};

type PropChallenge = {
  id: PropChallengeId;
  accountId: PropAccountId;
  phase: "evaluation" | "funded" | /* … */;
  ruleSetVersion: PropRuleSetVersion;
  profitTarget: number;
  dailyLossLimit?: number;
  maxDrawdown: number;
  drawdownType: "static" | "trailing";
  trailingMode?: "intraday" | "endOfDay";
  consistencyRule?: unknown; // typed later
  maxContracts?: number;
  minimumTradingDays?: number;
  startedAt: string;
  endedAt?: string;
};

type PropRuleSet = {
  version: PropRuleSetVersion;
  firmKey: string;
  // … mirrors roadmap PropRuleSet
};

type TradeRef = {
  // existing Trade fields +
  accountId?: PropAccountId;
  challengeId?: PropChallengeId;
  fees?: number;
  initialRisk?: number;
  rMultiple?: number;
  session?: string;
  ruleSetVersionAtTrade?: PropRuleSetVersion;
  source?: "manual" | "csv" | "broker" | "other";
};

type PropReadinessSnapshot = {
  timestamp: string;
  modelVersion: string; // e.g. readiness-v0
  challengeId: PropChallengeId;
  score: number; // 0–100 readiness, not calibrated %
  confidence: "low" | "medium" | "high";
  drivers: { id: string; direction: "up" | "down"; weight: number }[];
  accountState: Record<string, number | string | boolean>;
};
```

---

## 9. Product decisions required

1. **Multi-account:** Must Phase 1 support ≥2 concurrent challenges, or is v1 single active account with archive/reset history enough?  
2. **Score honesty:** Confirm product string **Prop Readiness Score /100** until calibration dataset exists (vs keeping “probability” language).  
3. **Timezone / trading day:** Firm-local vs device-local vs fixed exchange TZ for daily loss reset?  
4. **Trailing mode default:** Intraday vs end-of-day when firm template is ambiguous?  
5. **Balance source of truth:** Manual `currentBalance`, derived from starting balance + sum(PnL), or broker sync later?  
6. **Fees:** Required for Prop math, optional, or ignored in v0 with explicit confidence penalty?  
7. **AI Analytics:** Soft-hide from primary nav only after Prop Pass MVP, or keep both tabs longer?  
8. **Cloud prop settings:** Activate `user_firm_settings` sync or replace with new tables?  
9. **Historical attribution:** On introducing `accountId`, assign all legacy trades to a default account — OK for users?  
10. **Pass Timeline cadence:** Daily EOD snapshot vs after each trade vs both?  
11. **Smart Intervention horizon:** Accept post-trade warnings only until broker/live session exists?  
12. **Which firms in v1:** Catalog subset with fully typed rules vs all `prop_firms` with partial evaluation?

---

## 10. Evidence index (primary paths)

- `src/app/types.ts` — `Trade`, `TradeJournalRow`  
- `src/app/YouTraderApp.tsx` — sync, tabs, AI Analytics, prop template fetch  
- `src/app/utils/stats.ts` — `calcStats`  
- `src/analytics/*` — metrics, normalizer, equity, AI context  
- `src/propFirm/*` — templates, engine, local settings  
- `src/ai/passProbabilityEngine.ts` — heuristic probability  
- `src/utils/importTradesCsv.ts` — CSV  
- `supabase/migrations/*` — 14 migrations  
- `supabase/functions/ai-coach/index.ts` — cloud AI  
- `docs/YOUTRADER_3_ROADMAP.md` — product phases  

---

## 11. Audit constraints checklist

| Constraint | Honored |
|---|---|
| No production code changes | ✅ |
| No AI Analytics delete/hide | ✅ |
| No Supabase schema / migrations applied | ✅ |
| No RevenueCat / navigation / UI redesign | ✅ |
| No new prop calculations / fake probability | ✅ |
| No packages | ✅ |
| Docs-only commit | ✅ (this document) |

---

## 12. STOP

**Product Owner decision (2026-07-30): FINAL APPROVED.**

Next gate executed as documentation: **Phase 0A Domain Architecture Specification**  
→ [`PROP_OS_PHASE_0A_DOMAIN_SPEC.md`](./PROP_OS_PHASE_0A_DOMAIN_SPEC.md)

No Prop Pass UI / production domain code until 0A–0D approvals as sequenced in the roadmap.
