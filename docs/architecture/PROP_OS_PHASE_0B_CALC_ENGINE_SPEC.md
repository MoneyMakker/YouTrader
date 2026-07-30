# Phase 0B — Prop Calculation Engine Specification

**Status:** READY FOR PRODUCT OWNER REVIEW  
**Parent:** Phase 0 — Prop Domain Architecture  
**Depends on:**  
- [`PROP_OS_PHASE0_DATA_AUDIT.md`](./PROP_OS_PHASE0_DATA_AUDIT.md) — FINAL APPROVED  
- [`PROP_OS_PHASE_0A_DOMAIN_SPEC.md`](./PROP_OS_PHASE_0A_DOMAIN_SPEC.md) — **APPROVED WITH SPEC CONDITIONS** (`1c93ee7`)  
**Date:** 2026-07-30  
**Scope:** Canonical formulas, arithmetic, versioning, confidence policy, fixtures contract, invariants.  
**Out of scope:** Production TypeScript implementation, SQL migrations, Prop Pass UI, package installs.

**Calculation suite version (this document):** `calc-spec-v0`  
**Readiness model version:** `readiness-v0`  
**Confidence policy version:** `confidence-policy-v0`  
**Buffer / drawdown model version:** `buffer-v0`

---

## 1. Governing principles

1. **Determinism** — same ordered inputs ⇒ same outputs.  
2. **Facts first** — trades and snapshots are inputs; AI never feeds the engine.  
3. **Status beats score** — a breached challenge must not display a comforting readiness score as if the attempt were healthy (see §12).  
4. **Confidence is computed** — never assigned by UI (`confidence-policy-v0`).  
5. **Money is exact** — use decimal/minor-unit arithmetic with an explicit rounding policy; JS `number` floats are **not** the source of truth for limit checks.  
6. **Time is domain** — UTC event time ≠ firm trading day ≠ display timezone.  
7. **Version everything** — every engine result carries `calcSpecVersion`, `modelVersion`, `confidencePolicyVersion`.  
8. **Missing data is visible** — missing fees/HWM/assignment produce limitations, not silent zeros.

---

## 2. Canonical monetary arithmetic

### 2.1 Representation

| Concept | Spec |
|---|---|
| Currency | ISO 4217 code on account (`USD` default) |
| Storage | **Minor units** as integer (`MoneyMinor`: e.g. cents) **or** decimal string with fixed scale — implementation chooses one; fixtures use integer minor units |
| Scale | Currency scale (USD = 2). Document per currency. |
| Gross vs net | Engine default for prop limits: **net realized** when fees known; else gross with limitation `fees_missing` |
| Sign | Profit ≥ 0 positive; loss negative for PnL fields |

```ts
type MoneyMinor = number; // integer; never fractional cents in v0

type Money = {
  amountMinor: MoneyMinor;
  currency: string; // ISO 4217
};
```

### 2.2 Rounding policy (`rounding-v0`)

| Operation | Policy |
|---|---|
| Sum of trade PnLs | Exact integer sum of minor units |
| Ratio → display % | Round **half away from zero** to 2 decimal places for display only |
| Limit comparisons | Compare in minor units **after** applying strategy floor rules; never compare binary floats |
| Position size recommendation (later) | Round **contracts down** (conservative) — Phase 5; noted only |
| Readiness weights → score | Intermediate floats allowed only inside score mixer; final score = integer 0–100 via floor |

**Invariant:** `remainingBufferMinor` and `limitMinor` comparisons use integers only.

### 2.3 Trade economic fields used by engine

| Field | Required for | If missing |
|---|---|---|
| `realizedPnlMinor` | All buffers / readiness | Trade excluded from money math; limitation `pnl_missing` |
| `feesMinor` | Net PnL | Use gross; add `fees_missing` to limitations |
| `contracts` | Contract limits | Treat as unknown exposure; limitation `contracts_missing` |
| `propAccountId` / `challengeId` | Challenge-scoped math | Trade is `unassigned` — **excluded** from that challenge’s buffers |
| `eventTimeUtc` | Ordering, HWM, EOD | Exclude or quarantine; limitation `time_missing` |

