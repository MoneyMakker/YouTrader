# Prop OS (Phase 0C) — isolated domain fixtures

**Not production.** This module is the executable source of truth for `calc-spec-v0` fixtures.

## Rules

- Do **not** import from `App.tsx`, `YouTraderApp.tsx`, or wire into navigation / AI / Supabase.
- Do **not** import this package from production UI until a later approved phase.
- Excluded from app `tsc` (`tsconfig.json`) so Node ESM `.ts` imports work for fixture QA only.
- Run: `npm run test:prop-os-fixtures`

## Layout

| Path | Role |
|---|---|
| `types.ts` | Domain + engine envelopes |
| `eventOrder.ts` | Canonical event sort |
| `tradingDay.ts` | IANA firm TZ + DST-aware day id |
| `replay.ts` | Reference challenge replay (`calc-spec-v0`) |
| `fixtures/` | Deterministic scenarios + expected assertions |

See `docs/architecture/PROP_OS_PHASE_0C_FIXTURES.md`.
