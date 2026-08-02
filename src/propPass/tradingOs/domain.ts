import type {
  AccountContext,
  AllowedRiskValues,
  AppliedHardLimit,
  ChallengeRules,
  InstrumentSpec,
  LiveRiskRules,
  MoneyMinor,
  RiskModePolicy,
  RiskRooms,
  TradePlanInput,
  TradingContextType,
} from "./contracts";

export type DomainValidation = { missingInputs: string[]; reasons: string[] };

function isMinor(value: unknown): value is MoneyMinor {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Never silently coerce malformed account or rules into a live risk decision. */
export function validateTradingOsInputs(input: {
  account: AccountContext | null;
  challengeRules?: ChallengeRules | null;
  liveRules?: LiveRiskRules | null;
  tradePlan?: TradePlanInput | null;
}): DomainValidation {
  const missingInputs: string[] = [];
  const reasons: string[] = [];
  const account = input.account;

  if (!account) return { missingInputs: ["account_context"], reasons };
  if (!account.accountId) missingInputs.push("account_id");
  if (!account.timezone) missingInputs.push("timezone");
  if (!account.tradingDay) missingInputs.push("trading_day");
  for (const [key, value] of Object.entries({
    starting_balance: account.startingBalanceMinor,
    current_balance: account.currentBalanceMinor,
    current_equity: account.currentEquityMinor,
    equity_high: account.equityHighMinor,
    realized_pnl: account.realizedPnlMinor,
  })) {
    if (!isMinor(value)) missingInputs.push(key);
  }

  if (account.contextType === "challenge" && !input.challengeRules) {
    missingInputs.push("challenge_rules");
  }
  if (account.contextType === "live" && !input.liveRules) {
    missingInputs.push("live_risk_rules");
  }

  const plan = input.tradePlan;
  if (plan) {
    if (!plan.instrument) missingInputs.push("instrument");
    if (!plan.direction) missingInputs.push("direction");
    if (!plan.stopUnit) missingInputs.push("stop_unit");
    if (plan.stopDistance == null) missingInputs.push("stop_distance");
    else if (!Number.isFinite(plan.stopDistance) || plan.stopDistance <= 0) reasons.push("invalid_stop_distance");
    if (plan.contracts == null) missingInputs.push("contracts");
    else if (!isPositiveInteger(plan.contracts)) reasons.push("invalid_contract_count");
  }

  return { missingInputs: [...new Set(missingInputs)], reasons: [...new Set(reasons)] };
}

/** Instrument data is supplied/configured; this guard never manufactures a spec. */
export function validateInstrumentSpec(spec: InstrumentSpec | null): DomainValidation {
  if (!spec) return { missingInputs: ["instrument"], reasons: [] };
  const missingInputs: string[] = [];
  const reasons: string[] = [];
  if (!spec.symbol) missingInputs.push("instrument_symbol");
  if (!spec.name) missingInputs.push("instrument_name");
  if (!Number.isFinite(spec.tickSize) || spec.tickSize <= 0) reasons.push("invalid_tick_size");
  if (!isPositiveInteger(spec.tickValueMinor)) reasons.push("invalid_tick_value");
  if (!isPositiveInteger(spec.pointValueMinor)) reasons.push("invalid_point_value");
  if (spec.roundTripCommissionMinor != null && !isMinor(spec.roundTripCommissionMinor)) reasons.push("invalid_commission");
  if (spec.defaultSlippageTicks != null && (!Number.isFinite(spec.defaultSlippageTicks) || spec.defaultSlippageTicks < 0)) {
    reasons.push("invalid_slippage");
  }
  if (spec.maximumSupportedContracts != null && !isPositiveInteger(spec.maximumSupportedContracts)) {
    reasons.push("invalid_instrument_contract_cap");
  }
  return { missingInputs, reasons };
}

function finiteNonNegative(value: MoneyMinor | null | undefined): value is MoneyMinor {
  return isMinor(value) && value >= 0;
}

/**
 * The only shared allowed-risk calculation. Mode allocation is applied to the
 * already-capped safe budget, never to account balance or full equity.
 */
export function calculateAllowedRisk(
  policy: RiskModePolicy,
  rooms: RiskRooms,
  context: TradingContextType,
): { values: AllowedRiskValues; appliedHardLimits: AppliedHardLimit[] } {
  const hardLimitEntries: Array<[AppliedHardLimit["id"], MoneyMinor | null | undefined, string]> = [
    ["daily_loss", rooms.dailyLossRemainingMinor, "Daily loss room"],
    ["maximum_loss", rooms.maximumLossRemainingMinor, "Maximum loss room"],
    ["drawdown", rooms.drawdownRemainingMinor, "Drawdown room"],
    ["per_trade_risk", rooms.configuredPerTradeRiskCapMinor, "Per-trade risk cap"],
  ];
  if (context === "live") hardLimitEntries.push(["weekly_loss", rooms.weeklyLossRemainingMinor, "Weekly loss room"]);
  if (rooms.configuredDailyRiskBudgetMinor != null) {
    hardLimitEntries.push(["daily_loss", rooms.configuredDailyRiskBudgetMinor, "Configured daily risk budget"]);
  }

  const knownRooms = hardLimitEntries.map(([, value]) => value).filter(finiteNonNegative);
  const safeBudgetMinor = knownRooms.length === hardLimitEntries.length ? Math.min(...knownRooms) : null;
  const modeSuggestedRiskMinor =
    safeBudgetMinor == null ? null : Math.floor((safeBudgetMinor * policy.defaultAllocationBps) / 10_000);
  const allowedRiskMinor = safeBudgetMinor == null || safeBudgetMinor <= 0 || modeSuggestedRiskMinor == null
    ? 0
    : Math.min(modeSuggestedRiskMinor, safeBudgetMinor);

  return {
    values: { safeBudgetMinor, modeSuggestedRiskMinor, allowedRiskMinor },
    appliedHardLimits: hardLimitEntries.map(([id, remainingMinor, label]) => ({
      id,
      label,
      limitMinor: null,
      remainingMinor: finiteNonNegative(remainingMinor) ? remainingMinor : null,
      blocksTrading: !finiteNonNegative(remainingMinor) || remainingMinor <= 0,
    })),
  };
}
