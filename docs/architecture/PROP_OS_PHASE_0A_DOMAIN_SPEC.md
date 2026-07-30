# Phase 0A — Prop Domain Architecture Specification

**Status:** READY FOR PRODUCT OWNER REVIEW  
**Parent:** Phase 0 — Prop Domain Architecture  
**Depends on:** [`PROP_OS_PHASE0_DATA_AUDIT.md`](./PROP_OS_PHASE0_DATA_AUDIT.md) (**FINAL APPROVED**, `6aa3339`)  
**Date:** 2026-07-30  
**Scope:** Entities, relationships, invariants, model versions, confidence contracts.  
**Out of scope:** Calculation formula freeze (0B), fixtures (0C), migration SQL (0D), UI, production code.

---

## 1. Purpose

Define a durable domain so YouTrader 3.0 can become a **Prop Performance OS** without inventing numbers in the UI.

Governing rule from PO review:

> UI with pass probability before a domain model would be inventing digits. Mathematics first, UI later.

### Hierarchy of truth

```text
Trades (facts)
  → Deterministic Engine (metrics + buffers + readiness)
    → Insights (structured findings + confidence)
      → AI explanation (language only; never invents metrics)
```

AI must **explain** engine output. AI must **not** decide buffers, readiness, or pass odds.

---

## 2. Phase 0 subprojects (boundaries)

| ID | Name | Delivers | Does not deliver |
|---|---|---|---|
| **0A** | Domain Schema | Entities, relations, IDs, invariants, confidence contract, naming of score models | Executable formulas, migrations, UI |
| **0B** | Calculation Engine | Versioned formulas, drawdown strategies, readiness-v0 weights, golden math | Schema migrate, UI |
| **0C** | Fixtures & Test Accounts | Synthetic accounts/challenges/trades proving 0B | Production backfill |
| **0D** | Migration Plan | Backfill, RLS, sync keys, rollback, dual-write strategy | Shipping Prop Pass UI |

**Product order after 0A–0D:** Prop Pass UI → Performance Intelligence → Decision Engine → Operating Modes.

---

## 3. Target aggregate model

```text
User
 └─ PropAccount[]          (firm-scoped capital / identity)
     └─ PropChallenge[]    (evaluation / funded attempt with rule set version)
         └─ Trade[]        (journal executions bound to challenge)
             └─ optional media / tags / notes
```

Contrast with **today** (audit): `User → Trades` plus a single firm overlay.

### Why this shape is mandatory

Without Accounts → Challenges → Trades the product cannot support:

- multiple prop firms;
- evaluation + funded at once;
- account comparison;
- different rule sets per attempt;
- honest Buffer Health per challenge.

---

## 4. Core entities

### 4.1 Identifiers

| Type | Description |
|---|---|
| `UserId` | Auth subject (`auth.users` / local guest scope) |
| `PropAccountId` | Stable account instance |
| `PropChallengeId` | One attempt/phase under an account |
| `PropRuleSetVersion` | Immutable version string, e.g. `ftmo-50k-eval-2026.07` |
| `TradeId` | Existing journal `id` / `client_id` |
| `ModelVersion` | Calculation / readiness version, e.g. `readiness-v0`, `buffer-v0` |

### 4.2 `PropFirmCatalogEntry` (reference data)

Reusable catalog (maps today’s `prop_firms` / `PropFirmTemplate`).

- `firmKey`, display names, `accountSize` presets
- Default rule templates (not live state)
- `sourceUrl`, `lastVerified`, `isActive`
- **Does not** store user balance, HWM, or trade PnL

### 4.3 `PropAccount`

Capital / identity container for one firm program seat.

| Field | Notes |
|---|---|
| `id` | `PropAccountId` |
| `userId` | Owner |
| `firmKey` | Catalog reference |
| `label` | User-facing name |
| `accountSize` | Nominal size (e.g. 50_000) |
| `currency` | Default `USD` until multi-currency needed |
| `timezone` | Trading-day boundary for daily loss (**PO decision**) |
| `status` | `active` \| `archived` \| `closed` |
| `createdAt` / `archivedAt` | |

**Invariant:** An account has zero or more challenges; at most one `active` challenge recommended for v1 UX clarity (**PO:** allow concurrent actives? — see §11).

### 4.4 `PropChallenge`

One evaluation or funded attempt with a **frozen** rule set version at start (rules may be superseded only by explicit new challenge or versioned amendment event).

| Field | Notes |
|---|---|
| `id` | `PropChallengeId` |
| `accountId` | Parent account |
| `phase` | `evaluation` \| `challenge` \| `funded` \| `live` (align with product vocabulary) |
| `ruleSetVersion` | Immutable pointer |
| `status` | `active` \| `passed` \| `failed` \| `reset` \| `abandoned` |
| `startedAt` / `endedAt` | |
| `startingBalance` | Explicit baseline |
| `resetOfChallengeId?` | Link if this attempt replaces a failed one |

**Invariant:** Trades attributed to a challenge must not silently move to another challenge without an audited reassignment event.

