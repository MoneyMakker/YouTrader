/**
 * @deprecated Use `calculateChallenge` from `./engine`.
 * Kept as a thin alias so Phase 1B can prove parity then retire dual paths.
 */
export {
  calculateChallenge as replayChallenge,
  publicReadinessScore,
  type EngineInput as ReplayInput,
} from "./engine";
