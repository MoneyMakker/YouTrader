/**
 * Phase 3A — Performance Intelligence domain contracts.
 * Deterministic, versioned, snapshot-based. No AI / predictions / causation.
 */

export const PI_METRIC_SPEC_VERSION = "pi-metric-spec-v0" as const;
export const PI_ENGINE_VERSION = "pi-engine-v0" as const;
export const PI_FINDING_SPEC_VERSION = "pi-finding-spec-v0" as const;
export const PI_SCHEMA_VERSION = "prop-os-schema-v0" as const;
export const PI_MAX_TRADES_PER_SCOPE = 5_000 as const;
export const PI_MAX_SEGMENTS = 64 as const;
export const PI_MIN_SEGMENT_SAMPLE = 5 as const;
export const PI_MAX_SURFACED_FINDINGS = 8 as const;

export type IntelligenceScope =
  | { kind: "challenge"; challengeId: string; accountId: string }
  | { kind: "account"; accountId: string; includeArchivedChallenges: boolean }
  | { kind: "recent_trades"; accountId: string; count: 20 | 50 | 100 }
  | { kind: "date_range"; accountId: string; startUtc: string; endUtc: string };
/** date_range: startUtc inclusive, endUtc exclusive (UTC). */

export type IntelligenceSnapshotStatus =
  | "current"
  | "outdated"
  | "insufficient_data"
  | "incomplete_data"
  | "unsupported"
  | "integrity_error";

export type IntelligenceDataQuality =
  | { kind: "complete" }
  | { kind: "partial"; missingFields: string[] }
  | { kind: "insufficient_sample"; required: number; actual: number }
  | { kind: "unsupported"; reasonCode: string }
  | { kind: "integrity_error"; reasonCode: string };

/**
 * Ratios use integer micro-units (valueScaled / PI_RATIO_SCALE).
 * Never emit NaN/Infinity; use explicit undefined kinds.
 */
export type RatioOrUndefined =
  | { kind: "value"; valueScaled: number }
  | { kind: "undefined_zero_loss" }
  | { kind: "undefined_zero_profit" }
  | { kind: "undefined_zero_denominator" }
  | { kind: "unavailable"; reasonCode: string };

export type PerformanceTradeInput = {
  journalTradeId: string;
  tradeClientId: string;
  occurredAtUtc: string;
  closedAtUtc?: string;
  instrument: string;
  direction: "long" | "short" | "unknown";
  realizedPnlMinor: number;
  feesMinor: number;
  netPnlMinor: number;
  size?: number;
  riskAmountMinor?: number;
  rMultiple?: number;
  assignmentRevision: number;
  voided?: boolean;
  open?: boolean;
};

export type DatasetSummary = {
  tradeCount: number;
  closedCount: number;
  excludedCount: number;
  exclusionReasons: Record<string, number>;
  dataQuality: IntelligenceDataQuality;
  identityHash: string;
  /** Findings generated before surface cap. */
  findingsGenerated?: number;
  /** Findings omitted by max-surface cap. */
  findingsSuppressed?: number;
  /** Segments omitted by cardinality cap (metrics still use full trade set). */
  segmentsSuppressed?: number;
};

export type PerformanceMetrics = {
  totalClosedTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  netRealizedPnlMinor: number;
  grossProfitMinor: number;
  grossLossMinor: number;
  winRate: RatioOrUndefined;
  averageTradeMinor: RatioOrUndefined;
  averageWinMinor: RatioOrUndefined;
  averageLossMinor: RatioOrUndefined;
  largestWinMinor: number | null;
  largestLossMinor: number | null;
  payoffRatio: RatioOrUndefined;
  profitFactor: RatioOrUndefined;
  expectancyPerTradeMinor: RatioOrUndefined;
};

