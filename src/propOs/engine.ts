import { confidenceForRuleBuffers, confidenceFromTradeCount } from "./confidence";
import { inputRevision, sortAccountingEvents } from "./eventOrder";
import { buildScoreDeltaDrivers, type ReadinessFactorMap } from "./scoreDrivers";
import { tradingDayId } from "./tradingDay";
import type {
  AccountingEvent,
  BufferSlice,
  ChallengeLifecycleStatus,
  MoneyMinor,
  PropChallengeFixture,
  PropEngineResultV0,
  PropRuleSetSnapshot,
} from "./types";

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function tanh(x: number): number {
  const e = Math.exp(2 * x);
  return (e - 1) / (e + 1);
}

type CloseFill = Extract<AccountingEvent, { kind: "fill_close" }>;

function netPnl(ev: CloseFill, limitations: string[]): MoneyMinor | null {
  if (ev.realizedPnlMinor == null) {
    limitations.push("pnl_missing");
    return null;
  }
  if (ev.feesMinor == null) {
    limitations.push("fees_missing");
    return ev.realizedPnlMinor;
  }
  return ev.realizedPnlMinor - ev.feesMinor;
}

export type EngineInput = {
  challenge: PropChallengeFixture;
  events: AccountingEvent[];
  asOfUtc: string;
  previousReadinessScore?: number | null;
  /** Previous readiness factor snapshot required for causal score-delta drivers. */
  previousReadinessFactors?: ReadinessFactorMap | null;
};

/**
 * Prop OS production calculation engine (calc-spec-v0).
 * Pure domain: no Supabase / React / AI / RevenueCat / storage.
 * Deterministic for fixed inputs + asOfUtc (calculatedAt does not alter math).
 */
