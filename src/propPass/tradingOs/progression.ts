import type { MoneyMinor, TradingOsResult } from "./contracts";

export type PositionSizeStage = "base" | "reduced" | "recovery" | "eligible_to_scale" | "scaled" | "locked";
export type PositionSizeProgressionInput = {
  previousStage: PositionSizeStage | null;
  allowedContracts: number | null;
  allowedRiskPerTradeMinor: MoneyMinor | null;
  recoveryModeActive: boolean;
  killSwitchActive: boolean;
  reducedRiskRequired: boolean;
  scalingEligible: boolean;
  scaleAlreadyApplied: boolean;
  occurredAt: string | null;
  relatedRuleId: string | null;
};
export type PositionSizeTransition = { previousStage: PositionSizeStage | null; newStage: PositionSizeStage; reason: string; allowedContracts: number; allowedRiskPerTradeMinor: MoneyMinor; timestamp: string; relatedRuleId: string | null };
export type PositionSizeProgressionValues = { stage: PositionSizeStage | null; allowedContracts: number; allowedRiskPerTradeMinor: MoneyMinor; transition: PositionSizeTransition | null; };

export function evaluatePositionSizeProgression(input: PositionSizeProgressionInput): TradingOsResult<PositionSizeProgressionValues> {
  if (input.allowedContracts == null || input.allowedRiskPerTradeMinor == null || input.occurredAt == null || !Number.isInteger(input.allowedContracts) || input.allowedContracts < 0 || input.allowedRiskPerTradeMinor < 0) return result("needs_input", empty(), ["position_progression_setup_missing_or_invalid"], ["position_progression_allowed_size_or_timestamp"]);
  const stage: PositionSizeStage = input.killSwitchActive || input.allowedContracts === 0 || input.allowedRiskPerTradeMinor === 0 ? "locked" : input.recoveryModeActive ? "recovery" : input.reducedRiskRequired ? "reduced" : input.scalingEligible && input.scaleAlreadyApplied ? "scaled" : input.scalingEligible ? "eligible_to_scale" : "base";
  const transition = input.previousStage === stage ? null : { previousStage: input.previousStage, newStage: stage, reason: reasonFor(stage), allowedContracts: input.allowedContracts, allowedRiskPerTradeMinor: input.allowedRiskPerTradeMinor, timestamp: input.occurredAt, relatedRuleId: input.relatedRuleId };
  return result(stage === "locked" ? "stop_trading" : "safe_to_take", { stage, allowedContracts: input.allowedContracts, allowedRiskPerTradeMinor: input.allowedRiskPerTradeMinor, transition }, stage === "locked" ? ["position_size_locked"] : [], []);
}

function reasonFor(stage: PositionSizeStage): string { return ({ base: "Normal configured size is active.", reduced: "A configured risk-reduction rule is active.", recovery: "Recovery Mode limits are active.", eligible_to_scale: "All configured scaling criteria are met; apply only the next permitted step.", scaled: "A previously approved scaling step is active within hard caps.", locked: "A hard stop or zero-safe-risk limit prevents another position." })[stage]; }
function empty(): PositionSizeProgressionValues { return { stage: null, allowedContracts: 0, allowedRiskPerTradeMinor: 0, transition: null }; }
function result(status: TradingOsResult<PositionSizeProgressionValues>["status"], values: PositionSizeProgressionValues, reasons: string[], missingInputs: string[]): TradingOsResult<PositionSizeProgressionValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
