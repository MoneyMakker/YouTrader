# YouTrader 3.0 Product Roadmap

> **Track separation (do not conflate):**
>
> | Track | Progress |
> |---|---:|
> | UI Infrastructure (YDL platform) | ~**97%** (Phase 6 closed) |
> | YouTrader 3.0 Product | **~5%** (audit + 0A spec in progress) |
> | App readiness to *transform* | ~**35–40%** (infra + honest architecture) |
>
> Factory ready. Domain architecture starting. Product UI for Prop Pass **not** started.

## Product Filter (mandatory)

Every candidate feature must pass:

1. **Utility Test** — Helps the trader make a better decision, avoid a prop-firm rule violation, or improve long-term profitability odds. If none, it does not ship.
2. **Evidence Test** — On which user data is the claim based?
3. **Action Test** — What concrete decision can the user take after seeing it?
4. **Confidence Test** — Is the sample large enough to show the claim confidently? (**Data Confidence Layer** — sample size + confidence on engine outputs, not only UI.)
5. **Simplicity Test** — Can the core value be one card, one number, or one action?
6. **Safety Test** — Does the recommendation push unjustified risk?

### Truth hierarchy

```text
Trades → Deterministic Engine → Insights (+ confidence) → AI explanation
```

AI never invents metrics or pass odds.

## Correct build order

```text
Infrastructure (YDL)                         ✅
Phase 0 audit                                ✅ FINAL APPROVED
Phase 0A Domain Schema                       ✅ FINAL APPROVED
Phase 0B Calculation Engine                  ✅ FINAL APPROVED
Phase 0C Fixtures & Test Accounts            ✅ FINAL APPROVED
Phase 0D Migration Plan                      ✅ FINAL APPROVED (`b740a9a`)
── Phase 0 architecture gate PASSED ──
Phase 1A Additive Database Foundation        ← READY FOR REVIEW
Phase 1B Production Domain Engine
Phase 1C Shadow Calculation Pipeline
Phase 1D Internal Account Management
Phase 1E Controlled Product Activation
Prop Pass UI                                 (after 1A–1C evidence; not before)
…
```

**Do not** ship UI “pass probability %” before domain + readiness model.  
**Do not** delete AI Analytics until soft-nav + consumer audit is approved later.

Naming note: React Native + Expo remains. UI language is **premium native iOS / SwiftUI-inspired**, not a SwiftUI rewrite.

---

## Phase 0 — Prop Domain Architecture

**Status:** **FINAL APPROVED** (0 Audit + 0A–0D). Architecture gate **PASSED**.

**Goal:** mathematical and product foundation. No major UI redesign.

Split into four subprojects:

| ID | Name | Spec / code focus |
|---|---|---|
| **0A** | Domain Schema | [`PROP_OS_PHASE_0A_DOMAIN_SPEC.md`](./architecture/PROP_OS_PHASE_0A_DOMAIN_SPEC.md) — **FINAL APPROVED** |
| **0B** | Calculation Engine | [`PROP_OS_PHASE_0B_CALC_ENGINE_SPEC.md`](./architecture/PROP_OS_PHASE_0B_CALC_ENGINE_SPEC.md) — **FINAL APPROVED** |
| **0C** | Fixtures & Test Accounts | [`PROP_OS_PHASE_0C_FIXTURES.md`](./architecture/PROP_OS_PHASE_0C_FIXTURES.md) — **FINAL APPROVED** |
| **0D** | Migration Plan | [`PROP_OS_PHASE_0D_MIGRATION_PLAN.md`](./architecture/PROP_OS_PHASE_0D_MIGRATION_PLAN.md) — **FINAL APPROVED** |

Accepted commits: `6aa3339`, `1c93ee7`, `206f3e7`, `dc965c2`, `cece87a`, `e4976e4`, `b740a9a`.

---

## Phase 1 — Implementation (split)

