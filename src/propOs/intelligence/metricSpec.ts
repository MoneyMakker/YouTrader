/**
 * Centralized Performance Intelligence metric specification (pi-metric-spec-v0).
 * Formulas live here — never in UI components.
 */

import {
  PI_FINDING_SPEC_VERSION,
  PI_MAX_SURFACED_FINDINGS,
  PI_METRIC_SPEC_VERSION,
  PI_MIN_SEGMENT_SAMPLE,
} from "./types";

export const METRIC_CATALOGUE = {
  version: PI_METRIC_SPEC_VERSION,
  moneyUnit: "minor_integer",
  rounding: "round_half_away_from_zero_at_output_only",
  winClassification: {
    win: "netPnlMinor > 0",
    loss: "netPnlMinor < 0",
    breakEven: "netPnlMinor === 0",
  },
  formulas: {
    winRate: {
      formula: "winningClosed / classifiedClosed",
      required: ["netPnlMinor"],
      zeroDenominator: "undefined_zero_denominator",
      precision: 6,
      minSample: 1,
    },
    profitFactor: {
      formula: "grossProfitMinor / abs(grossLossMinor)",
      required: ["netPnlMinor"],
      zeroDenominator: "undefined_zero_loss",
      precision: 6,
      minSample: 1,
    },
    payoffRatio: {
      formula: "abs(averageWinMinor) / abs(averageLossMinor)",
      required: ["netPnlMinor"],
      zeroDenominator: "undefined_zero_denominator",
      precision: 6,
      minSample: 1,
    },
    expectancyPerTrade: {
      formula: "netRealizedPnlMinor / totalClosedTrades",
      required: ["netPnlMinor"],
      zeroDenominator: "undefined_zero_denominator",
      precision: 0,
      minSample: 1,
    },
    averageTrade: {
      formula: "netRealizedPnlMinor / totalClosedTrades",
      required: ["netPnlMinor"],
      zeroDenominator: "undefined_zero_denominator",
      precision: 0,
      minSample: 1,
    },
  },
  inclusions: {
    closedOnly: true,
    openTrades: "excluded",
    voidedOrCancelled: "excluded",
    softDeleted: "excluded",
    malformedTimestamp: "excluded",
    missingPnl: "excluded",
    missingCanonicalIdentity: "excluded",
    depositsWithdrawals: "not_in_trade_dataset",
    balanceAdjustments: "not_in_trade_dataset",
    partialFills: "one_row_per_journal_trade_no_silent_merge",
    fees: "feesMinor subtracted into netPnlMinor; missing fees treated as 0 only when source provides null/undefined fee field on closed trade",
    zeroPnl: "counted as break-even",
    duplicateImports: "unique journalTradeId; duplicates excluded as integrity",
  },
  timeBucketsUtc: {
    policy: "all buckets computed in UTC; user-local labels are display-only",
    asia: { startHourInclusive: 0, endHourExclusive: 8 },
    london: { startHourInclusive: 8, endHourExclusive: 13 },
    new_york: { startHourInclusive: 13, endHourExclusive: 21 },
    off_hours: { startHourInclusive: 21, endHourExclusive: 24 },
    daylightSaving: "UTC buckets are DST-invariant by construction",
  },
  dateRange: {
    startUtc: "inclusive",
    endUtc: "exclusive",
  },
  accountScope: {
    includeArchivedChallengesDefault: false,
  },
  recentTrades: {
    ordering: "closedAtUtc DESC, journalTradeId DESC then reverse to chronological for sequences",
    counts: [20, 50, 100],
  },
  findings: {
    version: PI_FINDING_SPEC_VERSION,
    maxSurfaced: PI_MAX_SURFACED_FINDINGS,
    minSegmentSample: PI_MIN_SEGMENT_SAMPLE,
    minComparisonSample: 10,
    minAbsoluteExpectancyDiffMinor: 500,
    minRelativeExpectancyDiff: 0.25,
    positionSizeCvThreshold: 0.5,
    concentrationShareThreshold: 0.4,
    sameDayOvertradeThreshold: 4,
    orderingPriority: [
      "data_quality.insufficient_sample",
      "instrument.lower_expectancy",
      "risk.high_size_dispersion",
      "risk.profit_concentration",
      "sequence.after_loss_cluster",
      "time.same_day_overtrade",
    ],
  },
} as const;

export type MetricCatalogue = typeof METRIC_CATALOGUE;
