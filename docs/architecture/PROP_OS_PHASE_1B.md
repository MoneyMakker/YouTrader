# Prop OS — Production Domain Engine (Phase 1B)

**Status:** FINAL APPROVED  
**Commit:** `33d43a2`  
**Canonical API:** `calculateChallenge` (`engine.ts`)  
**Calc / confidence:** `calc-spec-v0` / `confidence-policy-v0`

## Boundary

```text
Normalized Inputs
      ↓
Deterministic Replay
      ↓
Rule Evaluation
      ↓
Buffers / Status
      ↓
Readiness / Confidence
      ↓
Versioned Engine Output
```

Allowed: pure TypeScript domain math only.

Forbidden imports inside `src/propOs`: Supabase, React/RN, AsyncStorage, RevenueCat, navigation, AI, analytics SDK, UI tokens/components.

Forbidden product wiring (still): App screens, Prop Pass UI, shadow pipeline, snapshot writes, Edge Functions, live DB reads of Prop OS tables.

## API

```ts
import { calculateChallenge, publicReadinessScore } from "./propOs";

const result = calculateChallenge({
  challenge,
  events,
  asOfUtc,
  previousReadinessScore?,
  previousReadinessFactors?,
});
```

- Same inputs + rule snapshot + calc version + event order → same domain output.
- `asOfUtc` filters events; it does not inject wall-clock time into math.
- `publicReadinessScore` returns `null` when status is `breached` / `unsupported` / incomplete gates.

`replayChallenge` remains a thin deprecated alias of `calculateChallenge` (parity proven in invariants QA).

## QA

| Command | Role |
|---|---|
| `npm run test:prop-os-types` | Isolated domain typecheck |
| `npm run test:prop-os-fixtures` | F01–F29 + catalog asserts |
| `npm run test:prop-os-invariants` | Parity, determinism, permutation, idempotency, no Date.now, money ints, benchmark |
| `npm run test:prop-os-engine` | fixtures + invariants |
| `npm run typecheck` | App graph includes `src/propOs` (no App imports yet) |

Node fixture runners use `scripts/prop-os-register.mjs` so extensionless relative imports resolve to `.ts`.

## Explicit non-goals (Phase 1C+)

Shadow pipeline, engine snapshot persistence, repositories, account UI, production migration apply.

## Waiting for

Product Owner approval before Phase 1C.
