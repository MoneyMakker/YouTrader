# Prop OS (Phase 0C) — isolated domain fixtures

**Not production.** This module is the executable source of truth for `calc-spec-v0` fixtures.

## Rules

- Do **not** import from `App.tsx`, `YouTraderApp.tsx`, or wire into navigation / AI / Supabase.
- Do **not** import this package from production UI until a later approved phase.
- App `tsconfig.json` excludes `src/propOs` so production typecheck stays disconnected.
- Isolated static check: `npm run test:prop-os-types` (`tsconfig.prop-os.json`).
- Full fixture QA (types + executable): `npm run test:prop-os-fixtures`

## Layout

| Path | Role |
|---|---|
| `types.ts` | Domain + engine envelopes |
| `eventOrder.ts` | Canonical event sort |
| `tradingDay.ts` | IANA firm TZ + DST-aware day id |
| `scoreDrivers.ts` | Causal score-delta drivers + reconciliation tolerance |
| `replay.ts` | Reference challenge replay (`calc-spec-v0`) |
| `fixtures/` | Deterministic scenarios + expected assertions |

## Score-delta drivers (F27)

- Causal `drivers` only when a previous factor snapshot is supplied.
- `sum(driver.contribution)` must equal `currentScore − previousScore` within `SCORE_DELTA_RECONCILIATION_TOLERANCE` (= **1** score point).
- If reconciliation fails or previous factors are missing, factors are `supportingEvidence` only — not drivers.

See `docs/architecture/PROP_OS_PHASE_0C_FIXTURES.md`.

## Security scan note

Aikido = **NOT RUN** (authentication failed). Non-blocking; do not report as PASS.