---

## 3. Domain time model

### 3.1 Clocks

| Clock | Use |
|---|---|
| `eventTimeUtc` | Canonical trade/exit timestamp (ISO-8601 UTC) |
| `exchangeTimezone` | Optional instrument session context |
| `firmTimezone` | **Authority for trading-day boundary** (PO default) |
| `displayTimezone` | UI only — never drives daily loss |

**PO default:** daily loss / EOD trailing use **prop firm timezone** on the account/challenge rule snapshot. Device local midnight is **forbidden** as the engine boundary.

### 3.2 Trading day

```text
tradingDayId = calendar date of eventTimeUtc converted to firmTimezone
               using the firm’s day boundary (default: 00:00 firm-local,
               unless ruleSetSnapshot defines a custom cutover hour).
```

| Term | Definition |
|---|---|
| `tradingDayId` | `YYYY-MM-DD` in firm TZ after boundary |
| Day PnL | Sum of net (or gross) realized PnL for trades with that `tradingDayId` on the challenge |
| EOD moment | First instant of the **next** trading day in firm TZ (end of day D = start of D+1) |

### 3.3 Ordering

Trades sorted by `(eventTimeUtc ASC, tradeId ASC)` for replay.  
Out-of-order inserts: full challenge replay from snapshots or from trade list (0C fixtures must cover both).

---

## 4. Challenge lifecycle status (precedence)

```ts
type ChallengeLifecycleStatus =
  | "active"
  | "at_risk"
  | "breached"
  | "passed"
  | "funded"
  | "reset"
  | "abandoned";
```

### 4.1 Precedence (highest wins for UI primary state)

```text
breached > passed > funded > reset > abandoned > at_risk > active
```

Notes:

- `passed` / `funded` / `breached` / `reset` / `abandoned` are **terminal or sticky** outcomes for that challenge attempt (history preserved; never overwrite attempt — 0A condition).  
- `at_risk` is derived while still `active` when any buffer is below warn thresholds.  
- **Readiness Score is suppressed or labeled non-applicable when status ∈ {breached, passed, funded, reset, abandoned}** — see §12.

### 4.2 Violation precedence (what marks `breached`)

Evaluate after each trade (and at EOD for EOD trailing) in this order; **first hard breach wins** (record all for audit, but primary breach reason is first):

1. Daily loss limit breached  
2. Max / trailing drawdown floor breached  
3. Consistency rule hard-fail (if configured as fail-not-warn)  
4. Contract limit hard-fail (if configured)  
5. Other hard rules from snapshot  

Soft warnings never flip to `breached` alone.

---

## 5. Account state & HWM transitions (`buffer-v0`)

### 5.1 Realized-only equity (v0)

**PO-aligned default for v0:** prop buffers use **realized** PnL only (closed trades). Unrealized / open risk is **out of scope** until a live session model exists. Limitation `unrealized_excluded` always present in v0 outputs.

```text
equityMinor(t) = startingBalanceMinor + sum(netPnlMinor of trades ≤ t on challenge)
```

If fees missing on any included trade: use gross for those trades + challenge-level limitation `fees_incomplete`.

### 5.2 High Water Mark

```text
HWM(t) = max(startingBalanceMinor, max equityMinor over all event times ≤ t)
```

| Event | HWM change |
|---|---|
| Closed trade increases equity above HWM | HWM ← equity |
| Losing trade | HWM unchanged |
| Manual correction / deposit / reset | **Not auto-applied in v0** — require explicit `AccountAdjustment` event type (spec stub); until then limitation `adjustments_unsupported` |
| New challenge attempt | Fresh starting balance + HWM = starting balance |

### 5.3 Drawdown floor by strategy

Let `DD` = drawdown allowance in minor units from `ruleSetSnapshot`.

#### Static

```text
floorMinor = startingBalanceMinor - DD
remainingDdMinor = equityMinor - floorMinor
```

Floor never rises with profits.

#### Trailing end-of-day

During day D, floor is based on HWM as of **previous EOD** (or start):

