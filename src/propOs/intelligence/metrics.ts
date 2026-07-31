/**
 * Core / risk / sequence metric calculations.
 * Money: integer minor units. Ratios: integer scaled (PI_RATIO_SCALE).
 */

import {
  normalizeNegZeroScaled,
  ratioScaled,
  roundHalfAwayFromZero,
  scaledToNumber,
} from "./precision";
import type {
  PerformanceMetrics,
  PerformanceTradeInput,
  RatioOrUndefined,
  RiskMetrics,
  SequenceMetrics,
} from "./types";

function ratio(
  num: number,
  den: number,
  zeroKind: RatioOrUndefined["kind"],
): RatioOrUndefined {
  if (den === 0) {
    if (zeroKind === "undefined_zero_loss") return { kind: "undefined_zero_loss" };
    if (zeroKind === "undefined_zero_profit") return { kind: "undefined_zero_profit" };
    return { kind: "undefined_zero_denominator" };
  }
  return {
    kind: "value",
    valueScaled: normalizeNegZeroScaled(ratioScaled(num, den)),
  };
}

function medianScaled(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid]!;
  // mean of two middle via integer (for money) or scaled average
  return roundHalfAwayFromZero((s[mid - 1]! + s[mid]!) / 2);
}

function stdev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const v = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

export function calculatePerformanceMetrics(
  trades: PerformanceTradeInput[],
): PerformanceMetrics {
  const wins = trades.filter((t) => t.netPnlMinor > 0);
  const losses = trades.filter((t) => t.netPnlMinor < 0);
  const be = trades.filter((t) => t.netPnlMinor === 0);
  const net = trades.reduce((a, t) => a + t.netPnlMinor, 0);
  const grossProfit = wins.reduce((a, t) => a + t.netPnlMinor, 0);
  const grossLoss = losses.reduce((a, t) => a + t.netPnlMinor, 0);
  const classified = wins.length + losses.length + be.length;
  const avgWin =
    wins.length === 0
      ? ({ kind: "undefined_zero_denominator" } as RatioOrUndefined)
      : {
          kind: "value" as const,
          valueScaled: normalizeNegZeroScaled(
            ratioScaled(grossProfit, wins.length),
          ),
        };
  const avgLoss =
    losses.length === 0
      ? ({ kind: "undefined_zero_denominator" } as RatioOrUndefined)
      : {
          kind: "value" as const,
          valueScaled: normalizeNegZeroScaled(
            ratioScaled(grossLoss, losses.length),
          ),
        };

  let payoff: RatioOrUndefined = { kind: "undefined_zero_denominator" };
  if (avgWin.kind === "value" && avgLoss.kind === "value" && avgLoss.valueScaled !== 0) {
    payoff = {
      kind: "value",
      valueScaled: normalizeNegZeroScaled(
        ratioScaled(Math.abs(avgWin.valueScaled), Math.abs(avgLoss.valueScaled)),
      ),
    };
  } else if (losses.length === 0 && wins.length > 0) {
    payoff = { kind: "undefined_zero_loss" };
  }

  return {
    totalClosedTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakEvenTrades: be.length,
    netRealizedPnlMinor: net,
    grossProfitMinor: grossProfit,
    grossLossMinor: grossLoss,
    winRate: ratio(wins.length, classified, "undefined_zero_denominator"),
    averageTradeMinor: ratio(net, trades.length, "undefined_zero_denominator"),
    averageWinMinor: avgWin,
    averageLossMinor: avgLoss,
    largestWinMinor: wins.length ? Math.max(...wins.map((t) => t.netPnlMinor)) : null,
    largestLossMinor: losses.length ? Math.min(...losses.map((t) => t.netPnlMinor)) : null,
    payoffRatio: payoff,
    profitFactor: ratio(grossProfit, Math.abs(grossLoss), "undefined_zero_loss"),
    expectancyPerTradeMinor: ratio(net, trades.length, "undefined_zero_denominator"),
  };
}

