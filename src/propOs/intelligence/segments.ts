/**
 * Deterministic segmentation (UTC weekday + session buckets).
 */

import { METRIC_CATALOGUE } from "./metricSpec";
import { calculatePerformanceMetrics } from "./metrics";
import type {
  IntelligenceDataQuality,
  PerformanceTradeInput,
  SegmentMetric,
} from "./types";
import { PI_MIN_SEGMENT_SAMPLE } from "./types";

function utcWeekday(iso: string): string {
  const d = new Date(iso);
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getUTCDay()]!;
}

function utcSessionBucket(iso: string): string {
  const h = new Date(iso).getUTCHours();
  const b = METRIC_CATALOGUE.timeBucketsUtc;
  if (h >= b.asia.startHourInclusive && h < b.asia.endHourExclusive) return "asia";
  if (h >= b.london.startHourInclusive && h < b.london.endHourExclusive) return "london";
  if (h >= b.new_york.startHourInclusive && h < b.new_york.endHourExclusive) {
    return "new_york";
  }
  return "off_hours";
}

function segmentOf(
  type: string,
  key: string,
  rows: PerformanceTradeInput[],
): SegmentMetric {
  const perf = calculatePerformanceMetrics(rows);
  const eligible = rows.length;
  const dq: IntelligenceDataQuality =
    eligible < PI_MIN_SEGMENT_SAMPLE
      ? {
          kind: "insufficient_sample",
          required: PI_MIN_SEGMENT_SAMPLE,
          actual: eligible,
        }
      : { kind: "complete" };
  return {
    segmentType: type,
    segmentKey: key,
    sampleSize: rows.length,
    eligibleSampleSize: eligible,
    metrics: {
      sampleSize: rows.length,
      netPnlMinor: perf.netRealizedPnlMinor,
      winRate: perf.winRate,
      expectancyPerTradeMinor: perf.expectancyPerTradeMinor,
      profitFactor: perf.profitFactor,
    },
    dataQuality: dq,
  };
}

function group(
  trades: PerformanceTradeInput[],
  type: string,
  keyFn: (t: PerformanceTradeInput) => string,
): SegmentMetric[] {
  const map = new Map<string, PerformanceTradeInput[]>();
  for (const t of trades) {
    const k = keyFn(t);
    const arr = map.get(k) ?? [];
    arr.push(t);
    map.set(k, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, rows]) => segmentOf(type, k, rows));
}

function riskBucket(minor: number): string {
  if (minor < 5_000) return "low";
  if (minor < 20_000) return "mid";
  return "high";
}

export function calculateSegments(trades: PerformanceTradeInput[]): SegmentMetric[] {
  const withRisk = trades.filter((t) => t.riskAmountMinor != null);
  const all = [
    ...group(trades, "instrument", (t) => t.instrument),
    ...group(trades, "direction", (t) => t.direction),
    ...group(trades, "weekday_utc", (t) => utcWeekday(t.occurredAtUtc)),
    ...group(trades, "session_utc", (t) => utcSessionBucket(t.occurredAtUtc)),
    ...group(trades, "outcome", (t) =>
      t.netPnlMinor > 0 ? "win" : t.netPnlMinor < 0 ? "loss" : "break_even",
    ),
    ...(withRisk.length
      ? group(withRisk, "risk_bucket", (t) => riskBucket(t.riskAmountMinor!))
      : []),
  ];
  // Deterministic cap: keep highest sampleSize then key
  return [...all]
    .sort((a, b) => {
      if (b.sampleSize !== a.sampleSize) return b.sampleSize - a.sampleSize;
      const ak = `${a.segmentType}:${a.segmentKey}`;
      const bk = `${b.segmentType}:${b.segmentKey}`;
      return ak < bk ? -1 : ak > bk ? 1 : 0;
    })
    .slice(0, 64);
}