```text
eodHwmMinor(D-1) = HWM at EOD moment of day D-1
floorMinor(during D) = eodHwmMinor(D-1) - DD
```

At EOD of D: recompute HWM including day’s trades; set `eodHwmMinor(D)` for next day.

Optional rule flag `trailingStopsAfterProfitTarget` (firm-specific): if set in snapshot, after equity ≥ starting + profitTarget, freeze floor (no further tightening). **Default v0:** freeze **off** unless snapshot says otherwise.

#### Trailing intraday

```text
floorMinor(t) = HWM(t) - DD
```

Floor can tighten immediately when HWM rises.

### 5.4 Daily loss buffer

```text
dayPnlMinor(D) = sum net (or gross) PnL for tradingDayId D
remainingDailyMinor(D) = dailyLossLimitMinor + min(dayPnlMinor(D), 0)
```

Breach when `remainingDailyMinor <= 0` (or `< 0` — **v0: breach at `<= 0`**).

### 5.5 Target distance

```text
progressMinor = max(0, equityMinor - startingBalanceMinor)
remainingToTargetMinor = max(0, profitTargetMinor - progressMinor)
progressRatio = progressMinor / profitTargetMinor  // for readiness only
```

### 5.6 Consistency (v0 sketch)

If snapshot defines e.g. `maxDayProfitShareOfTarget`:

```text
dayShare = dayProfitMinor / profitTargetMinor
```

Hard-fail vs warn from snapshot. Exact firm rules freeze per catalog snapshot in 0C/0D. Engine must accept pluggable `ConsistencyEvaluator` interface keyed by rule type id.

### 5.7 Contract limits

```text
maxContracts from snapshot
open/exposure: v0 uses max(contracts) on any single trade that day if no position ledger
```

Limitation `position_ledger_absent` in v0. Breach only if snapshot marks as hard-fail.

### 5.8 Buffer Health output

```ts
type BufferSlice = {
  id: "daily_loss" | "drawdown" | "target_distance" | "consistency" | "contracts";
  remainingMinor: MoneyMinor | null;
  limitMinor: MoneyMinor | null;
  pctRemaining: number | null; // display helper
  status: "ok" | "warn" | "hard";
  limitations: string[];
};
```

No single color without slices.

---

## 6. Confidence policy (`confidence-policy-v0`)

### 6.1 Output shape (mandatory)

```ts
type ConfidenceBlock = {
  sampleSize: number;
  confidence: "insufficient" | "low" | "medium" | "high";
  confidencePolicyVersion: "confidence-policy-v0";
  limitations: string[];
};
```

### 6.2 Thresholds (trade-count windows)

| confidence | sampleSize n |
|---|---|
| `insufficient` | n < 5 |
| `low` | 5 ≤ n < 20 |
| `medium` | 20 ≤ n < 50 |
| `high` | n ≥ 50 |

### 6.3 Stricter floors (comparative / edge insights)

| Insight class | Minimum n to emit claim | Else |
|---|---|---|
| Edge Discovery “best edge” | 30 | `insufficient` / hide badge |
| Weekday / session delta ranking | 20 | show with `low` max if 10–19; hide if &lt; 10 |
| Readiness drivers (statistical) | 5 | below 5 → insufficient-data readiness path |

### 6.4 Rule buffers vs statistical confidence

- Pure remaining-limit math with complete state: `confidence: high`, `sampleSize` = trade count on challenge (informational).  
- If HWM/balance unknown: `confidence: insufficient`, limitations include `state_incomplete`.

---

## 7. Prop Readiness Score V1 (`readiness-v0`)

### 7.1 When score applies

| Lifecycle status | Score behavior |
|---|---|
| `active`, `at_risk` | Compute and show score + drivers |
| `breached` | **Do not** show raw 0–100 as health; show status `breached` + breach reasons; optional `scoreIfWereActive` only behind debug/internal flag — **product UI must not** |
| `passed`, `funded` | Show terminal success state; score N/A |
| `reset`, `abandoned` | Historical; score N/A for “today” |

