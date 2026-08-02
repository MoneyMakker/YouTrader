import { RISK_MODE_POLICIES, type MoneyMinor, type RiskRooms, type TradingRiskMode } from "./contracts";
import { calculateAllowedRisk } from "./domain";
import { contractFloor, moneyClampNonNegative, moneyMin, moneyMultiplyInteger, moneySubtract } from "./financialMath";
export type ModeComparison = { mode: TradingRiskMode; highRisk: boolean; riskPerTradeMinor: MoneyMinor; maximumDailyRiskMinor: MoneyMinor | null; maximumTrades: number; stopAfterLosses: number; recommendedContracts: number; requiresInstrumentSetup: boolean; projectedRemainingBufferMinor: MoneyMinor | null; maximumProjectedDamageMinor: MoneyMinor; enabled: boolean; requiresConfirmation: boolean };
export function compareRiskModes(rooms: RiskRooms, context: "challenge" | "live", lossPerContractMinor: MoneyMinor | null): ModeComparison[] {
  return (["calm", "balanced", "gambler"] as const).map((mode) => {
    const allowed = calculateAllowedRisk(RISK_MODE_POLICIES[mode], rooms, context); const risk = allowed.values.allowedRiskMinor;
    const daily = allowed.values.safeBudgetMinor; const trades = risk > 0 && daily != null ? Math.max(1, contractFloor(daily, risk)) : 0;
    const plannedDamage = moneyMultiplyInteger(risk, mode === "gambler" ? 2 : 1);
    const damage = moneyMin(daily ?? 0, plannedDamage); const enabled = risk > 0 && (mode !== "gambler" || (daily ?? 0) >= plannedDamage);
    const hasVerifiedContractRisk = typeof lossPerContractMinor === "number" && Number.isSafeInteger(lossPerContractMinor) && lossPerContractMinor > 0;
    const recommendedContracts = enabled && hasVerifiedContractRisk ? contractFloor(risk, lossPerContractMinor) : 0;
    return { mode, highRisk: mode === "gambler", riskPerTradeMinor: enabled ? risk : 0, maximumDailyRiskMinor: daily, maximumTrades: enabled ? trades : 0, stopAfterLosses: mode === "gambler" ? 1 : 2, recommendedContracts, requiresInstrumentSetup: !hasVerifiedContractRisk, projectedRemainingBufferMinor: daily == null ? null : moneyClampNonNegative(moneySubtract(daily, damage)), maximumProjectedDamageMinor: enabled ? damage : 0, enabled, requiresConfirmation: mode === "gambler" && enabled };
  });
}
