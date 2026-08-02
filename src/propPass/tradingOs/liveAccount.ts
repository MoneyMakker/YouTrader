import type { AccountContext, LiveRiskRules, MoneyMinor, RiskRooms, TradingOsResult } from "./contracts";
import { calculateCapitalPreservationScore, type CapitalPreservationInput, type CapitalPreservationValues } from "./preservation";
import { evaluateKillSwitch, type KillSwitchInput, type KillSwitchValues } from "./killSwitch";
import { calculateLiveEngine, type LiveEngineValues } from "./live";
import { evaluateRecoveryMode, type RecoveryModeValues } from "./recovery";

export type LiveAccountIntegrationInput = {
  account: AccountContext | null;
  rules: LiveRiskRules | null;
  riskRooms: RiskRooms | null;
  normalRiskPerTradeMinor: MoneyMinor | null;
  normalMaximumContracts: number | null;
  recoveryRiskBps: number | null;
  minimumCompliantProfitableSessions: number | null;
  completedCompliantProfitableSessions: number | null;
  killSwitch: KillSwitchInput | null;
  preservation: CapitalPreservationInput | null;
};
export type LiveAccountState = "active" | "stop_trading" | "needs_input";
export type LiveAccountIntegrationValues = {
  state: LiveAccountState;
  currentEquityMinor: MoneyMinor | null;
  equityHighMinor: MoneyMinor | null;
  dailyRiskRemainingMinor: MoneyMinor | null;
  weeklyLossRoomMinor: MoneyMinor | null;
  liveRisk: LiveEngineValues | null;
  recovery: RecoveryModeValues | null;
  preservation: CapitalPreservationValues | null;
  killSwitch: KillSwitchValues | null;
};

/** Live-only composition; adapters feed it account facts after a Journal mutation or foreground refresh. */
export function evaluateLiveAccount(input: LiveAccountIntegrationInput): TradingOsResult<LiveAccountIntegrationValues> {
  if (!input.account || input.account.contextType !== "live") return response("needs_input", empty(input.account), ["live_account_context_required"], ["live_account_context"]);
  if (!input.rules || !input.riskRooms || !input.killSwitch || !input.preservation || input.normalRiskPerTradeMinor == null || input.normalMaximumContracts == null || input.recoveryRiskBps == null || input.minimumCompliantProfitableSessions == null || input.completedCompliantProfitableSessions == null || input.rules.recoveryModeThresholdBps == null) return response("needs_input", empty(input.account), ["live_account_setup_missing"], ["live_rules_or_risk_settings"]);
  const killSwitch = evaluateKillSwitch(input.killSwitch);
  const killActive = killSwitch.values.active;
  const liveRisk = calculateLiveEngine({ currentEquityMinor: input.account.currentEquityMinor, equityHighMinor: input.account.equityHighMinor, dailyRiskRemainingMinor: input.riskRooms.dailyLossRemainingMinor, weeklyLossRemainingMinor: input.riskRooms.weeklyLossRemainingMinor ?? null, normalRiskPerTradeMinor: input.normalRiskPerTradeMinor, recoveryThresholdBps: input.rules.recoveryModeThresholdBps, recoveryRiskBps: input.recoveryRiskBps, killSwitchActive: killActive });
  const recovery = evaluateRecoveryMode({ currentEquityMinor: input.account.currentEquityMinor, equityHighMinor: input.account.equityHighMinor, normalRiskPerTradeMinor: input.normalRiskPerTradeMinor, normalMaximumContracts: input.normalMaximumContracts, activationDrawdownBps: input.rules.recoveryModeThresholdBps, recoveryRiskBps: input.recoveryRiskBps, minimumCompliantProfitableSessions: input.minimumCompliantProfitableSessions, completedCompliantProfitableSessions: input.completedCompliantProfitableSessions });
  const preservation = calculateCapitalPreservationScore(input.preservation);
  const values: LiveAccountIntegrationValues = { state: "active", currentEquityMinor: input.account.currentEquityMinor, equityHighMinor: input.account.equityHighMinor, dailyRiskRemainingMinor: input.riskRooms.dailyLossRemainingMinor, weeklyLossRoomMinor: input.riskRooms.weeklyLossRemainingMinor ?? null, liveRisk: liveRisk.values, recovery: recovery.values, preservation: preservation.values, killSwitch: killSwitch.values };
  if (killSwitch.status === "stop_trading" || liveRisk.status === "stop_trading") { values.state = "stop_trading"; return response("stop_trading", values, [...killSwitch.reasons, ...liveRisk.reasons], [...killSwitch.missingInputs, ...liveRisk.missingInputs]); }
  if ([liveRisk, recovery, preservation].some((item) => item.status === "needs_input")) { values.state = "needs_input"; return response("needs_input", values, ["live_account_data_missing"], [...liveRisk.missingInputs, ...recovery.missingInputs, ...preservation.missingInputs]); }
  return response("safe_to_take", values, [], []);
}

function empty(account: AccountContext | null): LiveAccountIntegrationValues { return { state: "needs_input", currentEquityMinor: account?.currentEquityMinor ?? null, equityHighMinor: account?.equityHighMinor ?? null, dailyRiskRemainingMinor: null, weeklyLossRoomMinor: null, liveRisk: null, recovery: null, preservation: null, killSwitch: null }; }
function response(status: TradingOsResult<LiveAccountIntegrationValues>["status"], values: LiveAccountIntegrationValues, reasons: string[], missingInputs: string[]): TradingOsResult<LiveAccountIntegrationValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