export type RiskMetrics = {
  averagePositionSize: RatioOrUndefined;
  medianPositionSize: RatioOrUndefined;
  positionSizeDispersion: RatioOrUndefined;
  averageRiskAmountMinor: RatioOrUndefined;
  maximumRiskAmountMinor: number | null;
  riskDispersion: RatioOrUndefined;
  averageRMultiple: RatioOrUndefined;
  medianRMultiple: RatioOrUndefined;
  bestRMultiple: number | null;
  worstRMultiple: number | null;
  largestWinShareOfProfit: RatioOrUndefined;
  largestLossShareOfLoss: RatioOrUndefined;
  topInstrumentConcentration: RatioOrUndefined;
  dataQuality: IntelligenceDataQuality;
};

export type SequenceMetrics = {
  currentWinSequence: number;
  currentLossSequence: number;
  maximumWinSequence: number;
  maximumLossSequence: number;
  avgNetPnlAfterOneLossMinor: RatioOrUndefined;
  avgNetPnlAfterTwoLossesMinor: RatioOrUndefined;
  avgNetPnlAfterThreePlusLossesMinor: RatioOrUndefined;
  avgSameDayTradeCount: RatioOrUndefined;
  dataQuality: IntelligenceDataQuality;
};

export type SegmentPerformanceMetrics = {
  sampleSize: number;
  netPnlMinor: number;
  winRate: RatioOrUndefined;
  expectancyPerTradeMinor: RatioOrUndefined;
  profitFactor: RatioOrUndefined;
};

export type SegmentMetric = {
  segmentType: string;
  segmentKey: string;
  sampleSize: number;
  eligibleSampleSize: number;
  metrics: SegmentPerformanceMetrics;
  dataQuality: IntelligenceDataQuality;
};

export type DeterministicFinding = {
  id: string;
  findingSpecVersion: string;
  category:
    | "performance"
    | "risk"
    | "sequence"
    | "time"
    | "instrument"
    | "data_quality";
  polarity: "positive" | "negative" | "neutral";
  metricKey: string;
  sampleSize: number;
  evidence: {
    baselineValue?: number;
    segmentValue?: number;
    difference?: number;
    tradeIdsHash?: string;
  };
  reasonCode: string;
};

export type PerformanceIntelligenceSnapshot = {
  id: string;
  userId: string;
  accountId: string;
  challengeId?: string;
  assignmentRevision: number;
  inputRevision: string;
  metricSpecVersion: string;
  engineVersion: string;
  scope: IntelligenceScope;
  status: IntelligenceSnapshotStatus;
  datasetSummary: DatasetSummary;
  performance: PerformanceMetrics;
  risk: RiskMetrics;
  sequences: SequenceMetrics;
  segments: SegmentMetric[];
  findings: DeterministicFinding[];
  calculatedAt: string;
  sourceRange: {
    earliestTradeAt: string | null;
    latestTradeAt: string | null;
  };
  schemaVersion: string;
};

export type IntelligenceCalcState =
  | { kind: "not_required" }
  | { kind: "queued"; assignmentRevision: number; scopeKey: string }
  | { kind: "running"; assignmentRevision: number; scopeKey: string }
  | {
      kind: "completed";
      assignmentRevision: number;
      scopeKey: string;
      snapshotId: string;
    }
  | {
      kind: "failed";
      assignmentRevision: number;
      scopeKey: string;
      reasonCode: string;
    };

export type RawJournalTradeFact = {
  journalTradeId: string | null;
  tradeClientId: string;
  userId: string;
  symbol: string;
  direction: string;
  pnlMajor: number | null;
  feesMajor?: number | null;
  contracts?: number | null;
  occurredAtUtc: string | null;
  exitTime?: string | null;
  entryTime?: string | null;
  open?: boolean;
  deletedAt?: string | null;
  voided?: boolean;
  riskAmountMajor?: number | null;
  rMultiple?: number | null;
  assignmentRevision: number;
  accountId?: string | null;
  challengeId?: string | null;
  /** When true and account scope excludes archived challenges, trade is omitted. */
  challengeArchived?: boolean;
};
