/**
 * Deterministic Prop Pass risk-mode planner.
 * Percents apply to remaining objective / session risk budget — never full deposit.
 * All outputs are hard-capped by daily loss, drawdown, and remaining safe room.
 */

export type PropPassAccountContext = "challenge" | "live";
export type PropPassRiskModeId = "calm" | "balanced" | "gambler";

export type PropPassRiskModeInput = {
  context: PropPassAccountContext;
  mode: PropPassRiskModeId;
  accountSizeMinor: number | null;
  currentEquityMinor: number | null;
  profitTargetMinor: number | null;
  profitRemainingMinor: number | null;
  dailyLossLimitMinor: number | null;
  dailyLossRemainingMinor: number | null;
  maxDrawdownLimitMinor: number | null;
  maxDrawdownRemainingMinor: number | null;
  /** Optional instrument stop distance in price points. */
  stopSizePoints: number | null;
  /** Optional $ per point per contract. */
  pointValue: number | null;
  /** Optional user hard risk cap per trade (minor). */
  userMaxRiskPerTradeMinor: number | null;
  realizedPnlTodayMinor: number | null;
  winRate: number | null;
  avgWinR: number | null;
};

export type PropPassRiskPace = "too_slow" | "on_pace" | "too_aggressive";

export type PropPassRiskModePlan = {
  mode: PropPassRiskModeId;
  context: PropPassAccountContext;
  missingInputs: string[];
  /** When missing inputs block a safe plan. */
  ready: boolean;
  sessionRiskBudgetMinor: number | null;
  remainingObjectiveMinor: number | null;
  riskBandMinPct: number;
  riskBandMaxPct: number;
  maxRiskPerTradeMinor: number | null;
  maxRiskTodayMinor: number | null;
  maxContracts: number | null;
  maxTradesToday: number | null;
  stopAfterLosses: number | null;
  estimatedWinsToTarget: number | null;
  estimatedSessionsRemaining: number | null;
  dailyLossRoomUsagePct: number | null;
  drawdownSafety: "ok" | "warn" | "hard" | "unknown";
  pace: PropPassPace | null;
  suggestedAction: string | null;
  /** Gambler: account-loss consequence before activation. */
  gamblerConsequenceMinor: number | null;
  requiresGamblerConfirm: boolean;
};

type PropPassPace = PropPassRiskPace;

const MODE_BANDS: Record<PropPassRiskModeId, { min: number; max: number }> = {
  calm: { min: 0, max: 0.25 },
  balanced: { min: 0.15, max: 0.3 },
  gambler: { min: 0.25, max: 1 },
};

