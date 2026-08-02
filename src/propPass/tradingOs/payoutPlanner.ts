import type { MoneyMinor, TradingOsResult } from "./contracts";
import type { PayoutReadinessValues } from "./payout";
import { moneySubtract } from "./financialMath";
export type PayoutPlanScenario = Readonly<{ amountMinor: MoneyMinor; permitted: boolean; resultingEquityMinor: MoneyMinor | null; resultingBufferMinor: MoneyMinor | null; blocker: string | null }>;
export type PayoutPlannerValues = Readonly<{ earliestEligibleTradingDay: string | null; completedMinimumDays: number | null; remainingMinimumDays: number | null; recommendedSafePayoutMinor: MoneyMinor; scenarios: PayoutPlanScenario[] }>;

export function buildPayoutPlanner(input: { readiness: TradingOsResult<PayoutReadinessValues> | null; currentEquityMinor: MoneyMinor | null; tradingDayId: string | null; scenarioAmountsMinor: MoneyMinor[] }): TradingOsResult<PayoutPlannerValues> {
  const ready = input.readiness;
  const blank: PayoutPlannerValues = { earliestEligibleTradingDay: null, completedMinimumDays: null, remainingMinimumDays: null, recommendedSafePayoutMinor: 0, scenarios: [] };
  if (!ready || input.currentEquityMinor == null || !input.tradingDayId) return result("needs_input", blank, ["payout_planner_setup_missing"], ["payout_readiness", "current_equity", "trading_day"]);
  const values = ready.values;
  if (ready.status === "needs_input" || values.safetyFloorMinor == null || values.postPayoutReserveMinor == null || values.completedTradingDays == null || values.minimumTradingDays == null) return result("needs_input", blank, ready.reasons, ready.missingInputs);
  const remainingDays = Math.max(0, values.minimumTradingDays - values.completedTradingDays);
  const scenarios = [...new Set(input.scenarioAmountsMinor)].filter((amount) => Number.isSafeInteger(amount) && amount >= 0).sort((a, b) => a - b).map((amount) => { const permitted = amount <= values.recommendedMaximumPayoutMinor && values.blockers.length === 0; const resultingEquity = moneySubtract(input.currentEquityMinor!, amount); const resultingBuffer = moneySubtract(moneySubtract(resultingEquity, values.safetyFloorMinor!), values.postPayoutReserveMinor!); return { amountMinor: amount, permitted, resultingEquityMinor: resultingEquity, resultingBufferMinor: resultingBuffer, blocker: permitted ? null : values.blockers[0] ?? "amount_exceeds_recommended_safe_payout" }; });
  return result(ready.status, { earliestEligibleTradingDay: remainingDays === 0 ? input.tradingDayId : `after_${remainingDays}_more_trading_day(s)`, completedMinimumDays: values.completedTradingDays, remainingMinimumDays: remainingDays, recommendedSafePayoutMinor: values.recommendedMaximumPayoutMinor, scenarios }, ready.reasons, []);
}
function result(status: TradingOsResult<PayoutPlannerValues>["status"], values: PayoutPlannerValues, reasons: string[], missingInputs: string[]): TradingOsResult<PayoutPlannerValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
