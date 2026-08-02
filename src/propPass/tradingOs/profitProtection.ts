import type { MoneyMinor, TradingOsResult, TradingRiskMode } from "./contracts";
import { moneyApplyBasisPointsFloor, moneyClampNonNegative, moneySubtract } from "./financialMath";

export type ProfitProtectionInput = {
  dailyRealizedPnlMinor: MoneyMinor | null;
  dailyPeakProfitMinor: MoneyMinor | null;
  weeklyRealizedPnlMinor: MoneyMinor | null;
  weeklyPeakProfitMinor: MoneyMinor | null;
  dailyProfitLockThresholdMinor: MoneyMinor | null;
  weeklyProfitLockThresholdMinor: MoneyMinor | null;
  maximumGivebackBps: number | null;
  stopAfterProfitLock: boolean | null;
  reducedRiskBps: number | null;
  switchToCalmWhenProtected: boolean | null;
};
export type ProfitProtectionValues = {
  active: boolean;
  protectedAmountMinor: MoneyMinor;
  maximumAllowedGivebackMinor: MoneyMinor;
  enforcement: "none" | "reduce_risk" | "stop_trading";
  reducedRiskBps: number | null;
  forcedRiskMode: TradingRiskMode | null;
  trigger: "daily" | "weekly" | null;
  reason: string | null;
};

/** Profit protection uses recorded realized-profit peaks only; never account balance or deposit percentages. */
export function evaluateProfitProtection(input: ProfitProtectionInput): TradingOsResult<ProfitProtectionValues> {
  const fields = ["dailyRealizedPnlMinor", "dailyPeakProfitMinor", "weeklyRealizedPnlMinor", "weeklyPeakProfitMinor", "dailyProfitLockThresholdMinor", "weeklyProfitLockThresholdMinor", "maximumGivebackBps", "stopAfterProfitLock", "reducedRiskBps", "switchToCalmWhenProtected"] as const;
  const missingInputs = fields.filter((field) => input[field] == null).map((field) => `profit_protection_${field}`);
  const empty = emptyValues();
  if (missingInputs.length || !valid(input)) return result("needs_input", empty, ["profit_protection_setup_missing_or_invalid"], missingInputs.length ? missingInputs : ["profit_protection_configuration"]);
  const dailyTriggered = input.dailyPeakProfitMinor! >= input.dailyProfitLockThresholdMinor! && input.dailyProfitLockThresholdMinor! > 0;
  const weeklyTriggered = input.weeklyPeakProfitMinor! >= input.weeklyProfitLockThresholdMinor! && input.weeklyProfitLockThresholdMinor! > 0;
  const trigger = weeklyTriggered ? "weekly" : dailyTriggered ? "daily" : null;
  if (!trigger) return result("safe_to_take", emptyValues(), [], []);
  const peak = trigger === "weekly" ? input.weeklyPeakProfitMinor! : input.dailyPeakProfitMinor!;
  const current = trigger === "weekly" ? input.weeklyRealizedPnlMinor! : input.dailyRealizedPnlMinor!;
  const maximumAllowedGivebackMinor = moneyApplyBasisPointsFloor(peak, input.maximumGivebackBps!);
  const protectedAmountMinor = moneyClampNonNegative(moneySubtract(peak, maximumAllowedGivebackMinor));
  const givebackBreached = current < protectedAmountMinor;
  const enforcement = givebackBreached || input.stopAfterProfitLock ? "stop_trading" : "reduce_risk";
  return result(enforcement === "stop_trading" ? "stop_trading" : "safe_to_take", { active: true, protectedAmountMinor, maximumAllowedGivebackMinor, enforcement, reducedRiskBps: enforcement === "reduce_risk" ? input.reducedRiskBps! : 0, forcedRiskMode: enforcement === "reduce_risk" && input.switchToCalmWhenProtected ? "calm" : null, trigger, reason: givebackBreached ? `Realized ${trigger} profit is below the protected floor.` : input.stopAfterProfitLock ? `The configured ${trigger} profit lock stops additional trades.` : `The configured ${trigger} profit lock reduces risk.` }, enforcement === "stop_trading" ? ["profit_protection_stop"] : ["profit_protection_active"], []);
}

function valid(input: ProfitProtectionInput): boolean { return [input.dailyRealizedPnlMinor, input.dailyPeakProfitMinor, input.weeklyRealizedPnlMinor, input.weeklyPeakProfitMinor, input.dailyProfitLockThresholdMinor, input.weeklyProfitLockThresholdMinor].every((value) => value! >= 0) && input.maximumGivebackBps! >= 0 && input.maximumGivebackBps! <= 10_000 && input.reducedRiskBps! >= 0 && input.reducedRiskBps! <= 10_000; }
function emptyValues(): ProfitProtectionValues { return { active: false, protectedAmountMinor: 0, maximumAllowedGivebackMinor: 0, enforcement: "none", reducedRiskBps: null, forcedRiskMode: null, trigger: null, reason: null }; }
function result(status: TradingOsResult<ProfitProtectionValues>["status"], values: ProfitProtectionValues, reasons: string[], missingInputs: string[]): TradingOsResult<ProfitProtectionValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
