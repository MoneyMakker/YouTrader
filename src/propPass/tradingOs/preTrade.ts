import {
  calculateAllowedRisk,
  validateTradingOsInputs,
} from "./domain";
import type {
  AccountContext,
  AppliedHardLimit,
  ChallengeRules,
  DecisionStatus,
  LiveRiskRules,
  MoneyMinor,
  RiskRooms,
  TradePlanInput,
  TradingOsResult,
  TradingRiskMode,
} from "./contracts";
import { RISK_MODE_POLICIES } from "./contracts";
import { calculatePositionSize } from "./positionSizing";
import { contractFloor, moneyMultiplyInteger, moneySubtract } from "./financialMath";

export type PreTradeAssessmentInput = {
  account: AccountContext | null;
  challengeRules: ChallengeRules | null;
  liveRules: LiveRiskRules | null;
  plan: TradePlanInput;
  riskRooms: RiskRooms;
  selectedMode: TradingRiskMode;
  completedTradesToday: number;
  consecutiveLosses: number;
  currentMinuteLocal: number | null;
  insideAllowedSession: boolean | null;
  killSwitchActive: boolean;
  profitLockReached: boolean;
};

export type PreTradeValues = {
  lossPerContractMinor: MoneyMinor | null;
  totalPlannedRiskMinor: MoneyMinor | null;
  allowedRiskMinor: MoneyMinor | null;
  recommendedContracts: number | null;
  dailyRoomAfterLossMinor: MoneyMinor | null;
  drawdownRoomAfterLossMinor: MoneyMinor | null;
  maximumLossRoomAfterLossMinor: MoneyMinor | null;
  weeklyRoomAfterLossMinor: MoneyMinor | null;
};

function limit(id: AppliedHardLimit["id"], label: string, remainingMinor: MoneyMinor | null, blocksTrading: boolean): AppliedHardLimit {
  return { id, label, limitMinor: null, remainingMinor, blocksTrading };
}