**Invariant:** UI primary headline for breached ≠ “72/100 Ready”.

### 7.2 Inputs (normalized 0–1 before weights)

| Input id | Definition (v0) | Notes |
|---|---|---|
| `targetProgress` | `min(1, progressMinor / profitTargetMinor)` | 0 if target ≤ 0 |
| `dailyBufferHealth` | `clamp01(remainingDaily / dailyLimit)` | 0 if breached daily |
| `ddBufferHealth` | `clamp01(remainingDd / DD)` | 0 if breached DD |
| `minDaysProgress` | `min(1, daysTraded / minTradingDays)` | 1 if no min days rule |
| `expectancyProxy` | from last ≤50 trades expectancy mapped via tanh-scale to 0–1 | uses confidence |
| `sampleAdequacy` | `min(1, n / 50)` | |

Exact expectancy mapping constants freeze in fixtures (0C); placeholder:

```text
expectancyProxy = 0.5 + 0.5 * tanh(expectancyR / 0.5)
```

### 7.3 Weights (`readiness-v0`)

| Input | Weight |
|---|---|
| `targetProgress` | 0.25 |
| `dailyBufferHealth` | 0.20 |
| `ddBufferHealth` | 0.25 |
| `minDaysProgress` | 0.10 |
| `expectancyProxy` | 0.10 |
| `sampleAdequacy` | 0.10 |
| **Sum** | **1.00** |

```text
raw = Σ weight_i * input_i
score = floor(100 * raw)   // integer 0–100
```

If any hard breach already set status `breached`, skip public score (§7.1).

### 7.4 Insufficient data behavior

If `n < 5` OR `state_incomplete`:

```text
confidence = insufficient
score = null (or withhold)
primaryMessage = insufficient_data
drivers = []
```

Do not invent mid-range scores from empty journals.

### 7.5 Drivers (≤3)

Each driver:

```ts
type ReadinessDriver = {
  id: string;
  direction: "up" | "down";
  weight: number;
  inputId: string;
  evidence: ConfidenceBlock & { value: number | string };
};
```

Select top 3 by `|contribution|` where `contribution = weight * (input - 0.5)`.

### 7.6 Score change explanation

When comparing to previous `PropReadinessSnapshot`:

```text
Δscore = score_now - score_prev
driversDelta = drivers whose contribution changed most
```

Store `modelVersion: readiness-v0` on both snapshots so formula changes don’t rewrite history.

---

## 8. Engine result envelope

```ts
type PropEngineResultV0 = {
  calcSpecVersion: "calc-spec-v0";
  bufferModelVersion: "buffer-v0";
  readinessModelVersion: "readiness-v0" | null;
  confidencePolicyVersion: "confidence-policy-v0";

  challengeId: string;
  lifecycleStatus: ChallengeLifecycleStatus;
  breachReasons: { code: string; at: string; tradeId?: string }[];

  accountState: {
    equityMinor: MoneyMinor;
    startingBalanceMinor: MoneyMinor;
    hwmMinor: MoneyMinor;
    drawdownFloorMinor: MoneyMinor;
    tradingDayId: string;
    dayPnlMinor: MoneyMinor;
  };

  buffers: BufferSlice[];

  readiness: null | {
    score: number; // 0–100
    drivers: ReadinessDriver[];
    confidence: ConfidenceBlock;
  };

  limitations: string[];
  asOfUtc: string;
};
```

---

## 9. Missing, corrected, duplicated, out-of-order trades

| Case | Behavior |
|---|---|
| Missing PnL | Exclude from money sums; limitation; do not treat as 0 |
| Missing fees | Gross path + `fees_missing` |
| `unassigned` trade | Excluded from all challenge engines |
| Duplicate `tradeId` | Keep first by ingest order; limitation `duplicate_ignored` |
| Corrected trade (new updatedAt) | Replay challenge from scratch using latest trade set |
| Out-of-order eventTime | Sort by §3.3 before replay |
| Deleted soft | Excluded from sums |
| Future-dated beyond asOf | Excluded when evaluating `asOf` |

---

## 10. Deterministic fixtures contract (for Phase 0C)

