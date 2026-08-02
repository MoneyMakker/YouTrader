import type { MoneyMinor, TradingOsResult } from "./contracts";

export type KillSwitchConfiguration = {
  maximumDailyLossMinor: MoneyMinor | null;
  maximumWeeklyLossMinor: MoneyMinor | null;
  maximumTradeCount: number | null;
  consecutiveLossLimit: number | null;
  cutoffMinuteLocal: number | null;
  stopAfterProfitLock: boolean | null;
  resetStrategy: "next_trading_day" | "next_session" | null;
};
export type KillSwitchInput = {
  configuration: KillSwitchConfiguration;
  currentDailyLossMinor: MoneyMinor | null;
  currentWeeklyLossMinor: MoneyMinor | null;
  currentTradeCount: number | null;
  consecutiveLosses: number | null;
  currentMinuteLocal: number | null;
  profitLockStopActive: boolean | null;
  manualSessionLockRequested: boolean;
  manualSessionLockConfirmed: boolean;
};
export type KillSwitchValues = { active: boolean; triggerIds: string[]; exactTriggers: string[]; recommendedRiskMinor: MoneyMinor; recommendedContracts: number; gamblerDisabled: boolean; manualConfirmationRequired: boolean; resetInstruction: string | null; };

export function evaluateKillSwitch(input: KillSwitchInput): TradingOsResult<KillSwitchValues> {
  const config = input.configuration;
  const missingInputs: string[] = [];
  if (config.maximumDailyLossMinor != null && input.currentDailyLossMinor == null) missingInputs.push("kill_switch_current_daily_loss");
  if (config.maximumWeeklyLossMinor != null && input.currentWeeklyLossMinor == null) missingInputs.push("kill_switch_current_weekly_loss");
  if (config.maximumTradeCount != null && input.currentTradeCount == null) missingInputs.push("kill_switch_current_trade_count");
  if (config.consecutiveLossLimit != null && input.consecutiveLosses == null) missingInputs.push("kill_switch_consecutive_losses");
  if (config.cutoffMinuteLocal != null && input.currentMinuteLocal == null) missingInputs.push("kill_switch_current_minute");
  if (config.stopAfterProfitLock && input.profitLockStopActive == null) missingInputs.push("kill_switch_profit_lock_state");
  if (!validConfiguration(config)) missingInputs.push("kill_switch_configuration");
  if (missingInputs.length) return result("stop_trading", stopped(["kill_switch_setup_incomplete"], input.manualSessionLockRequested && !input.manualSessionLockConfirmed, config.resetStrategy), ["kill_switch_setup_incomplete"], missingInputs);
  const triggers: Array<[string, string]> = [];
  if (config.maximumDailyLossMinor != null && input.currentDailyLossMinor! >= config.maximumDailyLossMinor) triggers.push(["daily_loss", "Configured maximum daily loss reached."]);
  if (config.maximumWeeklyLossMinor != null && input.currentWeeklyLossMinor! >= config.maximumWeeklyLossMinor) triggers.push(["weekly_loss", "Configured maximum weekly loss reached."]);
  if (config.maximumTradeCount != null && input.currentTradeCount! >= config.maximumTradeCount) triggers.push(["trade_count", "Configured maximum trade count reached."]);
  if (config.consecutiveLossLimit != null && input.consecutiveLosses! >= config.consecutiveLossLimit) triggers.push(["consecutive_losses", "Configured consecutive-loss limit reached."]);
  if (config.cutoffMinuteLocal != null && input.currentMinuteLocal! >= config.cutoffMinuteLocal) triggers.push(["cutoff_time", "Configured session cutoff time reached."]);
  if (config.stopAfterProfitLock && input.profitLockStopActive) triggers.push(["profit_lock", "Configured profit-lock stop is active."]);
  if (input.manualSessionLockConfirmed) triggers.push(["manual_session_lock", "Manual session lock was explicitly confirmed."]);
  const manualConfirmationRequired = input.manualSessionLockRequested && !input.manualSessionLockConfirmed;
  if (!triggers.length) return result("safe_to_take", { active: false, triggerIds: [], exactTriggers: [], recommendedRiskMinor: 0, recommendedContracts: 0, gamblerDisabled: false, manualConfirmationRequired, resetInstruction: resetInstruction(config.resetStrategy) }, manualConfirmationRequired ? ["manual_lock_confirmation_required"] : [], []);
  return result("stop_trading", stopped(triggers.map(([id]) => id), manualConfirmationRequired, config.resetStrategy, triggers.map(([, label]) => label)), triggers.map(([id]) => id), []);
}

function validConfiguration(config: KillSwitchConfiguration): boolean { return config.resetStrategy != null && [config.maximumDailyLossMinor, config.maximumWeeklyLossMinor].every((value) => value == null || value >= 0) && [config.maximumTradeCount, config.consecutiveLossLimit].every((value) => value == null || (Number.isInteger(value) && value >= 0)) && (config.cutoffMinuteLocal == null || (Number.isInteger(config.cutoffMinuteLocal) && config.cutoffMinuteLocal >= 0 && config.cutoffMinuteLocal < 1_440)); }
function stopped(ids: string[], manualConfirmationRequired: boolean, resetStrategy: KillSwitchConfiguration["resetStrategy"], labels: string[] = ids): KillSwitchValues { return { active: true, triggerIds: ids, exactTriggers: labels, recommendedRiskMinor: 0, recommendedContracts: 0, gamblerDisabled: true, manualConfirmationRequired, resetInstruction: resetInstruction(resetStrategy) }; }
function resetInstruction(strategy: KillSwitchConfiguration["resetStrategy"]): string | null { return strategy === "next_trading_day" ? "Resets at the next configured trading day." : strategy === "next_session" ? "Resets at the next configured trading session." : null; }
function result(status: TradingOsResult<KillSwitchValues>["status"], values: KillSwitchValues, reasons: string[], missingInputs: string[]): TradingOsResult<KillSwitchValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: ["kill_switch"] }; }