function finiteNonNeg(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function minPositive(values: Array<number | null | undefined>): number | null {
  const nums = values.filter(finiteNonNeg) as number[];
  if (!nums.length) return null;
  return Math.min(...nums);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Build a deterministic risk plan. Never invent missing hard limits.
 */
export function buildPropPassRiskModePlan(input: PropPassRiskModeInput): PropPassRiskModePlan {
  const band = MODE_BANDS[input.mode];
  const missing: string[] = [];

  if (!finiteNonNeg(input.dailyLossLimitMinor) && !finiteNonNeg(input.dailyLossRemainingMinor)) {
    missing.push("daily_loss_limit");
  }
  if (!finiteNonNeg(input.maxDrawdownLimitMinor) && !finiteNonNeg(input.maxDrawdownRemainingMinor)) {
    missing.push("max_drawdown");
  }
  if (input.context === "challenge") {
    if (!finiteNonNeg(input.profitRemainingMinor) && !finiteNonNeg(input.profitTargetMinor)) {
      missing.push("profit_target");
    }
  }

  const dailyRoom =
    finiteNonNeg(input.dailyLossRemainingMinor)
      ? input.dailyLossRemainingMinor
      : finiteNonNeg(input.dailyLossLimitMinor)
        ? input.dailyLossLimitMinor
        : null;
  const ddRoom =
    finiteNonNeg(input.maxDrawdownRemainingMinor)
      ? input.maxDrawdownRemainingMinor
      : finiteNonNeg(input.maxDrawdownLimitMinor)
        ? input.maxDrawdownLimitMinor
        : null;

  const remainingObjective =
    finiteNonNeg(input.profitRemainingMinor)
      ? input.profitRemainingMinor
      : finiteNonNeg(input.profitTargetMinor)
        ? input.profitTargetMinor
        : null;

  // Session budget = min(daily room, drawdown room, remaining objective for challenge).
  const sessionBudget = minPositive([
    dailyRoom,
    ddRoom,
    input.context === "challenge" ? remainingObjective : null,
    // Live prioritizes capital preservation: also cap vs a small slice of equity when known.
    input.context === "live" && finiteNonNeg(input.currentEquityMinor)
      ? Math.round(input.currentEquityMinor * 0.02)
      : null,
  ]);

  const hardCap = minPositive([dailyRoom, ddRoom, input.userMaxRiskPerTradeMinor]);

  const empty: PropPassRiskModePlan = {
    mode: input.mode,
    context: input.context,
    missingInputs: missing,
    ready: false,
    sessionRiskBudgetMinor: sessionBudget,
    remainingObjectiveMinor: remainingObjective,
    riskBandMinPct: band.min,
    riskBandMaxPct: band.max,
    maxRiskPerTradeMinor: null,
    maxRiskTodayMinor: null,
    maxContracts: null,
    maxTradesToday: null,
    stopAfterLosses: null,
    estimatedWinsToTarget: null,
    estimatedSessionsRemaining: null,
    dailyLossRoomUsagePct: null,
    drawdownSafety: "unknown",
    pace: null,
    suggestedAction: null,
    gamblerConsequenceMinor: null,
    requiresGamblerConfirm: input.mode === "gambler",
  };

  if (missing.length || sessionBudget == null || hardCap == null || sessionBudget <= 0) {
    return {
      ...empty,
      suggestedAction: missing.length
        ? `Provide: ${missing.join(", ")}`
        : "Cannot plan without a positive session risk budget.",
    };
  }

  // Target risk uses mid of band for calm/balanced; gambler uses upper band but still hard-capped.
  const targetPct =
    input.mode === "calm" ? 0.125 : input.mode === "balanced" ? 0.225 : 0.55;
  let riskPerTrade = Math.round(sessionBudget * targetPct);
  riskPerTrade = Math.min(riskPerTrade, hardCap, sessionBudget);
  riskPerTrade = Math.max(0, riskPerTrade);

  const maxRiskToday = Math.min(sessionBudget, hardCap);

  let maxContracts: number | null = null;
  if (
    finiteNonNeg(input.stopSizePoints) &&
    input.stopSizePoints > 0 &&
    finiteNonNeg(input.pointValue) &&
    input.pointValue > 0 &&
    riskPerTrade > 0
  ) {
    const riskPerContract = Math.round(input.stopSizePoints * input.pointValue * 100); // minor
    if (riskPerContract > 0) {
      maxContracts = Math.max(1, Math.floor(riskPerTrade / riskPerContract));
    }
  }

  const stopAfterLosses =
    input.mode === "calm" ? 2 : input.mode === "balanced" ? 2 : 1;

  const maxTradesToday =
    input.mode === "calm" ? 2 : input.mode === "balanced" ? 3 : Math.max(1, stopAfterLosses + 1);

  let estimatedWinsToTarget: number | null = null;
  if (remainingObjective != null && riskPerTrade > 0) {
    const rMultiple =
      finiteNonNeg(input.avgWinR) && input.avgWinR > 0 ? input.avgWinR : 1;
    const winSize = Math.max(1, Math.round(riskPerTrade * rMultiple));
    estimatedWinsToTarget = Math.max(1, Math.ceil(remainingObjective / winSize));
  }

  let estimatedSessionsRemaining: number | null = null;
  if (estimatedWinsToTarget != null) {
    const winsPerSession =
      input.mode === "calm" ? 1 : input.mode === "balanced" ? 1.5 : 2;
    estimatedSessionsRemaining = Math.max(1, Math.ceil(estimatedWinsToTarget / winsPerSession));
  }

  let dailyLossRoomUsagePct: number | null = null;
  if (finiteNonNeg(input.dailyLossLimitMinor) && input.dailyLossLimitMinor > 0) {
    const used =
      finiteNonNeg(input.realizedPnlTodayMinor) && input.realizedPnlTodayMinor < 0
        ? Math.abs(input.realizedPnlTodayMinor)
        : finiteNonNeg(input.dailyLossRemainingMinor)
          ? input.dailyLossLimitMinor - input.dailyLossRemainingMinor
          : 0;
    dailyLossRoomUsagePct = clamp(used / input.dailyLossLimitMinor, 0, 1);
  }

  let drawdownSafety: PropPassRiskModePlan["drawdownSafety"] = "unknown";
  if (finiteNonNeg(input.maxDrawdownLimitMinor) && input.maxDrawdownLimitMinor > 0) {
    const rem = finiteNonNeg(ddRoom) ? ddRoom : input.maxDrawdownLimitMinor;
    const ratio = rem / input.maxDrawdownLimitMinor;
    drawdownSafety = ratio >= 0.55 ? "ok" : ratio >= 0.25 ? "warn" : "hard";
  }

  let pace: PropPassPace | null = null;
  if (estimatedSessionsRemaining != null && remainingObjective != null) {
    if (input.mode === "gambler" || (maxTradesToday != null && maxTradesToday >= 4)) {
      pace = "too_aggressive";
    } else if (input.mode === "calm" && estimatedSessionsRemaining > 20) {
      pace = "too_slow";
    } else {
      pace = "on_pace";
    }
  }

  const suggestedAction =
    input.mode === "calm"
      ? "Take at most one A+ setup; preserve daily loss room."
      : input.mode === "balanced"
        ? "Risk the planned amount only on confirmed setups; stop after two losses."
        : "High-risk mode: one defined risk unit only; stop after first loss.";

  const gamblerConsequenceMinor =
    input.mode === "gambler" ? Math.min(maxRiskToday, riskPerTrade * (stopAfterLosses + 1)) : null;

  // Final hard assert: never exceed daily or drawdown rooms.
  const cappedRisk = Math.min(riskPerTrade, dailyRoom ?? riskPerTrade, ddRoom ?? riskPerTrade);

  return {
    mode: input.mode,
    context: input.context,
    missingInputs: [],
    ready: true,
    sessionRiskBudgetMinor: sessionBudget,
    remainingObjectiveMinor: remainingObjective,
    riskBandMinPct: band.min,
    riskBandMaxPct: band.max,
    maxRiskPerTradeMinor: cappedRisk,
    maxRiskTodayMinor: Math.min(maxRiskToday, dailyRoom ?? maxRiskToday, ddRoom ?? maxRiskToday),
    maxContracts,
    maxTradesToday,
    stopAfterLosses,
    estimatedWinsToTarget,
    estimatedSessionsRemaining,
    dailyLossRoomUsagePct,
    drawdownSafety,
    pace,
    suggestedAction,
    gamblerConsequenceMinor,
    requiresGamblerConfirm: input.mode === "gambler",
  };
}

/** True when plan risk never exceeds daily/drawdown rooms. */
export function planRespectsHardLossLimits(plan: PropPassRiskModePlan): boolean {
  if (!plan.ready) return true;
  if (plan.maxRiskPerTradeMinor == null || plan.maxRiskTodayMinor == null) return false;
  if (plan.sessionRiskBudgetMinor == null) return false;
  return (
    plan.maxRiskPerTradeMinor <= plan.sessionRiskBudgetMinor &&
    plan.maxRiskTodayMinor <= plan.sessionRiskBudgetMinor &&
    plan.maxRiskPerTradeMinor <= plan.maxRiskTodayMinor
  );
}
