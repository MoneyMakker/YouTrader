import type { MoneyMinor, TradingOsResult } from "./contracts";
import { moneyClampNonNegative, moneyMax, moneyMin, moneySubtract } from "./financialMath";

export type SafeWithdrawalInput = {
  currentEquityMinor: MoneyMinor | null;
  equityHighMinor: MoneyMinor | null;
  realizedEligibleProfitMinor: MoneyMinor | null;
  staticLossFloorMinor: MoneyMinor | null;
  trailingDrawdownFloorMinor: MoneyMinor | null;
  postWithdrawalReserveMinor: MoneyMinor | null;
  dailyRiskReserveMinor: MoneyMinor | null;
  weeklyRiskReserveMinor: MoneyMinor | null;
  recoverySafetyReserveMinor: MoneyMinor | null;
  recoveryModeActive: boolean;
  priorWithdrawalsMinor: MoneyMinor | null;
};

export type SafeWithdrawalValues = {
  readiness: "ready" | "blocked" | "needs_input";
  eligibleAmountMinor: MoneyMinor;
  safetyFloorMinor: MoneyMinor | null;
  reserveMinor: MoneyMinor | null;
  recommendedMaximumWithdrawalMinor: MoneyMinor;
  resultingEquityMinor: MoneyMinor | null;
  resultingBufferMinor: MoneyMinor | null;
  priorWithdrawalsMinor: MoneyMinor | null;
  blockers: string[];
};

/** No withdrawal is recommended below the stricter loss floor plus the configured risk reserve. */
export function calculateMaximumSafeWithdrawal(input: SafeWithdrawalInput): TradingOsResult<SafeWithdrawalValues> {
  const required = ["currentEquityMinor", "equityHighMinor", "realizedEligibleProfitMinor", "staticLossFloorMinor", "trailingDrawdownFloorMinor", "postWithdrawalReserveMinor", "dailyRiskReserveMinor", "weeklyRiskReserveMinor", "recoverySafetyReserveMinor", "priorWithdrawalsMinor"] as const;
  const missingInputs = required.filter((field) => input[field] == null).map((field) => `withdrawal_${field}`);
  const empty = emptyValues(input);
  if (missingInputs.length || !valid(input)) return result("needs_input", empty, ["withdrawal_setup_missing_or_invalid"], missingInputs.length ? missingInputs : ["withdrawal_configuration"]);
  const safetyFloorMinor = moneyMax(input.staticLossFloorMinor!, input.trailingDrawdownFloorMinor!);
  const reserveMinor = moneyMax(input.postWithdrawalReserveMinor!, input.dailyRiskReserveMinor!, input.weeklyRiskReserveMinor!, input.recoveryModeActive ? input.recoverySafetyReserveMinor! : 0);
  const availableAboveFloor = moneyClampNonNegative(moneySubtract(moneySubtract(input.currentEquityMinor!, safetyFloorMinor), reserveMinor));
  const blockers: string[] = [];
  if (input.recoveryModeActive) blockers.push("recovery_mode_active");
  if (input.realizedEligibleProfitMinor! <= 0) blockers.push("no_realized_eligible_profit");
  if (availableAboveFloor <= 0) blockers.push("safety_floor_or_reserve_not_met");
  const recommendedMaximumWithdrawalMinor = blockers.length ? 0 : moneyMin(input.realizedEligibleProfitMinor!, availableAboveFloor);
  const resultingEquityMinor = moneySubtract(input.currentEquityMinor!, recommendedMaximumWithdrawalMinor);
  const resultingBufferMinor = moneySubtract(moneySubtract(resultingEquityMinor, safetyFloorMinor), reserveMinor);
  return result("safe_to_take", { readiness: recommendedMaximumWithdrawalMinor > 0 ? "ready" : "blocked", eligibleAmountMinor: moneyClampNonNegative(input.realizedEligibleProfitMinor!), safetyFloorMinor, reserveMinor, recommendedMaximumWithdrawalMinor, resultingEquityMinor, resultingBufferMinor, priorWithdrawalsMinor: input.priorWithdrawalsMinor!, blockers }, blockers, []);
}

function valid(input: SafeWithdrawalInput): boolean { return [input.currentEquityMinor, input.equityHighMinor, input.realizedEligibleProfitMinor, input.staticLossFloorMinor, input.trailingDrawdownFloorMinor, input.postWithdrawalReserveMinor, input.dailyRiskReserveMinor, input.weeklyRiskReserveMinor, input.recoverySafetyReserveMinor, input.priorWithdrawalsMinor].every((value) => value! >= 0); }
function emptyValues(input: SafeWithdrawalInput): SafeWithdrawalValues { return { readiness: "needs_input", eligibleAmountMinor: 0, safetyFloorMinor: null, reserveMinor: null, recommendedMaximumWithdrawalMinor: 0, resultingEquityMinor: input.currentEquityMinor, resultingBufferMinor: null, priorWithdrawalsMinor: input.priorWithdrawalsMinor, blockers: [] }; }
function result(status: TradingOsResult<SafeWithdrawalValues>["status"], values: SafeWithdrawalValues, reasons: string[], missingInputs: string[]): TradingOsResult<SafeWithdrawalValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