export function calculateChallenge(input: EngineInput): PropEngineResultV0 {
  const { challenge } = input;
  const rules: PropRuleSetSnapshot = challenge.ruleSetSnapshot;
  const limitations: string[] = [];
  const breachReasons: { code: string; at: string; tradeId?: string }[] = [
    ...(challenge.breachReasons ?? []),
  ];

  let lifecycle: ChallengeLifecycleStatus = challenge.status;
  if (challenge.breachLocked || lifecycle === "breached") {
    lifecycle = "breached";
  }

  const sortedAll = sortAccountingEvents(input.events).filter((e) => {
    if (!("occurredAtUtc" in e)) return true;
    return e.occurredAtUtc <= input.asOfUtc;
  });

  // Dedupe by id (keep first in canonical order)
  const sorted: AccountingEvent[] = [];
  const seenIds = new Set<string>();
  for (const e of sortedAll) {
    if (seenIds.has(e.id)) {
      limitations.push("duplicate_ignored");
      continue;
    }
    seenIds.add(e.id);
    sorted.push(e);
  }

  const voided = new Set<string>();
  for (const e of sorted) {
    if (e.kind === "fill_close" && e.voided) voided.add(e.id);
    if (e.kind === "fill_close" && e.correctsEventId) voided.add(e.correctsEventId);
    if (e.kind === "official_correction" && e.clearsBreach && e.challengeId === challenge.id) {
      lifecycle = "active";
      breachReasons.length = 0;
      limitations.push("official_correction_applied");
    }
    if (e.kind === "challenge_reset" && e.challengeId === challenge.id) {
      lifecycle = "reset";
    }
  }

  let equity: MoneyMinor = challenge.startingBalanceMinor;
  let hwm: MoneyMinor = challenge.startingBalanceMinor;
  let eodHwm: MoneyMinor = challenge.startingBalanceMinor;
  let dayPnl: MoneyMinor = 0;
  let currentDay = tradingDayId(
    challenge.startedAtUtc,
    rules.firmTimezone,
    rules.tradingDayRolloverHour,
  );
  let tradeCount = 0;
  let feesMissing = false;
  let equitySource: PropEngineResultV0["accountState"]["equitySource"] = "trade_only";
  let sawEquityMark = false;
  const dayPnls = new Map<string, MoneyMinor>();
  const rSamples: number[] = [];
  const dd = rules.drawdown.amountMinor;

  const floorNow = (): MoneyMinor => {
    if (rules.drawdown.kind === "static") return challenge.startingBalanceMinor - dd;
    if (rules.drawdown.kind === "trailingEndOfDay") return eodHwm - dd;
    return hwm - dd;
  };

  const maybeBreach = (code: string, at: string, tradeId?: string) => {
    if (lifecycle === "passed" || lifecycle === "funded" || lifecycle === "reset") return;
    if (lifecycle === "breached") return;
    breachReasons.push({ code, at, tradeId });
    lifecycle = "breached";
  };

  for (const ev of sorted) {
    if (ev.kind === "fill_close") {
      if (voided.has(ev.id)) continue;
      if (ev.challengeId !== challenge.id) continue;

      const day = tradingDayId(ev.occurredAtUtc, rules.firmTimezone, rules.tradingDayRolloverHour);
      if (day !== currentDay) {
        if (rules.drawdown.kind === "trailingEndOfDay") eodHwm = hwm;
        currentDay = day;
        dayPnl = dayPnls.get(day) ?? 0;
      }

      const pnl = netPnl(ev, limitations);
      if (pnl == null) continue;
      if (ev.feesMinor == null) feesMissing = true;

      equity += pnl;
      dayPnl += pnl;
      dayPnls.set(day, dayPnl);
      tradeCount += 1;
      if (equity > hwm) hwm = equity;
      rSamples.push(pnl / 10_000);

      if (rules.dailyLossLimitMinor != null && rules.dailyLossBasis === "realized_only") {
        const remainingDaily = rules.dailyLossLimitMinor + Math.min(dayPnl, 0);
        if (remainingDaily <= 0) maybeBreach("daily_loss", ev.occurredAtUtc, ev.id);
      }

      if (rules.dailyLossBasis === "realized_plus_unrealized" && !sawEquityMark) {
        limitations.push("unrealized_basis_without_equity_stream");
      }

      if (equity <= floorNow()) {
        maybeBreach(
          rules.drawdown.kind === "static" ? "static_drawdown" : "trailing_drawdown",
          ev.occurredAtUtc,
          ev.id,
        );
      }

      if (
        rules.drawdown.stopTrailingAfterTarget &&
        equity >= challenge.startingBalanceMinor + rules.profitTargetMinor
      ) {
        eodHwm = Math.max(eodHwm, hwm);
      }
    }

    if (ev.kind === "equity_mark" && ev.challengeId === challenge.id) {
      sawEquityMark = true;
      equitySource = "equity_stream";
      equity = ev.equityMinor;
      if (equity > hwm) hwm = equity;
      if (rules.drawdown.kind === "trailingIntraday" && equity <= hwm - dd) {
        maybeBreach("trailing_drawdown", ev.occurredAtUtc);
      }
    }

    if (ev.kind === "day_boundary" && ev.challengeId === challenge.id) {
      if (rules.drawdown.kind === "trailingEndOfDay") eodHwm = hwm;
      currentDay = ev.tradingDayId;
      dayPnl = dayPnls.get(currentDay) ?? 0;
    }
  }

  if (rules.drawdown.kind === "trailingIntraday") {
    if (rules.intradayRequiresEquityStream && !sawEquityMark) {
      equitySource = "incomplete";
      limitations.push("intraday_equity_stream_missing");
      limitations.push("trade_only_approximation");
    } else if (!sawEquityMark) {
      limitations.push("trade_only_approximation");
    }
  }

  if (feesMissing) limitations.push("fees_incomplete");
  limitations.push("unrealized_excluded");
  const uniqLim = [...new Set(limitations)];

  const asOfDay = tradingDayId(input.asOfUtc, rules.firmTimezone, rules.tradingDayRolloverHour);
  dayPnl = dayPnls.get(asOfDay) ?? dayPnl;

  const floorMinor = floorNow();
  const remainingDd = equity - floorMinor;
  const dailyLimit = rules.dailyLossLimitMinor ?? null;
  const remainingDaily = dailyLimit == null ? null : dailyLimit + Math.min(dayPnl, 0);
  const progress = Math.max(0, equity - challenge.startingBalanceMinor);
  const remainingTarget = Math.max(0, rules.profitTargetMinor - progress);

  const buffers: BufferSlice[] = [
    {
      id: "daily_loss",
      remainingMinor: remainingDaily,
      limitMinor: dailyLimit,
      status:
        remainingDaily == null
          ? "ok"
          : remainingDaily <= 0
            ? "hard"
            : remainingDaily < dailyLimit! * 0.35
              ? "warn"
              : "ok",
      limitations: [],
    },
    {
      id: "drawdown",
      remainingMinor: remainingDd,
      limitMinor: dd,
      status: remainingDd <= 0 ? "hard" : remainingDd < dd * 0.35 ? "warn" : "ok",
      limitations: equitySource === "incomplete" ? ["intraday_incomplete"] : [],
    },
    {
      id: "target_distance",
      remainingMinor: remainingTarget,
      limitMinor: rules.profitTargetMinor,
      status: "ok",
      limitations: [],
    },
  ];

  if (lifecycle === "active" || lifecycle === "at_risk") {
    if (buffers.some((b) => b.status === "warn")) lifecycle = "at_risk";
  }

  const daysTraded = dayPnls.size;
  const minDays = rules.minimumTradingDays ?? 0;
  if (
    lifecycle !== "breached" &&
    lifecycle !== "reset" &&
    progress >= rules.profitTargetMinor &&
    daysTraded >= minDays
  ) {
    lifecycle = challenge.phase === "funded" ? "funded" : "passed";
  }

  const conf = confidenceForRuleBuffers({
    sampleSize: tradeCount,
    stateComplete: equitySource !== "incomplete",
    limitations: uniqLim.filter(
      (l) => l === "fees_incomplete" || l === "intraday_equity_stream_missing",
    ),
  });

  const gate = (() => {
    if (lifecycle === "breached") return "breached";
    if (lifecycle === "passed" || lifecycle === "funded") return "terminal_success";
    if (lifecycle === "reset" || lifecycle === "abandoned") return "terminal_inactive";
    if (
      equitySource === "incomplete" &&
      rules.drawdown.kind === "trailingIntraday" &&
      rules.intradayRequiresEquityStream
    ) {
      return "unsupported_rule_calculation";
    }
    if (tradeCount < 5) return "insufficient_trade_data";
    return null;
  })();

  let readiness: PropEngineResultV0["readiness"] = null;
  let readinessModel: PropEngineResultV0["readinessModelVersion"] = null;

  if (!gate && (lifecycle === "active" || lifecycle === "at_risk")) {
    readinessModel = "readiness-v0";
    const targetProgress = clamp01(progress / Math.max(1, rules.profitTargetMinor));
    const dailyBufferHealth =
      dailyLimit == null ? 1 : clamp01((remainingDaily ?? 0) / Math.max(1, dailyLimit));
    const ddBufferHealth = clamp01(remainingDd / Math.max(1, dd));
    const minDaysProgress = minDays <= 0 ? 1 : clamp01(daysTraded / minDays);
    const exp =
      rSamples.length === 0
        ? 0.5
        : 0.5 + 0.5 * tanh(rSamples.reduce((a, b) => a + b, 0) / rSamples.length / 0.5);
    const sampleAdequacy = clamp01(tradeCount / 50);

    const inputs: ReadinessFactorMap = {
      targetProgress: { value: targetProgress, weight: 0.25 },
      dailyBufferHealth: { value: dailyBufferHealth, weight: 0.2 },
      ddBufferHealth: { value: ddBufferHealth, weight: 0.25 },
      minDaysProgress: { value: minDaysProgress, weight: 0.1 },
      expectancyProxy: { value: clamp01(exp), weight: 0.1 },
      sampleAdequacy: { value: sampleAdequacy, weight: 0.1 },
    };

    let raw = 0;
    for (const v of Object.values(inputs)) raw += v.weight * v.value;
    const score = Math.floor(100 * raw);
    const previous = input.previousReadinessScore ?? null;
    const delta = previous == null ? null : score - previous;
    const confScore = confidenceFromTradeCount(tradeCount, feesMissing ? ["fees_incomplete"] : []);
    const built = buildScoreDeltaDrivers({
      currentFactors: inputs,
      previousFactors: input.previousReadinessFactors,
      currentScore: score,
      previousScore: previous,
      confidence: confScore,
    });

    readiness = {
      score,
      previousScore: previous,
      delta,
      drivers: built.drivers,
      supportingEvidence: built.supportingEvidence,
      driversReconciled: built.reconciled,
      confidence: confScore,
    };
  } else if (gate === "insufficient_trade_data") {
    readinessModel = "readiness-v0";
    readiness = {
      score: 0,
      previousScore: input.previousReadinessScore ?? null,
      delta: null,
      drivers: [],
      supportingEvidence: [],
      confidence: confidenceFromTradeCount(tradeCount, ["insufficient_trade_data"]),
      gate,
    };
  } else if (gate === "unsupported_rule_calculation") {
    readinessModel = null;
    readiness = {
      score: 0,
      previousScore: input.previousReadinessScore ?? null,
      delta: null,
      drivers: [],
      supportingEvidence: [],
      confidence: confidenceFromTradeCount(tradeCount, ["unsupported_rule_calculation"]),
      gate,
    };
  }

  const withhold =
    gate === "breached" ||
    gate === "terminal_success" ||
    gate === "terminal_inactive";

  const publicReadiness = withhold ? null : readiness;

  return {
    calculationVersion: "calc-spec-v0",
    ruleSetVersion: rules.version,
    inputRevision: inputRevision(sorted),
    calculatedAt: input.asOfUtc,
    bufferModelVersion: "buffer-v0",
    readinessModelVersion: publicReadiness ? readinessModel : null,
    confidencePolicyVersion: "confidence-policy-v0",
    dailyLossPolicyVersion: "daily-loss-v0",
    dailyLossBasis: rules.dailyLossBasis,
    challengeId: challenge.id,
    status: lifecycle,
    breachReasons,
    accountState: {
      equityMinor: equity,
      startingBalanceMinor: challenge.startingBalanceMinor,
      hwmMinor: hwm,
      drawdownFloorMinor: floorMinor,
      tradingDayId: asOfDay,
      dayPnlMinor: dayPnl,
      equitySource,
    },
    buffers,
    readiness: publicReadiness,
    confidence: conf,
    evidence: [{ ...conf, metricId: "equity", value: equity }],
    limitations: uniqLim,
  };
}

export function publicReadinessScore(result: PropEngineResultV0): number | null {
  if (result.status === "breached") return null;
  if (result.status === "passed" || result.status === "funded") return null;
  if (result.status === "reset" || result.status === "abandoned") return null;
  if (!result.readiness) return null;
  if (result.readiness.gate === "insufficient_trade_data") return null;
  if (result.readiness.gate === "unsupported_rule_calculation") return null;
  return result.readiness.score;
}
