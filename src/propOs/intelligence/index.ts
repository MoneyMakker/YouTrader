export type {
  IntelligenceScope,
  IntelligenceSnapshotStatus,
  IntelligenceDataQuality,
  RatioOrUndefined,
  PerformanceTradeInput,
  DatasetSummary,
  PerformanceMetrics,
  RiskMetrics,
  SequenceMetrics,
  SegmentMetric,
  DeterministicFinding,
  PerformanceIntelligenceSnapshot,
  IntelligenceCalcState,
  RawJournalTradeFact,
} from "./types";
export {
  PI_METRIC_SPEC_VERSION,
  PI_ENGINE_VERSION,
  PI_FINDING_SPEC_VERSION,
  PI_SCHEMA_VERSION,
  PI_MAX_TRADES_PER_SCOPE,
  PI_MAX_SEGMENTS,
  PI_MIN_SEGMENT_SAMPLE,
  PI_MAX_SURFACED_FINDINGS,
} from "./types";
export { METRIC_CATALOGUE } from "./metricSpec";
export {
  PRECISION_CONTRACT,
  PI_RATIO_SCALE,
  roundHalfAwayFromZero,
  ratioScaled,
  scaledToNumber,
} from "./precision";
export {
  CANONICAL_SERIALIZATION_CONTRACT,
  canonicalSnapshotBytes,
  canonicalSnapshotHash,
} from "./canonical";
export {
  buildDatasetIdentityHash,
  buildInputRevisionV1,
  tradeMetricFingerprint,
} from "./datasetIdentity";
export {
  normalizePerformanceTrades,
  orderPerformanceTrades,
  takeRecentTrades,
} from "./normalize";
export {
  calculatePerformanceMetrics,
  calculateRiskMetrics,
  calculateSequenceMetrics,
  ratioDisplayValue,
} from "./metrics";
export { calculateSegments } from "./segments";
export { evaluateFindings } from "./findings";
export {
  calculatePerformanceIntelligence,
  intelligenceSnapshotCoreBytes,
  filterFactsForScope,
} from "./engine";
export { scopeKey, scopeAccountId, buildInputRevision } from "./scope";
export { createHash, stableStringify } from "./hash";
export {
  createMemoryIntelligenceStore,
  markScopesOutdatedForAssignment,
  getCurrentSnapshot,
  type MemoryIntelligenceStore,
} from "./memoryStore";
export {
  TRUSTED_PI_PROCESSOR_ROLES,
  ASSIGNMENT_RECALC_PROCESSOR_ROLE,
  queueIntelligenceCalculation,
  processIntelligenceCalculation,
  failIntelligenceCalculation,
  assertTrustedPiProcessorRole,
} from "./processor";
export {
  attachPublicationState,
  publishIntelligenceSnapshot,
  type PublicationStage,
  type MemoryPublicationStore,
} from "./publication";
export { rebuildCurrentProjection, projectionParity } from "./rebuild";
export {
  createSupabaseIntelligenceReadStore,
} from "./supabaseReadStore";
export {
  createMemoryIntelligenceReadStore,
  runTrustedMemoryCalculation,
  type PerformanceIntelligenceReadStore,
  type PerformanceIntelligenceRequestStore,
  type IntelligenceScopeAvailability,
} from "./readStore";
