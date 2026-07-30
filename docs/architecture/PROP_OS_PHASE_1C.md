# Prop OS — Shadow Calculation Pipeline (Phase 1C)

**Status:** FINAL APPROVED  
**Baseline commit:** `ee5c016`  
**Remediation commit:** `89fef76`  
**Package:** `src/propOs/shadow/`  
**Runner:** `shadow-runner-v0`  
**Engine:** `calculateChallenge` only (no `replayChallenge` in new code)

## Boundary

```text
Database rows
     ↓
Repository adapter (psql bridge / memory)
     ↓
Validated domain input (Phase 1C mappers)
     ↓
calculateChallenge
     ↓
Versioned output mapper
     ↓
Append-only snapshots (PostgreSQL)
     ↓
Shadow validation report
```

- Engine does **not** import Supabase.
- Repository does **not** recalculate domain math.
- Snapshot mapper does **not** mutate engine results.
- App / UI / navigation / Prop Pass / Edge deploy / production Cron — **out of scope**.
- No permanent Node `pg` dependency — local QA uses `psql` + temp JSON files.

## Idempotency

Keys: `challengeId` + `calculationVersion` + `ruleSetVersion` + `shadow inputRevision`.

Repeat run with identical keys → `confirmed_existing` (no duplicate math rows).  
Changed events / rules → new revision → new snapshot.

## Failure classes

`invalid_input` · `unsupported_rules` · `incomplete_equity_stream` · `database_read_failure` · `engine_failure` · `snapshot_write_failure` · `version_mismatch` · `reconciliation_mismatch`

Batch continues when one challenge fails.

## FINAL remediation checklist

| Contract | Result |
|---|---|
| input revision independent of row order | PASS |
| input revision independent of JSON key order | PASS |
| repeat-run idempotency (PG row counts stable) | PASS |
| changed-input versioning (new row; previous intact) | PASS |
| changed-rule versioning (new challenge attempt; history preserved) | PASS |
| changed-engine / readiness / confidence versioning (append history) | PASS |
| snapshot round-trip integrity (mapper → PG → readback) | PASS |
| batch failure isolation | PASS |
| incomplete-data behavior (no fabricated public score) | PASS |
| service-role write | PASS |
| authenticated denial | PASS |
| append-only protection (update/delete rejected) | PASS |
| no App imports | PASS |
| no production database use | PASS |
| no new `replayChallenge` consumers | PASS |

## QA

| Command | Role |
|---|---|
| `npm run test:prop-os-shadow` | Memory pipeline + replayChallenge import gate |
| `npm run test:prop-os-shadow-pg` | Local PG bootstrap + **full round-trip** remediation |
| `npm run test:prop-os-phase1c` | Engine fixtures/invariants + shadow |
| `npm run typecheck` | App graph includes `src/propOs` (no App imports) |

### Exact PG round-trip path

1. Bootstrap isolated DB `prop_os_shadow1c` on `localhost:55432`
2. Seed remapped fixtures (F01, F07, F22, …) via SQL generated from domain mappers
3. Read rows through `createPsqlShadowRepository` (`psql` / temp JSON)
4. Map with real Phase 1C mappers
5. Call only `calculateChallenge` via `runShadowChallenge`
6. Persist engine + score snapshots (service_role)
7. Read snapshots back; compare with `snapshotCoreEqual` + field integrity asserts

### Performance breakdown (isolated PG, diagnostic)

Method:

- `wallClockPipelineTotal` = single `runShadowChallenge` wall clock (`totalRunnerMs`)
- `stageDiagnosticDurations` = separately sampled/attributed stages (`prepSeedMs`, `dbReadMs`, `mappingMs`, `engineMs`, `snapshotWriteMs`, `snapshotReadBackMs`)

Do **not** sum `stageDiagnosticDurations` into `wallClockPipelineTotal` — prep seed is outside the runner, and stage timers can overlap bookkeeping with wall clock.

| Events | wallClockPipelineTotal | prepSeed (diagnostic) | dbRead | mapping | engine | snapshotWrite | readBack | peakMemory |
|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1,000 | ~344 ms | ~223 ms | ~132 ms | ~1 ms | ~41 ms | ~160 ms | ~21 ms | NOT MEASURED |
| 5,000 | ~565 ms | ~758 ms | ~159 ms | ~1 ms | ~201 ms | ~159 ms | ~22 ms | NOT MEASURED |

## Security

- Shadow writer is service-role (memory `role: "service"` / local PG `service_role`).
- Authenticated/anon write path denied.
- No production Supabase apply.
- Credentials not committed.
- No new production database driver package.

## Waiting for

Product Owner **FINAL APPROVAL**. Do not begin Phase 1D. Do not apply pipeline to production.
