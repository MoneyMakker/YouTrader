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
  normalizePerformanceTrades,
  orderPerformanceTrades,
  takeRecentTrades,
} from "./normalize";
export {
  calculatePerformanceMetrics,
  calculateRiskMetrics,
  calculateSequenceMetrics,
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
  queueIntelligenceCalculation,
  processIntelligenceCalculation,
  failIntelligenceCalculation,
} from "./processor";
export {
  createMemoryIntelligenceReadStore,
  runTrustedMemoryCalculation,
  type PerformanceIntelligenceReadStore,
  type PerformanceIntelligenceRequestStore,
  type IntelligenceScopeAvailability,
} from "./readStore";
