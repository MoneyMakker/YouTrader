# Prop OS domain package (Phase 1B + 1C)

Production-grade **pure** calculation engine (`calculateChallenge`) plus isolated **shadow pipeline** (`src/propOs/shadow/`). No App UI, AI, or RevenueCat wiring.

## Rules

- Import only domain contracts from this package.
- Do **not** import from `App.tsx` / navigation / screens until Phase 1E activation gate.
- Do **not** import deprecated `replayChallenge` in new code (static gate: `test:prop-os-shadow`).
- Engine must not import Supabase, React, AsyncStorage, RevenueCat, AI, analytics, or UI tokens.
- Shadow may use repository adapters; App still must not call the runner.

## Layout

| Path | Role |
|---|---|
| `engine.ts` | Production `calculateChallenge` |
| `replay.ts` | Deprecated thin alias → `calculateChallenge` |
| `shadow/` | Phase 1C repository + mappers + runner + memory store |
| `fixtures/` | F01–F29 scenarios |

## Commands

```bash
npm run test:prop-os-engine    # fixtures + invariants
npm run test:prop-os-shadow    # shadow memory QA + alias gate
npm run test:prop-os-shadow-pg # local PG smoke (optional)
npm run typecheck
```

See `docs/architecture/PROP_OS_PHASE_1B.md` and `PROP_OS_PHASE_1C.md`.
