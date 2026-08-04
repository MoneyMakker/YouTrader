# Capital Preservation — Persisted Evidence (PPOS-117-13)

Calculation version: `build117.preservation.v1`

## Policy

- Scores come only from persisted facts for the selected `userId` + `accountId`.
- Profitability never implies compliance. A profitable over-risk trade reduces the score.
- A losing trader who stays inside plan risk/size may still receive a strong score.
- When minimum evidence is missing, `score` is `null` and status is `needs_input` or `insufficient_evidence`.
- Reload and duplicate delivery are deterministic for the same fact set.
- Voided trade revisions are ignored; the active revision is applied once.

## Required components (all must be `ready` before publishing a score)

| Component | Primary evidence |
|-----------|------------------|
| `current_drawdown` | Equity high, current equity, configured max drawdown |
| `daily_risk_adherence` | Daily budget vs used; optional floor from explicit per-trade risk facts |
| `weekly_risk_adherence` | Weekly limit vs used (challenge without weekly limit → explicit N/A = 100) |
| `consecutive_loss_control` | Configured stop-after-losses + Kill Switch consecutive-loss fact |
| `position_size_stability` | Maximum contracts + execution/trade contract facts |
| `hard_rule_compliance` | Breach facts, negative rooms, explicit per-trade risk breaches |
| `kill_switch_events` | Kill Switch / Session Lock state |
| `recovery_mode_adherence` | Recovery state (+ trade risk/size when active); N/A in challenge |

## Context-optional (still resolved before `ready`)

- `weekly_risk_adherence` for challenge without a weekly Live limit
- `recovery_mode_adherence` for challenge context

## Minimum evidence threshold

- Account identity, trading day, equity marks, and risk rooms are required setup.
- Every required component must reach `ready` with a 0–100 score.
- Partial component readiness → `insufficient_evidence`, score withheld.
- Missing setup → `needs_input`, score withheld.

## Weights

Unchanged from `CAPITAL_PRESERVATION_WEIGHTS` (total 100).

## Normalization

Integer scores clamped to `[0, 100]`. Overall score is the weighted floor average from `calculateCapitalPreservationScore`.

## Confidence / evidence state

Each component records:

- `status`: `ready` | `missing` | `insufficient`
- `confidence`: `high` | `low` | `none`
- `evidenceRefs`: deterministic `{ componentId, kind, id }` references
- `missingInputs`: explicit gaps

## Output shape

```ts
{
  status: "ready" | "needs_input" | "insufficient_evidence",
  score: number | null,
  components: Partial<Record<PreservationComponentId, number>>,
  missingInputs: string[],
  evidenceRefs: PreservationEvidenceRef[],
  calculationVersion: "build117.preservation.v1"
}
```

Wired through `rebuildPropPassRuntime` → `output.capitalPreservation` and Live `liveFacts.preservation` only when `status === "ready"`.