Each fixture directory MUST include:

1. `account.json` / `challenge.json` with `ruleSetVersion` + **`ruleSetSnapshot`**  
2. `trades.jsonl` ordered arbitrarily (engine must sort)  
3. `expected/engine-asof-<iso>.json` matching `PropEngineResultV0`  
4. `notes.md` — human scenario  

**Minimum scenarios (0C must implement):**

| ID | Scenario |
|---|---|
| F01 | Static DD — profit then loss near floor |
| F02 | EOD trailing — HWM up day1, loss day2 vs old floor |
| F03 | Intraday trailing — floor tightens same day |
| F04 | Daily loss breach mid-day |
| F05 | Daily loss OK in firm TZ, would falsely breach on device TZ (negative test) |
| F06 | Readiness insufficient data (n=2) |
| F07 | Readiness healthy path (n≥50 synthetic) |
| F08 | Breached DD — readiness withheld |
| F09 | Unassigned trades ignored |
| F10 | Duplicate trade id |
| F11 | Fees missing vs fees present net difference |
| F12 | Passed target + min days |

---

## 11. Property-style / invariant tests (0C)

1. Monotonic HWM: never decreases on trade-only replay.  
2. Static floor constant for life of challenge (no adjustments).  
3. Intraday floor ≥ previous floor when HWM increases.  
4. Sum of day PnLs = total PnL (partition of trading days).  
5. Integer money: no non-integer minor in outputs.  
6. Breach ⇒ `lifecycleStatus === breached'` and `readiness === null` (public).  
7. Same trades shuffled ⇒ identical engine result.  
8. Confidence block always present on readiness when non-null.  
9. `confidencePolicyVersion` always `confidence-policy-v0` in this suite.  
10. Unassigned trades never change equity for a challenge.

---

## 12. Status vs score (normative UI contract)

```text
IF lifecycleStatus == breached:
  primary = BREACHED + reasons
  FORBIDDEN = presenting readiness score as current health

IF lifecycleStatus in {passed, funded}:
  primary = terminal success
  readiness N/A

IF lifecycleStatus in {active, at_risk}:
  primary may include readiness score WITH confidence
  buffers shown as separate slices
```

---

## 13. Mapping / quarantine of legacy heuristics

| Legacy | Action in future implementation (not this doc) |
|---|---|
| `calculatePassProbability` | Quarantine; no product surface |
| `propRiskEngine` trailing ≈ `limit + min(pnl,0)` | Replace with §5 |
| Ad-hoc confidence strings | Replace with `confidence-policy-v0` |

---

## 14. PO defaults absorbed into this spec

| Topic | Default locked for 0B |
|---|---|
| V1 metric | Prop Readiness Score 0–100 |
| Probability | Forbidden until calibration |
| Multi-account | Required |
| Concurrent active challenges | Allowed (engine is per-challenge) |
| Legacy trades | `unassigned` |
| Fees | Net when present; else gross + limitation |
| AI | Explanation only |
| Intervention V1 | Post-trade + pre-session |
| Firm TZ for trading day | Authority |
| Realized-only equity v0 | Yes |

---

## 15. Deliverables checklist (0B)

- [x] Monetary arithmetic + rounding  
- [x] Trading-day / timezone model  
- [x] Static / EOD trailing / Intraday trailing + HWM  
- [x] Daily loss, buffers, target distance  
- [x] Consistency / contracts hooks  
- [x] Violation precedence  
- [x] Readiness-v0 inputs, weights, drivers  
- [x] Insufficient-data + breach vs score  
- [x] Confidence policy versioned  
- [x] Result envelope + version fields  
- [x] Dirty trade handling  
- [x] Fixture + invariant contracts for 0C  

**Not done:** executable code, SQL, UI, golden JSON files (0C).

---

## 16. STOP / next gate

**Awaiting Product Owner review of Phase 0B.**

Suggested next:

```text
APPROVE PHASE 0B — then Phase 0C Fixtures & Test Accounts
(golden inputs/outputs implementing calc-spec-v0; still no Prop Pass UI)
```
