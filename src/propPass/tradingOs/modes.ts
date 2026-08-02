import { RISK_MODE_POLICIES, type MoneyMinor, type RiskRooms, type TradingRiskMode } from "./contracts";
import { calculateAllowedRisk } from "./domain";
export type ModeComparison = { mode: TradingRiskMode; highRisk: boolean; riskPerTradeMinor: MoneyMinor; maximumDailyRiskMinor: MoneyMinor | null; maximumTrades: number; stopAfterLosses: number; projectedRemainingBufferMinor: MoneyMinor | null; maximumProjectedDamageMinor: MoneyMinor; enabled: boolean; requiresConfirmation: boolean };
export function compareRiskModes(rooms: RiskRooms, context: "challenge" | "live", lossPerContractMinor: MoneyMinor | null): ModeComparison[] {
  return (["calm", "balanced", "gambler"] as const).map((mode) => {
    const allowed = calculateAllowedRisk(RISK_MODE_POLICIES[mode], rooms, context); const risk = allowed.values.allowedRiskMinor;
    const daily = allowed.values.safeBudgetMinor; const trades = risk > 0 && daily != null ? Math.max(1, Math.floor(daily / risk)) : 0;
    const damage = Math.min(daily ?? 0, risk * (mode === "gambler" ? 2 : 1)); const enabled = risk > 0 && (mode !== "gambler" || (daily ?? 0) >= risk * 2);
    return { mode, highRisk: mode === "gambler", riskPerTradeMinor: enabled ? risk : 0, maximumDailyRiskMinor: daily, maximumTrades: enabled ? trades : 0, stopAfterLosses: mode === "gambler" ? 1 : 2, projectedRemainingBufferMinor: daily == null ? null : Math.max(0, daily - damage), maximumProjectedDamageMinor: enabled ? damage : 0, enabled, requiresConfirmation: mode === "gambler" && enabled };
  });
}