function finiteInteger(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function calculateLossPerContract(plan: TradePlanInput): { value: MoneyMinor | null; missingInputs: string[]; reasons: string[] } {
  const sized = calculatePositionSize({ plan, allowedRiskMinor: Number.MAX_SAFE_INTEGER });
  return { value: sized.values.totalLossPerContractMinor, missingInputs: sized.missingInputs, reasons: sized.reasons };
}

function result(
  status: DecisionStatus,
  values: PreTradeValues,
  reasons: string[],
  missingInputs: string[],
  appliedHardLimits: AppliedHardLimit[],
  relatedRuleIds: string[],
): TradingOsResult<PreTradeValues> {
  return {
    values,
    status,
    reasons: [...new Set(reasons)],
    missingInputs: [...new Set(missingInputs)],
    appliedHardLimits,
    relatedRuleIds: [...new Set(relatedRuleIds.filter(Boolean))],
  };
}

/**
 * Pure, non-execution pre-trade assessment. A proposed position is never
 * approved when a required safety input is unknown.
 */
export function assessPreTrade(input: PreTradeAssessmentInput): TradingOsResult<PreTradeValues> {
  const base = validateTradingOsInputs({
    account: input.account,
    challengeRules: input.challengeRules,
    liveRules: input.liveRules,
    tradePlan: input.plan,
  });
  const loss = calculateLossPerContract(input.plan);
  const account = input.account;
  const context = account?.contextType;
  const challengeRules = input.challengeRules;
  const liveRules = input.liveRules;
  const hardLimits: AppliedHardLimit[] = [];
  const relatedRuleIds = [challengeRules?.id ?? "", liveRules?.id ?? ""];
  const contracts = input.plan.contracts;
  const lossPerContractMinor = loss.value;
  const totalPlannedRiskMinor =
    lossPerContractMinor != null && finiteInteger(contracts) && contracts > 0
      ? moneyMultiplyInteger(lossPerContractMinor, contracts)
      : null;

  const emptyValues: PreTradeValues = {
    lossPerContractMinor,
    totalPlannedRiskMinor,
    allowedRiskMinor: null,
    recommendedContracts: null,
    dailyRoomAfterLossMinor: null,
    drawdownRoomAfterLossMinor: null,
    maximumLossRoomAfterLossMinor: null,
    weeklyRoomAfterLossMinor: null,
  };

  const missingInputs = [...base.missingInputs, ...loss.missingInputs];
  const reasons = [...base.reasons, ...loss.reasons];
  if (!account || !context || missingInputs.length || reasons.length || totalPlannedRiskMinor == null) {
    if (totalPlannedRiskMinor == null && !missingInputs.includes("contracts")) missingInputs.push("planned_risk");
    return result("needs_input", emptyValues, reasons, missingInputs, hardLimits, relatedRuleIds);
  }

  const requiredRiskRooms: Array<[string, MoneyMinor | null | undefined]> = [
    ["daily_loss_remaining", input.riskRooms.dailyLossRemainingMinor],
    ["maximum_loss_remaining", input.riskRooms.maximumLossRemainingMinor],
    ["drawdown_remaining", input.riskRooms.drawdownRemainingMinor],
    ["configured_daily_risk_budget", input.riskRooms.configuredDailyRiskBudgetMinor],
    ["configured_per_trade_risk_cap", input.riskRooms.configuredPerTradeRiskCapMinor],
  ];
  if (context === "live") requiredRiskRooms.push(["weekly_loss_remaining", input.riskRooms.weeklyLossRemainingMinor]);
  const missingRiskRooms = requiredRiskRooms
    .filter(([, value]) => !finiteInteger(value) || value == null || value < 0)
    .map(([key]) => key);
  if (missingRiskRooms.length) {
    return result("needs_input", emptyValues, ["hard_risk_limit_missing"], missingRiskRooms, hardLimits, relatedRuleIds);
  }

  const allowed = calculateAllowedRisk(RISK_MODE_POLICIES[input.selectedMode], input.riskRooms, context);
  hardLimits.push(...allowed.appliedHardLimits);
  const dailyAfter = subtractRoom(input.riskRooms.dailyLossRemainingMinor, totalPlannedRiskMinor);
  const maximumAfter = subtractRoom(input.riskRooms.maximumLossRemainingMinor, totalPlannedRiskMinor);
  const drawdownAfter = subtractRoom(input.riskRooms.drawdownRemainingMinor, totalPlannedRiskMinor);
  const weeklyAfter = context === "live" ? subtractRoom(input.riskRooms.weeklyLossRemainingMinor ?? null, totalPlannedRiskMinor) : null;
  const recommendedContracts =
    lossPerContractMinor != null && lossPerContractMinor > 0 && allowed.values.allowedRiskMinor != null
      ? Math.max(0, contractFloor(allowed.values.allowedRiskMinor, lossPerContractMinor))
      : null;
  const values: PreTradeValues = {
    ...emptyValues,
    allowedRiskMinor: allowed.values.allowedRiskMinor,
    recommendedContracts,
    dailyRoomAfterLossMinor: dailyAfter,
    drawdownRoomAfterLossMinor: drawdownAfter,
    maximumLossRoomAfterLossMinor: maximumAfter,
    weeklyRoomAfterLossMinor: weeklyAfter,
  };

  if (input.killSwitchActive) {
    hardLimits.push(limit("kill_switch", "Personal Kill Switch", 0, true));
    return result("stop_trading", values, ["kill_switch_active"], [], hardLimits, relatedRuleIds);
  }
  if (input.profitLockReached) {
    hardLimits.push(limit("profit_lock", "Profit lock", 0, true));
    return result("stop_trading", values, ["profit_lock_reached"], [], hardLimits, relatedRuleIds);
  }
  const maximumContracts = challengeRules?.maximumContracts ?? input.plan.instrument?.maximumSupportedContracts ?? null;
  if (contracts != null && maximumContracts != null && contracts > maximumContracts) {
    hardLimits.push(limit("contract_limit", "Maximum contracts", null, true));
    return result("rule_violation", values, ["contract_limit_exceeded"], [], hardLimits, relatedRuleIds);
  }
  if (allowed.values.allowedRiskMinor <= 0 || [dailyAfter, maximumAfter, drawdownAfter, weeklyAfter].some((room) => room != null && room <= 0)) {
    return result("stop_trading", values, ["no_remaining_hard_loss_room"], [], hardLimits, relatedRuleIds);
  }

  const maxTrades = context === "live" ? liveRules?.maximumTrades : undefined;
  if (maxTrades != null && input.completedTradesToday >= maxTrades) {
    hardLimits.push(limit("trade_count", "Maximum daily trades", null, true));
    return result("stop_trading", values, ["daily_trade_count_reached"], [], hardLimits, relatedRuleIds);
  }
  const lossLimit = context === "live" ? liveRules?.consecutiveLossLimit : challengeRules?.stopAfterLosses;
  if (lossLimit != null && input.consecutiveLosses >= lossLimit) {
    hardLimits.push(limit("consecutive_losses", "Consecutive-loss stop", null, true));
    return result("stop_trading", values, ["consecutive_loss_limit_reached"], [], hardLimits, relatedRuleIds);
  }
  if (input.insideAllowedSession == null) {
    return result("needs_input", values, ["trading_session_context_missing"], ["inside_allowed_session"], hardLimits, relatedRuleIds);
  }
  if (!input.insideAllowedSession) {
    hardLimits.push(limit("allowed_session", "Allowed trading session", null, true));
    return result("rule_violation", values, ["outside_allowed_session"], [], hardLimits, relatedRuleIds);
  }

  if (totalPlannedRiskMinor > allowed.values.allowedRiskMinor) {
    return result("risky", values, ["planned_risk_exceeds_mode_recommendation"], [], hardLimits, relatedRuleIds);
  }
  return result("safe_to_take", values, [], [], hardLimits, relatedRuleIds);
}

function subtractRoom(room: MoneyMinor | null | undefined, plannedRiskMinor: MoneyMinor): MoneyMinor | null {
  return finiteInteger(room) ? moneySubtract(room, plannedRiskMinor) : null;
}
