# Prop Pass — Performance Intelligence (Phase 3A)

**Status:** READY FOR REVIEW  
**Starting commit:** `f727c01`  
**Suggested commit message:** `feat(prop-os): add performance intelligence foundation`  
**Depends on:** Phase 2C FINAL APPROVED  
**Package:** `src/propOs/intelligence/`  
**Internal UI:** `src/propPass/PerformanceIntelligenceInternalPanel.tsx` (staging / Prop Pass internal only)  
**Mutation boundary (App):** `prop_os_cmd_request_performance_intelligence`  
**Trusted processor only:** `prop_os_cmd_complete_performance_intelligence` / `prop_os_cmd_fail_performance_intelligence`

## Versions

| Contract | Value |
| --- | --- |
| Metric spec | `pi-metric-spec-v0` |
| Engine | `pi-engine-v0` |
| Finding spec | `pi-finding-spec-v0` |
| Schema | `prop-os-schema-v0` |

## Boundary

```text
YouTrader journal facts (immutable)
  → scope filter + normalization
  → deterministic metric engine (pi-engine-v0)
  → versioned immutable snapshots
  → current projection + calc queue
  → Prop Pass read model (PerformanceIntelligenceReadStore)
```

App authenticated users may **request** calculation and **SELECT** own snapshots.  
App must **not** write snapshots, mark current, or complete/fail calculations.

## Scopes

| Scope | Key fields | Notes |
| --- | --- | --- |
| `challenge` | `challengeId`, `accountId` | Trades assigned to challenge |
| `account` | `accountId`, `includeArchivedChallenges` | Default excludes archived challenges |
| `recent_trades` | `accountId`, `count` (20 \| 50 \| 100) | Newest N closed trades, then chronological for sequences |
| `date_range` | `accountId`, `startUtc`, `endUtc` | Start inclusive, end exclusive (UTC) |

Max trades per scope: **5,000** (`PI_MAX_TRADES_PER_SCOPE`). Exceeding → `unsupported`.

## Formula catalogue summary

Centralized in `src/propOs/intelligence/metricSpec.ts` (`METRIC_CATALOGUE`):

- **Money:** integer minor units; fees subtracted into `netPnlMinor`.
- **Win classification:** win / loss / break-even by `netPnlMinor`.
- **Core ratios:** win rate, profit factor, payoff, expectancy, averages — zero-denominator kinds documented (`undefined_zero_loss`, `undefined_zero_profit`, `undefined_zero_denominator`).
- **Risk:** position size, risk amount, R-multiple dispersion; partial quality when fields missing.
- **Sequences:** win/loss streaks, post-loss averages, same-day trade frequency.
- **Segments:** instrument, direction, weekday UTC, session UTC bucket, outcome, optional risk bucket.
- **Findings:** rule-based, historical observations only; capped at 8 surfaced.

## Normalization exclusions

Reason codes (never silently included):

- `missing_identity`, `deleted_or_hidden`, `open_trade`, `voided_or_cancelled`
- `missing_pnl`, `malformed_timestamp`, `missing_timestamp`
- `duplicate_journal_id`

Fees: null/undefined → 0 on closed trades.

## Findings thresholds

From `METRIC_CATALOGUE.findings`:

- Min segment sample: **5**
- Min comparison sample: **10**
- Min absolute expectancy diff: **500** minor
- Min relative expectancy diff: **25%**
- Position size CV threshold: **0.5**
- Profit concentration share: **40%**
- Same-day overtrade threshold: **4** trades/day average

## Processor roles

Trusted completion roles (`TRUSTED_PI_PROCESSOR_ROLES`):

- `postgres`
- `service_role`
- `prop_os_recalc_processor`

`PUBLIC` / `anon` / App `authenticated` — **EXECUTE revoked** on complete/fail.

## Migrations (prepare only)

- `supabase/migrations/20260730270000_prop_os_performance_intelligence.sql`

**Do not apply to production** without separate Ops approval.

Tables: immutable snapshots, current projection, calc queue, findings index.  
Triggers forbid authenticated UPDATE/DELETE on immutable rows.

## Privilege matrix

| Action | authenticated | prop_os_recalc_processor |
| --- | --- | --- |
| SELECT own snapshots / current / calc | yes (RLS) | yes |
| INSERT/UPDATE/DELETE snapshots | no (trigger + revoke) | yes (via SECURITY DEFINER RPC) |
| `request_performance_intelligence` | yes (allowlist + gate) | yes |
| `complete_performance_intelligence` | no | yes |
| `fail_performance_intelligence` | no | yes |
| Cross-user read | no (RLS) | processor scoped by RPC args |

Kill switch: `prop_os_command_gate.commands_enabled = false` → request forbidden.

## Stale-write protection

- Processor complete/fail compares `p_assignment_revision` to `prop_os_assignment_revisions.revision`.
- Mismatch → `conflict` / `stale_assignment_revision`.
- Assignment bump marks current snapshots **outdated** and re-queues calc (`prop_os_pi_mark_outdated_for_user`).

## QA

```bash
npm run test:prop-pass-phase3a
npm run test:prop-pass-phase3a-pg   # requires local Postgres :55432
```

Captures: `.tmp/prop-pass-phase3a-captures/*.json`

## Validation (local)

| Gate | Result |
| --- | --- |
| `test:prop-pass-phase3a` (25 fixtures + 32 E2E) | PASS (58) |
| `test:prop-pass-phase3a-pg` | PASS (11) |
| Phase 2C / 2B / 2A domain | PASS |
| Phase 2C PG + live vertical slice | PASS |
| accounts / activation / shadow / fixtures / invariants | PASS |
| typecheck / translations:check / iOS export | PASS |
| App bundle secret scan | no service-role credentials (substring false positives only) |
| Aikido MCP | auth failure (non-blocking; local security gates passed) |

Production migrations were **not** applied.

## Forbidden subsequent phases

Until PO approval of 3A:

- Pass Probability overlays on PI
- Discipline Streak product UX
- Decision Replay
- Smart Intervention
- AI-generated metrics, explanations, or predictions
- Public nav / production rollout of PI surfaces
- Broker integrations / legacy bulk backfill
- App-side snapshot writes or processor impersonation

## Waiting for

Product Owner approval.
