# Build 117 — Product Completeness & Reachability Audit

**Starting HEAD:** `2e72b85`  
**Audit date:** 2026-08-04 (updated after dirty-milestone reclassification)  
**Scope:** repository source vs production navigation (Prop Pass tab → Session Cockpit / Internal Screen).  
**Activation:** CLIENT WAKE-UPS OFF · GLOBAL REAL-USER ACTIVATION OFF (unchanged).

## Classification key

| Label | Meaning |
| --- | --- |
| DONE_AND_REACHABLE | Production nav, persisted-compatible data, L/E/E/retry, no fabrication, tests, no debug route |
| FUNCTIONALLY_COMPLETE_WITH_NEEDS_INPUT | Reachable and production-ready; withholds until real facts exist; explains missing inputs |
| ACTUALLY_PARTIAL | Route/persistence/calculation/interaction gap remains |
| DEVICE_QA_REQUIRED | Source complete enough; physical iPhone / Apple / StoreKit gates still required |

## Five-feature reclassification (Phase 2)

| # | Feature | Classification | Route | Persisted inputs | Missing-input behavior | Trace | Tests | Genuine defect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 8 | Payout / Planner | FUNCTIONALLY_COMPLETE_WITH_NEEDS_INPUT | Cockpit `readiness` (challenge) | equity, days, floors, snapshot threshold/reserve when present | `Missing` lists threshold/reserve/consistency gaps; no fabricated payout | `payout_planner` | rebuild + payout QA | None |
| 14 | Scaling | FUNCTIONALLY_COMPLETE_WITH_NEEDS_INPUT | Cockpit action → `live_health` | Live risk settings + recovery progress; risk-step / preservation gate withheld | `needs_input` + Missing list; never invents eligibility | `scaling` | rebuild + scaling QA | None |
| 15 | Safe Withdrawal | FUNCTIONALLY_COMPLETE_WITH_NEEDS_INPUT | Cockpit `readiness` (live) | equity/HWM/floors/reserves when configured; recorded payouts | Missing when reserve fields absent | `payout_planner` / withdrawal status | rebuild + withdrawal QA | None |
| 17 | Profit Protection | FUNCTIONALLY_COMPLETE_WITH_NEEDS_INPUT | Cockpit metric + `live_health` | Peaks/lock thresholds not persisted yet → input withheld | Explicit `profit_protection_configuration` missing | `profit_protection` | profit-protection QA | None (persistence of peaks is future evidence, not fabrication) |
| 29 | Rules Compliance | FUNCTIONALLY_COMPLETE_WITH_NEEDS_INPUT | Cockpit action → `live_health` | Component behavior scores not persisted | Explicit `compliance_data_missing`; no fabricated score | `compliance` | compliance domain + cockpit QA | None |

## Full feature matrix (summary)

| # | Feature | Classification |
| --- | --- | --- |
| 1–7, 9–13, 16, 18–28, 30–33 | Pre-Trade through Locked preview | DONE_AND_REACHABLE |
| 8, 14, 15, 17, 29 | See table above | FUNCTIONALLY_COMPLETE_WITH_NEEDS_INPUT |
| 34 | Full Prop Pass with entitlement | DEVICE_QA_REQUIRED |

## Application-owned fixes in dirty milestone

1. Build identity **116 → 117**.
2. `runtimeRebuild` enriches payout / withdrawal / scaling / progression from real facts only.
3. Session Cockpit surfaces Scaling, Position Progression, Rules Compliance with Missing + calculation traces.
4. Edge runtime bundle regenerated to match rebuild source.
5. Unrelated CocoaPods shellScript drift in `project.pbxproj` restored (staging overlay kept).

## Explicitly not done

- Global client wake-ups / real-user activation remain **OFF**.
- Production Edge processor redeploy of updated rebuild requires separate PO approval.
- Physical iPhone QA, Apple stored:true/revoke, subscription matrix, final archive, TestFlight.