export function calculateRiskMetrics(trades: PerformanceTradeInput[]): RiskMetrics {
  const sizes = trades.map((t) => t.size).filter((x): x is number => x != null);
  const risks = trades
    .map((t) => t.riskAmountMinor)
    .filter((x): x is number => x != null);
  const rs = trades.map((t) => t.rMultiple).filter((x): x is number => x != null);
  const missing: string[] = [];
  if (sizes.length < trades.length) missing.push("size");
  if (risks.length < trades.length) missing.push("riskAmountMinor");
  if (rs.length < trades.length) missing.push("rMultiple");

  const perf = calculatePerformanceMetrics(trades);
  const largestWinShare =
    perf.largestWinMinor != null && perf.grossProfitMinor > 0
      ? ratio(perf.largestWinMinor, perf.grossProfitMinor, "undefined_zero_profit")
      : ({ kind: "unavailable", reasonCode: "no_gross_profit" } as RatioOrUndefined);
  const largestLossShare =
    perf.largestLossMinor != null && perf.grossLossMinor < 0
      ? ratio(
          Math.abs(perf.largestLossMinor),
          Math.abs(perf.grossLossMinor),
          "undefined_zero_loss",
        )
      : ({ kind: "unavailable", reasonCode: "no_gross_loss" } as RatioOrUndefined);

  const byInst = new Map<string, number>();
  for (const t of trades) {
    byInst.set(t.instrument, (byInst.get(t.instrument) ?? 0) + Math.abs(t.netPnlMinor));
  }
  const totalAbs = [...byInst.values()].reduce((a, b) => a + b, 0);
  const topShare =
    totalAbs === 0
      ? ({ kind: "undefined_zero_denominator" } as RatioOrUndefined)
      : ratio(Math.max(0, ...byInst.values()), totalAbs, "undefined_zero_denominator");

  const meanSize = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : null;
  const sdSize = stdev(sizes);
  const sizeCv =
    meanSize != null && meanSize !== 0 && sdSize != null
      ? ratio(sdSize, Math.abs(meanSize), "undefined_zero_denominator")
      : ({ kind: "unavailable", reasonCode: "insufficient_size_data" } as RatioOrUndefined);

  const meanRisk = risks.length ? risks.reduce((a, b) => a + b, 0) / risks.length : null;
  const sdRisk = stdev(risks);
  const riskCv =
    meanRisk != null && meanRisk !== 0 && sdRisk != null
      ? ratio(sdRisk, Math.abs(meanRisk), "undefined_zero_denominator")
      : ({ kind: "unavailable", reasonCode: "insufficient_risk_data" } as RatioOrUndefined);

  return {
    averagePositionSize: meanSize == null
      ? { kind: "unavailable", reasonCode: "missing_size" }
      : {
          kind: "value",
          valueScaled: normalizeNegZeroScaled(ratioScaled(meanSize, 1)),
        },
    medianPositionSize: (() => {
      const m = medianScaled(sizes);
      return m == null
        ? { kind: "unavailable" as const, reasonCode: "missing_size" }
        : {
            kind: "value" as const,
            valueScaled: normalizeNegZeroScaled(ratioScaled(m, 1)),
          };
    })(),
    positionSizeDispersion: sizeCv,
    averageRiskAmountMinor: meanRisk == null
      ? { kind: "unavailable", reasonCode: "missing_risk" }
      : {
          kind: "value",
          valueScaled: normalizeNegZeroScaled(
            ratioScaled(roundHalfAwayFromZero(meanRisk), 1),
          ),
        },
    maximumRiskAmountMinor: risks.length ? Math.max(...risks) : null,
    riskDispersion: riskCv,
    averageRMultiple: rs.length
      ? {
          kind: "value",
          valueScaled: normalizeNegZeroScaled(
            ratioScaled(rs.reduce((a, b) => a + b, 0), rs.length),
          ),
        }
      : { kind: "unavailable", reasonCode: "missing_r" },
    medianRMultiple: (() => {
      const m = medianScaled(rs);
      return m == null
        ? { kind: "unavailable" as const, reasonCode: "missing_r" }
        : {
            kind: "value" as const,
            valueScaled: normalizeNegZeroScaled(ratioScaled(m, 1)),
          };
    })(),
    bestRMultiple: rs.length ? Math.max(...rs) : null,
    worstRMultiple: rs.length ? Math.min(...rs) : null,
    largestWinShareOfProfit: largestWinShare,
    largestLossShareOfLoss: largestLossShare,
    topInstrumentConcentration: topShare,
    dataQuality:
      missing.length === 0
        ? { kind: "complete" }
        : { kind: "partial", missingFields: missing },
  };
}

export function calculateSequenceMetrics(
  trades: PerformanceTradeInput[],
): SequenceMetrics {
  const ordered = trades;
  let curWin = 0;
  let curLoss = 0;
  let maxWin = 0;
  let maxLoss = 0;
  let runWin = 0;
  let runLoss = 0;
  const after1: number[] = [];
  const after2: number[] = [];
  const after3: number[] = [];
  let lossStreak = 0;

  for (let i = 0; i < ordered.length; i++) {
    const t = ordered[i]!;
    if (t.netPnlMinor > 0) {
      runWin += 1;
      runLoss = 0;
      maxWin = Math.max(maxWin, runWin);
      if (lossStreak === 1) after1.push(t.netPnlMinor);
      if (lossStreak === 2) after2.push(t.netPnlMinor);
      if (lossStreak >= 3) after3.push(t.netPnlMinor);
      lossStreak = 0;
    } else if (t.netPnlMinor < 0) {
      runLoss += 1;
      runWin = 0;
      maxLoss = Math.max(maxLoss, runLoss);
      lossStreak += 1;
    } else {
      runWin = 0;
      runLoss = 0;
      lossStreak = 0;
    }
  }
  curWin = runWin;
  curLoss = runLoss;

  const byDay = new Map<string, number>();
  for (const t of ordered) {
    const day = t.occurredAtUtc.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const dayCounts = [...byDay.values()];
  const avgSameDay =
    dayCounts.length === 0
      ? ({ kind: "undefined_zero_denominator" } as RatioOrUndefined)
      : ratio(
          dayCounts.reduce((a, b) => a + b, 0),
          dayCounts.length,
          "undefined_zero_denominator",
        );

  const avg = (xs: number[]): RatioOrUndefined =>
    xs.length === 0
      ? { kind: "unavailable", reasonCode: "no_samples" }
      : ratio(xs.reduce((a, b) => a + b, 0), xs.length, "undefined_zero_denominator");

  return {
    currentWinSequence: curWin,
    currentLossSequence: curLoss,
    maximumWinSequence: maxWin,
    maximumLossSequence: maxLoss,
    avgNetPnlAfterOneLossMinor: avg(after1),
    avgNetPnlAfterTwoLossesMinor: avg(after2),
    avgNetPnlAfterThreePlusLossesMinor: avg(after3),
    avgSameDayTradeCount: avgSameDay,
    dataQuality: { kind: "complete" },
  };
}

/** Presentation helper — not used inside engine math. */
export function ratioDisplayValue(r: RatioOrUndefined): number | null {
  if (r.kind !== "value") return null;
  return scaledToNumber(r.valueScaled);
}
