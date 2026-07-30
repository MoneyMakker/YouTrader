# Phase 0C — Prop OS Fixtures & Test Accounts

**Status:** FINAL APPROVED (Product Owner, 2026-07-30)  
**Commits accepted:** `cece87a`, `e4976e4`  
**Parent:** Phase 0 — Prop Domain Architecture  
**Depends on:**  
- [`PROP_OS_PHASE_0B_CALC_ENGINE_SPEC.md`](./PROP_OS_PHASE_0B_CALC_ENGINE_SPEC.md) — **APPROVED WITH IMPLEMENTATION CONDITIONS** (`206f3e7`)  
- [`PROP_OS_PHASE_0A_DOMAIN_SPEC.md`](./PROP_OS_PHASE_0A_DOMAIN_SPEC.md) — APPROVED WITH SPEC CONDITIONS  
**Follow-on:** [`PROP_OS_PHASE_0D_MIGRATION_PLAN.md`](./PROP_OS_PHASE_0D_MIGRATION_PLAN.md)  

**Date:** 2026-07-30  
**Scope:** Executable deterministic fixtures, reference replay, focused QA — isolated from production.  
**Out of scope:** Production DB migration, Prop Pass UI, AI, fake broker, wiring into `App.tsx` / navigation.

**Calculation suite:** `calc-spec-v0`  
**Executable root:** `src/propOs/`  
**QA commands:**
- `npm run test:prop-os-types` — isolated static TypeScript (`tsconfig.prop-os.json`)
- `npm run test:prop-os-fixtures` — types **then** executable fixture checks

**Security scan:** Aikido = **NOT RUN** (authentication failed). Non-blocking; must not be reported as PASS.

---

## 1. Purpose

Phase 0C is the **executable source of truth** for engine behavior before production implementation (0D+). Fixtures freeze:

- versioned rule snapshots on challenge attempts;
- canonical ordered event streams;
- expected lifecycle / readiness / limitations / drivers;
- edge cases required by PO 0B implementation conditions.

Reference replay historically lived in `src/propOs/replay.ts`. **Phase 1B** promoted the production engine to `src/propOs/engine.ts` (`calculateChallenge`). `replay.ts` is now a thin deprecated alias — fixtures run against the production engine only.

---

## 2. Isolation rules

| Allowed | Forbidden |
|---|---|
| `src/propOs/**` | Import from `App.tsx` / `YouTraderApp.tsx` |
| `scripts/prop-os-fixtures-qa.ts` | Production UI / Prop Pass screens |
| `npm run test:prop-os-types` | — |
| `npm run test:prop-os-fixtures` | Supabase migrations / RLS changes |
| Docs under `docs/architecture/` | Fake live broker integration |
| | AI coaching / probability surfaces |

---

## 3. Canonical event order (locked)

```text
occurredAtUtc
→ brokerSequence (nullable; missing sorts after numbered)
→ stable internal id
```

Shuffle invariance is asserted in QA (`F15` + catalog shuffle check).

---

## 4. Fixture catalog

| ID | Scenario |
|---|---|
| F01 | Static DD — near floor, still active |
| F02 | EOD trailing — HWM day1, loss day2 → at_risk |
| F03 | Intraday trailing **with** equity stream |
| F04 | Daily loss breach mid-day |
| F05 | Firm IANA TZ trading day (not device midnight) |
| F06 | Readiness insufficient data |
| F07 | Readiness healthy path |
| F08 | Static breach — readiness score withheld |
| F09 | Unassigned trades ignored |
| F10 | Duplicate event id ignored |
| F11 | Fees missing → limitation |
| F12 | Passed challenge |
| F13 | Corrected trade (correctsEventId) |
| F14 | Voided trade |
| F15 | Out-of-order import → same result after sort |
| F16 | Identical timestamps — broker/id tie-break |
| F17 | Partial fills / scale-in exits |
| F18 | Overnight position — trade-only approximation limitation |
| F19 | DST spring-forward (America/New_York) |
| F20 | DST fall-back |
| F21 | EOD trailing breach |
| F22 | Intraday trailing **without** equity stream → incomplete |
| F23 | Multiple concurrent accounts / challenges |
| F24 | Challenge reset attempt |
| F25 | Failed attempt then new attempt |
| F26 | Rule-template update ignored — historical snapshot wins |
| F27 | Score delta with attributable drivers |
| F28 | Breach irreversible (later profit does not clear) |
| F29 | Official correction clears breach (audit reason) |

---

## 5. Expected envelope fields (fixture asserts)

Outputs carry versioned explainability (names may evolve, meaning locked):

- `calculationVersion` / `calcSpecVersion`: `calc-spec-v0`
- `ruleSetVersion` + snapshot identity
- `status` / lifecycle (status > score)
- `readinessScore` null when breached / insufficient / terminal
- `limitations[]` (fees_missing, incomplete equity, approx, …)
- `confidence` when score present
- causal `drivers` on score delta (F27) — see §5.1

### 5.1 Score-delta driver reconciliation (normative)

| Rule | Contract |
|---|---|
| Causal drivers require | `previousReadinessScore` **and** `previousReadinessFactors` |
| Contribution | `weight × (currentValue − previousValue) × 100` per factor |
| Reconciliation | `\|sum(contribution) − (currentScore − previousScore)\| ≤ SCORE_DELTA_RECONCILIATION_TOLERANCE` |
| Tolerance | **`1`** score point (integer `floor` rounding) |
| Failure / missing snapshot | Factors go to `supportingEvidence` only; `drivers = []`; `driversReconciled = false` |

“Causal-ish” is **not** a valid contract.

---

## 6. Verification

```bash
npm run test:prop-os-types
npm run test:prop-os-fixtures
npm run typecheck
```

Expected: isolated prop-os types PASS; fixture QA PASS (includes types gate); app typecheck PASS.

**tsconfig scope:** `tsconfig.prop-os.json` includes `src/propOs/**/*.ts` and Prop OS QA scripts. App `tsconfig.json` includes `src/propOs` for type safety; App/UI imports remain process-forbidden until Phase 1E.

---

## 7. STOP / next gate

**Phase 0C — FINAL APPROVED.**

Next: Phase 0D Migration Plan — [`PROP_OS_PHASE_0D_MIGRATION_PLAN.md`](./PROP_OS_PHASE_0D_MIGRATION_PLAN.md).

**Production calculation engine implementation remains forbidden** until PO opens that gate after 0D (or an explicit implementation approve).
