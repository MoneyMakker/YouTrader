# Prop Pass — Performance Intelligence (Phase 3A)

**Status:** READY FOR FINAL REVIEW (remediation)  
**Starting foundation commit:** `84bd80e`  
**Remediation commit (this):** pending `fix(prop-os): finalize intelligence publication invariants`  
**Depends on:** Phase 2C FINAL APPROVED  
**Package:** `src/propOs/intelligence/`  
**Internal UI:** `src/propPass/PerformanceIntelligenceInternalPanel.tsx` (staging / Prop Pass internal only)

## Processor isolation

Dedicated role: **`prop_os_performance_intelligence_processor`**

| Capability | PUBLIC | anon | authenticated | PI processor | assignment recalc (`prop_os_recalc_processor`) | service_role |
| --- | --- | --- | --- | --- | --- | --- |
| SELECT own PI snapshots / current / calc / findings | no | no | yes (RLS) | yes | **no** (revoked) | yes |
| INSERT/UPDATE/DELETE PI snapshots (direct) | no | no | no | insert via RPC only | no | yes |
| `request_performance_intelligence` | no | no | yes (allowlist+gate) | n/a | n/a | yes |
| `complete_performance_intelligence` | no | no | **no** | **yes** | **no** | yes |
| `fail_performance_intelligence` | no | no | **no** | **yes** | **no** | yes |
| `complete_recalculation` (assignment) | no | no | no | **no** (not granted) | yes | yes |
| Mutate Phase 1–2 rule/engine/score snapshots | no | no | no | **no** | via assignment pipeline only | yes |
| Mutate assignment events / projections | no | no | no | **no** | via assignment cmds | yes |
| Account/challenge mutation commands | no | no | allowlisted only | **no** | no | yes |
| Cross-owner snapshot read | no | no | no (RLS) | only via explicit `p_user_id` in trusted RPC | n/a | yes |

Assert: `prop_os_assert_pi_processor()` — rejects App JWT / anon / bare recalc processor.

## Publication transaction

```text
queue_claim
→ immutable snapshot insert
→ findings insert
→ current projection upsert
→ queue completion
→ command receipt
```

Failure injection stages (`prop_os.fail_after`):  
`pi_queue_claim` | `pi_snapshot_insert` | `pi_finding_insert` | `pi_current_projection` | `pi_queue_completion` | `pi_receipt_completion`

On any injected failure the SQL transaction aborts → **zero** false current, completed queue, or success receipt. Retry succeeds with clear GUC.

## Current uniqueness (DB)

Unique index `prop_pi_snapshots_logical_identity_uidx` on:

```text
(user_id, scope_key, assignment_revision, input_revision, metric_spec_version, engine_version)
```

PK on `prop_performance_intelligence_current (user_id, scope_key)` → at most one current pointer per scope.  
Duplicate publication coalesces idempotently. Metric-spec N vs N+1 remain independently addressable via identity columns. Scope hash includes `kind` → account vs challenge cannot collide.

## Projection rebuild parity

- `prop_os_pi_rebuild_current_projection(user_id)`
- `prop_os_pi_projection_parity(user_id)` → `{ kind: parity|drift, ... }`
- Memory: `rebuildCurrentProjection` / `projectionParity`

## Numeric precision

See `PRECISION_CONTRACT` in `src/propOs/intelligence/precision.ts`:

- Money: integer minor units
- Ratios: integer `valueScaled` / `PI_RATIO_SCALE` (1e6), half-away-from-zero at emission
- No NaN/Infinity; undefined kinds explicit
- Canonical serialization uses `valueScaled` + `scale`

## Canonical serialization

`canonicalSnapshotBytes` / `canonicalSnapshotHash` — stable keys, omit undefined, UTC ISO, no locale numbers.

## Input revision

`buildDatasetIdentityHash` + `buildInputRevisionV1` include scope, assignment revision, ordered trade fingerprints (metric fields only), trade count, window bounds, account/challenge, metric+engine versions.

## Capacity

| Limit | Value |
| --- | --- |
| Max trades / scope | 5_000 → `unsupported` |
| Max surfaced segments | 64 (suppressed count recorded; metrics use full set) |
| Max surfaced findings | 8 (`findingsSuppressed` recorded) |

## Migrations (prepare only)

- `20260730270000_prop_os_performance_intelligence.sql`
- `20260730280000_prop_os_performance_intelligence_remediation.sql`

**Do not apply to production** without Ops approval.

## Forbidden subsequent phases

Pass Probability · Discipline Streak UX · Decision Replay · Smart Intervention · AI explanations · public rollout · brokers

## Waiting for

Product Owner FINAL review.
