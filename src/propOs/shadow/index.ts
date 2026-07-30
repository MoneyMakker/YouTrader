/**
 * Prop OS Phase 1C — Shadow Calculation Pipeline.
 *
 * Reads repository rows → maps to domain → calculateChallenge → append-only snapshots.
 * Not for App / UI. Engine stays Supabase-unaware.
 */
export { SHADOW_RUNNER_VERSION, SHADOW_SCHEMA_VERSION } from "./types";
export type {
  ShadowFailureClass,
  ShadowBatchReport,
  ShadowChallengeOutcome,
  ShadowTiming,
  EngineSnapshotRow,
  ScoreSnapshotRow,
  AccountRow,
  ChallengeRow,
  RuleSnapshotRow,
  ExecutionRow,
  AccountEventRow,
  PublicReadinessExpectation,
} from "./types";

export { buildShadowInputRevision } from "./inputRevision";
export { fingerprint, stableStringify } from "./stable";
export {
  MappingError,
  mapAccountRow,
  mapChallengeRow,
  mapRuleSnapshotRow,
  mapExecutionRow,
  mapAccountEventRow,
  mapDomainEvents,
  accountToRow,
  challengeToRow,
  ruleSnapshotToRow,
  eventToRows,
} from "./mappers";
export {
  mapEngineResultToSnapshots,
  snapshotCoreEqual,
  engineResultFromSnapshotPayload,
} from "./snapshots";
export type { ShadowRepository, SeedableShadowRepository } from "./repository";
export { createMemoryShadowRepository } from "./memoryRepository";
export {
  seedFixtureIntoRepository,
  runShadowChallenge,
  runShadowBatch,
  compareExpectation,
} from "./runner";
