import type { MoneyMinor, RiskRooms, TradingOsResult, TradingRiskMode } from "./contracts";
import { compareRiskModes } from "./modes";
import { contractFloor, moneyMin } from "./financialMath";
export type SurvivalModeCapacity = Readonly<{ mode: TradingRiskMode; riskPerTradeMinor: MoneyMinor; maximumRiskLossesRemaining: number | null; enabled: boolean }>;
export type AccountSurvivalValues = Readonly<{ hardRoomMinor: MoneyMinor | null; dailyCapacity: number | null; drawdownCapacity: number | null; targetDistanceMinor: MoneyMinor | null; modes: SurvivalModeCapacity[]; prediction: false }>;

/** Static loss capacity only. This is never a probability or market forecast. */
export function calculateAccountSurvival(input: { context: "challenge" | "live" | null; riskRooms: RiskRooms | null; lossPerContractMinor: MoneyMinor | null; targetDistanceMinor: MoneyMinor | null }): TradingOsResult<AccountSurvivalValues> {
  const blank: AccountSurvivalValues = { hardRoomMinor: null, dailyCapacity: null, drawdownCapacity: null, targetDistanceMinor: input.targetDistanceMinor, modes: [], prediction: false };
  if (!input.context || !input.riskRooms) return result("needs_input", blank, ["survival_setup_missing"], ["account_context", "risk_rooms"]);
  const rooms = input.riskRooms;
  const required = [rooms.dailyLossRemainingMinor, rooms.maximumLossRemainingMinor, rooms.drawdownRemainingMinor];
  if (required.some((value) => !isMinor(value))) return result("needs_input", blank, ["survival_risk_rooms_missing"], ["daily_maximum_drawdown_rooms"]);
  const hardRoomMinor = moneyMin(...required as MoneyMinor[], ...(input.context === "live" && isMinor(rooms.weeklyLossRemainingMinor) ? [rooms.weeklyLossRemainingMinor] : []));
  const modes = compareRiskModes(rooms, input.context, input.lossPerContractMinor).map((mode) => ({ mode: mode.mode, riskPerTradeMinor: mode.riskPerTradeMinor, maximumRiskLossesRemaining: mode.enabled && mode.riskPerTradeMinor > 0 ? contractFloor(hardRoomMinor, mode.riskPerTradeMinor) : null, enabled: mode.enabled }));
  const baselineRisk = modes.find((mode) => mode.mode === "balanced")?.riskPerTradeMinor ?? 0;
  return result("safe_to_take", { hardRoomMinor, dailyCapacity: baselineRisk > 0 ? contractFloor(rooms.dailyLossRemainingMinor!, baselineRisk) : null, drawdownCapacity: baselineRisk > 0 ? contractFloor(rooms.drawdownRemainingMinor!, baselineRisk) : null, targetDistanceMinor: input.targetDistanceMinor, modes, prediction: false }, [], []);
}
function isMinor(value: unknown): value is MoneyMinor { return Number.isSafeInteger(value) && Number(value) >= 0; }
function result(status: TradingOsResult<AccountSurvivalValues>["status"], values: AccountSurvivalValues, reasons: string[], missingInputs: string[]): TradingOsResult<AccountSurvivalValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