### 4.5 `PropRuleSet` (versioned configuration)

Configurable; never hard-coded to one firm in engine code.

```ts
type DrawdownStrategy =
  | { kind: "static"; maxDrawdown: number }
  | { kind: "trailingEndOfDay"; amount: number }
  | { kind: "trailingIntraday"; amount: number };

type PropRuleSet = {
  version: PropRuleSetVersion;
  firmKey: string;
  profitTarget: number;
  dailyLossLimit?: number;
  drawdown: DrawdownStrategy;
  /** High-water mark is required state for trailing strategies — see BufferState */
  consistencyRule?: PropConsistencyRule;
  maxContracts?: number;
  minimumTradingDays?: number;
  permittedInstruments?: string[];
  newsRestrictions?: PropNewsRule;
  weekendHoldingAllowed?: boolean;
  payoutRules?: PropPayoutRule;
  scalingRules?: PropScalingRule;
};
```

**Drawdown strategies (mandatory support in domain — formulas in 0B):**

| Strategy | Domain meaning |
|---|---|
| Static DD | Floor fixed from starting balance / absolute limit |
| End-of-day trailing | Floor updates from EOD equity high-water mark |
| Intraday trailing | Floor can tighten intraday as HWM moves |
| High Water Mark | First-class **state**, not a separate “strategy name” alone — trailing *uses* HWM |

### 4.6 `Trade` (normalized journal fact)

Extend today’s `Trade` conceptually (persistence in 0D):

| Additive field | Purpose |
|---|---|
| `accountId?` | Link (required after migration for prop-scoped views) |
| `challengeId?` | Link |
| `fees?` | Realized costs |
| `initialRisk?` / `rMultiple?` | Risk quality |
| `session?` | Persisted or derived-then-stored |
| `ruleSetVersionAtTrade?` | Context freeze |
| `source` | `manual` \| `csv` \| `broker` \| `other` |
| `externalExecutionId?` | Future broker |

**Facts that never change by mode/policy:** realized PnL, timestamps, contract counts, historical prices.

### 4.7 `AccountStateSnapshot` (derived or stored)

Point-in-time challenge economics (written by engine; optional persistence in timeline):

| Field | Notes |
|---|---|
| `challengeId` | |
| `asOf` | Timestamp / trading day |
| `balance` / `equity` | Define realized-only vs include open risk in 0B |
| `highWaterMark` | Required for trailing |
| `drawdownFloor` | Current max-loss floor |
| `dailyPnL` | Trading-day scoped |
| `daysTraded` | Toward minimum days |
| `modelVersion` | Buffer/readiness calc version |

### 4.8 `PropReadinessSnapshot`

Historical graph must **not** rewrite when formulas change.

| Field | Notes |
|---|---|
| `timestamp` | |
| `challengeId` | |
| `modelVersion` | e.g. `readiness-v0` |
| `score` | 0–100 readiness (**not** calibrated %) |
| `confidence` | See §5 |
| `sampleSize` | Trades (and/or days) used |
| `drivers` | ≤N structured reasons |
| `accountState` | Subset of buffers/targets |

### 4.9 Insights envelope (pre-AI)

Every deterministic insight card payload:

```ts
type InsightEvidence = {
  metricId: string;
  value: number | string;
  sampleSize: number;
  confidence: ConfidenceLevel;
  window?: string; // e.g. "last_20_trades" | "weekday:Friday"
};

type DeterministicInsight = {
  id: string;
  kind: string;
  summaryKey: string; // i18n key, not final AI prose
  evidence: InsightEvidence[];
  modelVersion: string;
};
```

AI may turn `DeterministicInsight` into prose. AI may not invent `value` or `sampleSize`.

---

## 5. Data Confidence Layer (critical)

**PO addition:** confidence is not a UI decoration — it lives in the deterministic engine.

### 5.1 Contract

Every recommendation, breakdown, edge, and readiness output exposes:

| Field | Meaning |
|---|---|
| `sampleSize` | Count of trades (or days) in the window |
| `confidence` | `insufficient` \| `low` \| `medium` \| `high` |
| `confidenceReason?` | Machine-readable code (e.g. `n<10`, `single_day`) |

Example product presentation (UI later):

```text
Friday
-31%
Based on 3 trades · Low confidence
```

vs

```text
Friday
-31%
Based on 87 trades · High confidence
```

### 5.2 Default thresholds (proposal for 0B freeze)

| Confidence | Guideline (v0 proposal) |
|---|---|
| `insufficient` | n < 5 → do not show strong claims; show “not enough data” |
| `low` | 5 ≤ n < 20 |
| `medium` | 20 ≤ n < 50 |
| `high` | n ≥ 50 |

Edge Discovery and weekday deltas may use **stricter** floors (e.g. no “best edge” badge under n=30). Exact numbers freeze in **0B**.

### 5.3 Invariant

```text
No InsightEvidence without sampleSize + confidence.
No ReadinessSnapshot without sampleSize + confidence.
```

---

## 6. Scoring model evolution (naming)