| ID | Name | Focus | Status |
|---|---|---|---|
| **1A** | Additive Database Foundation | SQL tables, RLS, immutability, types, schema tests — [`PROP_OS_PHASE_1A.md`](./architecture/PROP_OS_PHASE_1A.md) | READY FOR REVIEW |
| **1B** | Production Domain Engine | Wire calc-spec behind repos (not UI) | Not started |
| **1C** | Shadow Calculation Pipeline | Old/new compare | Not started |
| **1D** | Internal Account Management | Opt-in accounts; no silent trade bind | Not started |
| **1E** | Controlled Product Activation | Feature-flagged read path | Not started |

**1A must not:** Prop Pass UI, navigation change, legacy auto-assign, backfill, shadow, AI changes, `src/propOs` App import.

### Aggregate model (mandatory)

```text
User → PropAccount[] → PropChallenge[] → Trade[]
```

### Rule engine

Configurable versioned `PropRuleSet` — not hard-coded to one firm. Drawdown as strategies:

- Static DD  
- End-of-day trailing  
- Intraday trailing  
- High-water mark as required state for trailing  

### Trade normalization

Instrument; direction; contracts; entry/exit; realized P&L; fees; timestamp; session; setup/tag; stop; initial risk; R; duration; account/challenge; rule context at trade time.

### Data Confidence Layer

Every engine insight / readiness / edge output carries **`sampleSize` + `confidence`**. UI only displays what the engine already computed.

### Scoring evolution (earn the word “Probability”)

| Version | Name |
|---|---|
| V1 | **Prop Readiness Score** (deterministic 0–100) |
| V2 | **Estimated Pass Probability** (calibrated) |
| V3 | Personalized estimated probability |

Quarantine / replace ad-hoc `calculatePassProbability` heuristics in implementation phases — not via silent UI %.

### Decision vocabulary (honesty)

1. Decision Replay  
2. Pre-session Guidance  
3. Post-trade Review/Warning  
4. Real Intervention — **only** with live event source  

### Phase 0 deliverables (across 0A–0D)

- Domain schema · calculation specifications · fixtures · migration plan  
- Rule engine design · versioned scoring · **No** major UI redesign  

**Audit:** [`docs/architecture/PROP_OS_PHASE0_DATA_AUDIT.md`](./architecture/PROP_OS_PHASE0_DATA_AUDIT.md) — **FINAL APPROVED**.

---

## Phase 1 — Prop OS Foundation (after 0A–0D)

### Navigation

Do not hard-delete `AI Analytics` immediately:

1. Remove from primary product navigation  
2. Replace user entry with `Prop Pass`  
3. Keep legacy behind an internal flag temporarily  
4. Delete after confirming no dependent consumers  

### Prop Pass screen

Answers: *How safely am I progressing toward passing this challenge today?*

Structure: Readiness Score; today’s change; ≤3 drivers; Buffer Health (multi-buffer); nearest risk; Daily Mission; account/challenge context; empty/low-data + **confidence**.

### Motion / polish budget

Applied selectively. Dynamic Island–style patterns are **rare** (warnings, mission complete, important transitions) — not permanent chrome.

---

## Phase 2 — Performance Intelligence

Deterministic analytics — not a GPT summary. Every delta/edge shows **sample size + confidence**.

- Performance Delta (10 / 20 / 50 / 100)  
- Edge Discovery (min sample + statistical confidence)  
- What Actually Makes Money  
- Session / Instrument DNA (net, expectancy, trade count)  

---

## Phase 3 — Prop Challenge Engine

Readiness; Buffer Health (daily / trailing / max DD / target / consistency); Pass Timeline with versioned snapshots; Rule Health; risk state; account phase.

---

## Phase 4 — Decision Engine

- Decision Replay (evidence + sample sizes)  
- Guidance / post-trade warnings until live feed exists  
- What If Simulator (deterministic replay; never mutate journal)  

---

## Phase 5 — Futures Operating Modes

Facts fixed; modes change **policy** only (risk caps, stopping rules, intervention sensitivity, missions).

---

## Phase 6 — Product Polish & Release Hardening

Device QA, a11y, offline, migration cleanup, TestFlight, calibration, App Store, gradual rollout, rollback.
