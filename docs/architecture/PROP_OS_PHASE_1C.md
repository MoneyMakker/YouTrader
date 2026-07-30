# Prop OS — Shadow Calculation Pipeline (Phase 1C)

**Status:** READY FOR REVIEW  
**Package:** `src/propOs/shadow/`  
**Runner:** `shadow-runner-v0`  
**Engine:** `calculateChallenge` only (no `replayChallenge` in new code)

## Boundary

```text
Database rows
     ↓
Repository adapter
     ↓
Validated domain input
     ↓
calculateChallenge
     ↓
Versioned output mapper
     ↓
Append-only snapshots
     ↓
Shadow validation report
```

- Engine does **not** import Supabase.
- Repository does **not** recalculate domain math.
- Snapshot mapper does **not** mutate engine results.
- App / UI / navigation / Prop Pass / Edge deploy / production Cron — **out of scope**.

## Idempotency

Keys: `challengeId` + `calculationVersion` + `ruleSetVersion` + `shadow inputRevision`.

Repeat run with identical keys → `confirmed_existing` (no duplicate math rows).  
Changed events / rules → new revision → new snapshot.

## Failure classes

`invalid_input` · `unsupported_rules` · `incomplete_equity_stream` · `database_read_failure` · `engine_failure` · `snapshot_write_failure` · `version_mismatch` · `reconciliation_mismatch`

Batch continues when one challenge fails.

## QA

| Command | Role |
|---|---|
| `npm run test:prop-os-shadow` | Memory pipeline + replayChallenge import gate |
| `npm run test:prop-os-shadow-pg` | Local PG service write + authenticated deny |
| `npm run test:prop-os-phase1c` | Engine fixtures/invariants + shadow |
| `npm run typecheck` | App graph includes `src/propOs` (no App imports) |

### Performance (memory, Node, 5 trials)

| Events | p50 | p95 |
|---|---|---|
| 100 | ~5 ms | ~6 ms |
| 1,000 | ~50 ms | ~54 ms |
| 5,000 | ~240 ms | ~260 ms |

Timings include DB-read (memory) + map + engine + snapshot write. Not mobile FPS.

## Security

- Shadow writer is service-role (memory `role: "service"` / local PG `service_role`).
- Authenticated/anon write path denied.
- No production Supabase apply.
- Credentials not committed.

## Waiting for

Product Owner approval before Phase 1D. Do not apply pipeline to production.