| Version | Product name | Nature | When |
|---|---|---|---|
| **V1** | **Prop Readiness Score** (0–100) | Deterministic, versioned, explained | Ship with Prop Pass |
| **V2** | **Estimated Pass Probability** | Calibrated on accumulated outcomes | After validation data |
| **V3** | Personalized estimated probability | User-population + personal history | Later |

**Deprecate architecturally:** ad-hoc `calculatePassProbability` (3–98 heuristic) as a product contract. Replacement path: readiness-v0 in 0B; old helper quarantined/removed only in an approved implementation task — not in 0A docs alone.

**Rule:** the word “Probability” must be **earned** by calibration, not by UI copy.

---

## 7. Buffer Health (domain types)

Buffer Health is a **set** of independent buffers, never one unexplained color:

| Buffer | Depends on |
|---|---|
| Daily loss buffer | `dailyLossLimit`, day PnL, timezone day boundary |
| Trailing / max DD buffer | Drawdown strategy + HWM + equity |
| Target distance | `profitTarget` − progress |
| Consistency capacity | Consistency rule + day contributions |
| Contract headroom | `maxContracts` vs exposure |

Each buffer result includes `sampleSize`/`confidence` where the input window is statistical (e.g. consistency); pure rule remaining dollars may use `confidence: high` when account state is complete, or `insufficient` when balance/HWM unknown.

---

## 8. Decision / intervention vocabulary

Without live broker events:

| Label | Allowed | Meaning |
|---|---|---|
| **Decision Replay** | Yes (Phase 4 early) | Post-hoc evidence on past behavior |
| **Pre-session Guidance** | Yes | Prepare before trading day using history |
| **Post-trade Review / Warning** | Yes | After logged trade |
| **Real / Smart Intervention** | **No** until live event source | Prevent *before* next fill |

Do not market Review/Prepare as Prevent.

---

## 9. Relationship & ownership rules

1. `Trade.userId` (cloud) must match `PropAccount.userId`.  
2. `Trade.challengeId` ⇒ challenge.accountId ⇒ account.userId (same user).  
3. Deleting/archiving account does not hard-delete trades (soft archive / retain journal).  
4. Changing `PropRuleSet` for an active challenge requires either: new `ruleSetVersion` + amendment event, or new challenge. Silent mutate forbidden.  
5. Guest users: local-only accounts/challenges allowed; cloud sync binds on auth (0D).  
6. Legacy trades without `challengeId`: assign to **Default Account / Default Challenge** on migration (0D) — never invent PnL.

---

## 10. Mapping from current system

| Today | Phase 0A target |
|---|---|
| `Trade` | `Trade` + optional account/challenge links |
| `prop_firms` / `PropFirmTemplate` | `PropFirmCatalogEntry` + default `PropRuleSet` drafts |
| `PropFirmUserOverrides` / local keys | Fields on `PropAccount` + active `PropChallenge` |
| `user_firm_settings` (unused sync) | Superseded by multi-account tables (0D design) |
| `risk_snapshots` (unused) | Align or replace with `PropReadinessSnapshot` / `AccountStateSnapshot` |
| `propRiskEngine` | Inputs re-bound to challenge; formulas rewritten in 0B |
| `calculatePassProbability` | Quarantine; replace with readiness-v0 |
| `calcStats` / `tradeMetrics` | Keep as performance layer; always emit confidence |
| AI Analytics | Remains coaching consumer; later soft-retire from primary nav |

---

## 11. Open product decisions (block 0A → 0B freeze)

| # | Question | Impact |
|---|---|---|
| 1 | Concurrent active challenges allowed in v1? | Account UX + Buffer Health |
| 2 | Trading-day timezone: firm / exchange / device? | Daily loss correctness |
| 3 | Equity for DD: realized only vs mark-to-market later? | Trailing accuracy |
| 4 | Fees required for readiness-v0 or confidence penalty if missing? | Score honesty |
| 5 | Default challenge backfill label/copy for legacy trades | Migration trust |
| 6 | Confidence thresholds accept §5.2 as v0? | Engine + UI copy |
| 7 | Firm subset for typed rules in v1 | Rule engine scope |

---

## 12. Deliverables checklist (0A)

- [x] Aggregate model User → Account → Challenge → Trade  
- [x] Entity field sketches + invariants  
- [x] Versioned `PropRuleSet` + drawdown strategy kinds  
- [x] Data Confidence Layer contract  
- [x] Readiness V1→V3 naming path  
- [x] Buffer Health as multi-buffer  
- [x] Intervention vocabulary honesty  
- [x] Mapping from audit / current code  
- [x] Open PO questions  

**Not done in 0A (by design):** executable TypeScript domain package, SQL, formula numbers, fixtures, UI.

---

## 13. STOP / next gate

**Awaiting Product Owner review of Phase 0A.**

Suggested next approve:

```text
APPROVE PHASE 0A — then start Phase 0B Calculation Engine specification
(formulas, drawdown strategies math, readiness-v0 weights, confidence thresholds freeze)
```

No Prop Pass UI and no production implementation until 0A–0D gates as defined in the roadmap.
