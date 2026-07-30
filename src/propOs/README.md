# Prop OS domain package (Phase 1B)

Production-grade **pure** calculation engine for `calc-spec-v0`. No App UI, Supabase, AI, or RevenueCat wiring.

## Rules

- Import only domain contracts from this package.
- Do **not** import from `App.tsx` / navigation / screens until Phase 1E activation gate.
- Engine must not import Supabase, React, AsyncStorage, RevenueCat, AI, analytics, or UI tokens.
- App `tsconfig.json` includes `src/propOs` for type safety; product imports remain forbidden by process.

## Layout

| Path | Role |
|---|---|
| `engine.ts` | Production `calculateChallenge` |
| `replay.ts` | Deprecated thin alias → `calculateChallenge` |
| `types.ts` | Domain + engine envelopes |
| `eventOrder.ts` | Canonical event sort + input revision |
| `tradingDay.ts` | IANA firm TZ + DST-aware day id |
| `scoreDrivers.ts` | Causal score-delta drivers (±1) |
| `confidence.ts` | Confidence blocks |
| `fixtures/` | F01–F29 scenarios |

## Commands

```bash
npm run test:prop-os-engine   # types + fixtures + invariants
npm run typecheck             # includes src/propOs
```

See `docs/architecture/PROP_OS_PHASE_1B.md`.
