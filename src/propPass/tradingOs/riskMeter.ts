import type { MoneyMinor, RiskHealth, TradingOsResult } from "./contracts";

export type LiveRiskMeterInput = {
  dailyRiskBudgetMinor: MoneyMinor | null;
  dailyRiskUsedMinor: MoneyMinor | null;
  hardStopActive: boolean;
  previousStatus?: RiskHealth | null;
};
export type LiveRiskMeterValues = {
  usedMinor: MoneyMinor | null;
  remainingMinor: MoneyMinor | null;
  usedRatio: number | null;
  status: RiskHealth | null;
  enteredDanger: boolean;
  statusChanged: boolean;
};

/** UI consumes enteredDanger once for haptics; this engine never triggers haptics. */
export function calculateLiveRiskMeter(input: LiveRiskMeterInput): TradingOsResult<LiveRiskMeterValues> {
  const blank: LiveRiskMeterValues = { usedMinor: null, remainingMinor: null, usedRatio: null, status: null, enteredDanger: false, statusChanged: false };
  if (!isMinor(input.dailyRiskBudgetMinor) || input.dailyRiskBudgetMinor <= 0) return response("needs_input", blank, ["invalid_daily_risk_budget"], ["daily_risk_budget"]);
  if (!isMinor(input.dailyRiskUsedMinor) || input.dailyRiskUsedMinor < 0) return response("needs_input", blank, ["invalid_daily_risk_used"], ["daily_risk_used"]);
  const remainingMinor = Math.max(0, input.dailyRiskBudgetMinor - input.dailyRiskUsedMinor);
  const usedRatio = input.dailyRiskUsedMinor / input.dailyRiskBudgetMinor;
  const status: RiskHealth = input.hardStopActive || usedRatio >= 1 ? "stop_trading" : usedRatio >= .75 ? "danger" : usedRatio >= .5 ? "watch" : "healthy";
  const statusChanged = input.previousStatus != null && input.previousStatus !== status;
  return response(status === "stop_trading" ? "stop_trading" : status === "danger" ? "risky" : "safe_to_take", { usedMinor: input.dailyRiskUsedMinor, remainingMinor, usedRatio, status, enteredDanger: status === "danger" && input.previousStatus !== "danger", statusChanged }, [], []);
}
function isMinor(value: unknown): value is MoneyMinor { return typeof value === "number" && Number.isSafeInteger(value); }
function response(status: TradingOsResult<LiveRiskMeterValues>["status"], values: LiveRiskMeterValues, reasons: string[], missingInputs: string[]): TradingOsResult<LiveRiskMeterValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
