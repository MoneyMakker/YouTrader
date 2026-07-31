/**
 * Rule-based deterministic findings. Historical observations only — no causation.
 */

import { createHash } from "./hash";
import { METRIC_CATALOGUE } from "./metricSpec";
import type {
  DeterministicFinding,
  PerformanceMetrics,
  PerformanceTradeInput,
  RiskMetrics,
  SegmentMetric,
  SequenceMetrics,
} from "./types";
import { PI_FINDING_SPEC_VERSION, PI_MAX_SURFACED_FINDINGS } from "./types";

function expectancyValue(m: { kind: string; valueScaled?: number }): number | null {
  return m.kind === "value" && typeof m.valueScaled === "number" ? m.valueScaled : null;
}

export type FindingsResult = {
  surfaced: DeterministicFinding[];
  generated: number;
  suppressed: number;
};

export function evaluateFindings(input: {
  trades: PerformanceTradeInput[];
  performance: PerformanceMetrics;
  risk: RiskMetrics;
  sequences: SequenceMetrics;
  segments: SegmentMetric[];
}): FindingsResult {
  const f = METRIC_CATALOGUE.findings;
  const out: DeterministicFinding[] = [];
  const baseline = expectancyValue(input.performance.expectancyPerTradeMinor);
  const hash = createHash(input.trades.map((t) => t.journalTradeId).join(","));
  const absExpDiffScaled = f.minAbsoluteExpectancyDiffMinor; // already minor; compare on valueScaled of expectancy (minor*scale/1)

  if (input.trades.length < f.minSegmentSample) {
    out.push({
      id: `dq-insufficient:${hash.slice(0, 8)}`,
      findingSpecVersion: PI_FINDING_SPEC_VERSION,
      category: "data_quality",
      polarity: "neutral",
      metricKey: "sample_size",
      sampleSize: input.trades.length,
      evidence: { baselineValue: f.minSegmentSample, segmentValue: input.trades.length },
      reasonCode: "insufficient_sample",
    });
  }

  for (const seg of input.segments) {
    if (seg.segmentType !== "instrument") continue;
    if (seg.sampleSize < f.minSegmentSample) continue;
    if (input.trades.length < f.minComparisonSample) continue;
    const segExp = expectancyValue(seg.metrics.expectancyPerTradeMinor);
    if (baseline == null || segExp == null) continue;
    const diff = segExp - baseline;
    const rel = baseline === 0 ? Math.abs(diff) : Math.abs(diff / Math.abs(baseline));
    // expectancy valueScaled is net/trades * PI_RATIO_SCALE; compare abs minor via /scale
    const absDiffMinor = Math.abs(diff) / 1_000_000;
    if (
      diff < 0 &&
      absDiffMinor >= absExpDiffScaled &&
      rel >= f.minRelativeExpectancyDiff
    ) {
      out.push({
        id: `inst-low-exp:${seg.segmentKey}:${hash.slice(0, 8)}`,
        findingSpecVersion: PI_FINDING_SPEC_VERSION,
        category: "instrument",
        polarity: "negative",
        metricKey: "expectancyPerTradeMinor",
        sampleSize: seg.sampleSize,
        evidence: {
          baselineValue: baseline,
          segmentValue: segExp,
          difference: diff,
          tradeIdsHash: hash.slice(0, 16),
        },
        reasonCode: "instrument_lower_historical_expectancy",
      });
    }
  }

  if (
    input.risk.positionSizeDispersion.kind === "value" &&
    input.risk.positionSizeDispersion.valueScaled / 1_000_000 >= f.positionSizeCvThreshold &&
    input.trades.length >= f.minComparisonSample
  ) {
    out.push({
      id: `risk-size-cv:${hash.slice(0, 8)}`,
      findingSpecVersion: PI_FINDING_SPEC_VERSION,
      category: "risk",
      polarity: "negative",
      metricKey: "positionSizeDispersion",
      sampleSize: input.trades.length,
      evidence: {
        segmentValue: input.risk.positionSizeDispersion.valueScaled / 1_000_000,
        baselineValue: f.positionSizeCvThreshold,
      },
      reasonCode: "high_position_size_dispersion",
    });
  }

  if (
    input.risk.largestWinShareOfProfit.kind === "value" &&
    input.risk.largestWinShareOfProfit.valueScaled / 1_000_000 >=
      f.concentrationShareThreshold &&
    input.performance.winningTrades >= 2
  ) {
    out.push({
      id: `risk-conc:${hash.slice(0, 8)}`,
      findingSpecVersion: PI_FINDING_SPEC_VERSION,
      category: "risk",
      polarity: "neutral",
      metricKey: "largestWinShareOfProfit",
      sampleSize: input.performance.winningTrades,
      evidence: {
        segmentValue: input.risk.largestWinShareOfProfit.valueScaled / 1_000_000,
      },
      reasonCode: "profit_concentration_in_largest_win",
    });
  }

  if (
    input.sequences.avgSameDayTradeCount.kind === "value" &&
    input.sequences.avgSameDayTradeCount.valueScaled / 1_000_000 >=
      f.sameDayOvertradeThreshold &&
    input.trades.length >= f.minComparisonSample
  ) {
    out.push({
      id: `time-sameday:${hash.slice(0, 8)}`,
      findingSpecVersion: PI_FINDING_SPEC_VERSION,
      category: "time",
      polarity: "neutral",
      metricKey: "avgSameDayTradeCount",
      sampleSize: input.trades.length,
      evidence: {
        segmentValue: input.sequences.avgSameDayTradeCount.valueScaled / 1_000_000,
      },
      reasonCode: "elevated_same_day_trade_frequency",
    });
  }

  const rank = new Map<string, number>(f.orderingPriority.map((k, i) => [k, i]));
  out.sort((a, b) => {
    const ra =
      rank.get(
        a.reasonCode.includes("insufficient")
          ? "data_quality.insufficient_sample"
          : a.reasonCode.includes("instrument")
            ? "instrument.lower_expectancy"
            : a.reasonCode.includes("dispersion")
              ? "risk.high_size_dispersion"
              : a.reasonCode.includes("concentration")
                ? "risk.profit_concentration"
                : a.reasonCode.includes("same_day")
                  ? "time.same_day_overtrade"
                  : `${a.category}.${a.metricKey}`,
      ) ?? 99;
    const rb =
      rank.get(
        b.reasonCode.includes("insufficient")
          ? "data_quality.insufficient_sample"
          : b.reasonCode.includes("instrument")
            ? "instrument.lower_expectancy"
            : b.reasonCode.includes("dispersion")
              ? "risk.high_size_dispersion"
              : b.reasonCode.includes("concentration")
                ? "risk.profit_concentration"
                : b.reasonCode.includes("same_day")
                  ? "time.same_day_overtrade"
                  : `${b.category}.${b.metricKey}`,
      ) ?? 99;
    if (ra !== rb) return ra - rb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const surfaced = out.slice(0, PI_MAX_SURFACED_FINDINGS);
  return {
    surfaced,
    generated: out.length,
    suppressed: Math.max(0, out.length - surfaced.length),
  };
}
