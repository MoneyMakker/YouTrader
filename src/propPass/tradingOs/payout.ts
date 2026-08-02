import type { MoneyMinor, TradingOsResult } from "./contracts";

export type PayoutReadinessInput = {
  currentEquityMinor: MoneyMinor | null; startingBalanceMinor: MoneyMinor | null; eligibleProfitMinor: MoneyMinor | null;
  completedTradingDays: number | null; minimumTradingDays: number | null; consistencyPassed: boolean | null;
  payoutThresholdMinor: MoneyMinor | null; maximumLossFloorMinor: MoneyMinor | null; trailingDrawdownFloorMinor?: MoneyMinor | null;
  postPayoutReserveMinor: MoneyMinor | null;
};
export type PayoutReadinessValues = { eligibleProfitMinor: MoneyMinor | null; completedTradingDays: number | null; minimumTradingDays: number | null; consistencyPassed: boolean | null; payoutThresholdMinor: MoneyMinor | null; safetyFloorMinor: MoneyMinor | null; postPayoutReserveMinor: MoneyMinor | null; safetyBufferAfterPayoutMinor: MoneyMinor | null; recommendedMaximumPayoutMinor: MoneyMinor; blockers: string[] };
export function calculatePayoutReadiness(input: PayoutReadinessInput): TradingOsResult<PayoutReadinessValues> {
  const blank: PayoutReadinessValues = { eligibleProfitMinor: input.eligibleProfitMinor, completedTradingDays: input.completedTradingDays, minimumTradingDays: input.minimumTradingDays, consistencyPassed: input.consistencyPassed, payoutThresholdMinor: input.payoutThresholdMinor, safetyFloorMinor: null, postPayoutReserveMinor: input.postPayoutReserveMinor, safetyBufferAfterPayoutMinor: null, recommendedMaximumPayoutMinor: 0, blockers: [] };
  const required = ["current_equity", "eligible_profit", "completed_trading_days", "minimum_trading_days", "consistency_status", "payout_threshold", "maximum_loss_floor", "post_payout_reserve"] as const;
  const values = [input.currentEquityMinor, input.eligibleProfitMinor, input.completedTradingDays, input.minimumTradingDays, input.consistencyPassed, input.payoutThresholdMinor, input.maximumLossFloorMinor, input.postPayoutReserveMinor];
  const missingInputs = required.filter((_, index) => values[index] == null);
  if (missingInputs.length) return response("needs_input", blank, ["set_payout_rules"], [...missingInputs]);
  const floor = Math.max(input.maximumLossFloorMinor!, input.trailingDrawdownFloorMinor ?? input.maximumLossFloorMinor!);
  const availableAboveFloor = input.currentEquityMinor! - floor;
  const reserveSafe = Math.max(0, availableAboveFloor - input.postPayoutReserveMinor!);
  const blockers: string[] = [];
  if (input.completedTradingDays! < input.minimumTradingDays!) blockers.push("minimum_trading_days");
  if (!input.consistencyPassed) blockers.push("consistency_rule");
  if (input.eligibleProfitMinor! < input.payoutThresholdMinor!) blockers.push("payout_threshold");
  if (reserveSafe <= 0) blockers.push("safety_reserve");
  const recommended = blockers.length ? 0 : Math.max(0, Math.min(input.eligibleProfitMinor!, reserveSafe));
  const valuesOut: PayoutReadinessValues = { ...blank, safetyFloorMinor: floor, safetyBufferAfterPayoutMinor: availableAboveFloor - recommended, recommendedMaximumPayoutMinor: recommended, blockers };
  return response(blockers.length ? "risky" : "safe_to_take", valuesOut, blockers, []);
}
function response(status: TradingOsResult<PayoutReadinessValues>["status"], values: PayoutReadinessValues, reasons: string[], missingInputs: string[]): TradingOsResult<PayoutReadinessValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
