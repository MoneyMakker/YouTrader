import { RISK_MODE_POLICIES, type AccountContext, type ChallengeRules, type LiveRiskRules, type MoneyMinor, type RiskRooms, type TradingOsResult, type TradingRiskMode } from "./contracts";
import { calculateAllowedRisk } from "./domain";
import { PROP_PASS_CALCULATION_VERSION } from "./calculationVersion";
import { contractFloor } from "./financialMath";

export type DailyPlanInput = {
  snapshotId: string;
  generatedAt: string;
  account: AccountContext | null;
  challengeRules: ChallengeRules | null;
  liveRules: LiveRiskRules | null;
  riskRooms: RiskRooms;
  selectedMode: TradingRiskMode;
  preferredInstrument: string | null;
  intendedSessionId: string | null;
  recentLossStreak: number;
};

export type DailyTradingPlanSnapshot = Readonly<{
  calculationVersion: typeof PROP_PASS_CALCULATION_VERSION;
  id: string;
  generatedAt: string;
  accountId: string;
  tradingDay: string;
  context: "challenge" | "live";
  mode: TradingRiskMode;
  maximumRiskTodayMinor: MoneyMinor;
  riskPerTradeMinor: MoneyMinor;
  maximumTrades: number;
  stopAfterLosses: number | null;
  profitLockMinor: MoneyMinor | null;
  preferredInstrument: string | null;
  allowedSessionId: string | null;
  hardLimitSnapshot: Readonly<RiskRooms>;
}>;

export function createDailyTradingPlan(input: DailyPlanInput): TradingOsResult<DailyTradingPlanSnapshot | null> {
  const account = input.account;
  if (!account) return response("needs_input", null, [], ["account_context"]);
  const rules = account.contextType === "challenge" ? input.challengeRules : input.liveRules;
  if (!rules) return response("needs_input", null, [], [account.contextType === "challenge" ? "challenge_rules" : "live_risk_rules"]);
  const requiredRooms = [input.riskRooms.dailyLossRemainingMinor, input.riskRooms.maximumLossRemainingMinor, input.riskRooms.drawdownRemainingMinor, input.riskRooms.configuredDailyRiskBudgetMinor, input.riskRooms.configuredPerTradeRiskCapMinor];
  if (requiredRooms.some((value) => !isMinor(value) || value < 0)) return response("needs_input", null, ["hard_risk_limit_missing"], ["risk_rooms"]);
  if (account.contextType === "live" && (!isMinor(input.riskRooms.weeklyLossRemainingMinor) || input.riskRooms.weeklyLossRemainingMinor < 0)) return response("needs_input", null, ["hard_risk_limit_missing"], ["weekly_loss_remaining"]);

  const allowed = calculateAllowedRisk(RISK_MODE_POLICIES[input.selectedMode], input.riskRooms, account.contextType);
  if (allowed.values.allowedRiskMinor <= 0 || allowed.values.safeBudgetMinor == null) return response("stop_trading", null, ["no_remaining_hard_loss_room"], []);
  const stopAfterLosses = account.contextType === "challenge" ? input.challengeRules?.stopAfterLosses ?? null : input.liveRules?.consecutiveLossLimit ?? null;
  if (stopAfterLosses != null && input.recentLossStreak >= stopAfterLosses) return response("stop_trading", null, ["consecutive_loss_limit_reached"], []);
  const maximumRiskTodayMinor = allowed.values.safeBudgetMinor;
  const maximumTrades = account.contextType === "live" && input.liveRules?.maximumTrades != null
    ? input.liveRules.maximumTrades
    : Math.max(1, contractFloor(maximumRiskTodayMinor, allowed.values.allowedRiskMinor));
  const snapshot: DailyTradingPlanSnapshot = Object.freeze({
    calculationVersion: PROP_PASS_CALCULATION_VERSION,
    id: input.snapshotId,
    generatedAt: input.generatedAt,
    accountId: account.accountId,
    tradingDay: account.tradingDay,
    context: account.contextType,
    mode: input.selectedMode,
    maximumRiskTodayMinor,
    riskPerTradeMinor: allowed.values.allowedRiskMinor,
    maximumTrades,
    stopAfterLosses,
    profitLockMinor: account.contextType === "challenge" ? input.challengeRules?.profitLockMinor ?? null : input.liveRules?.profitProtectionThresholdMinor ?? null,
    preferredInstrument: input.preferredInstrument ?? account.preferredInstrument ?? null,
    allowedSessionId: input.intendedSessionId,
    hardLimitSnapshot: Object.freeze({ ...input.riskRooms }),
  });
  return response("safe_to_take", snapshot, [], []);
}

function isMinor(value: unknown): value is MoneyMinor { return typeof value === "number" && Number.isSafeInteger(value); }
function response(status: TradingOsResult<DailyTradingPlanSnapshot | null>["status"], values: DailyTradingPlanSnapshot | null, reasons: string[], missingInputs: string[]): TradingOsResult<DailyTradingPlanSnapshot | null> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
