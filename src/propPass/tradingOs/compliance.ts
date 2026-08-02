import type { TradingOsResult } from "./contracts";

export type ComplianceComponentId = "risk_per_trade" | "allowed_session" | "maximum_trades" | "stop_after_losses" | "position_size_stability" | "kill_switch" | "daily_plan" | "intervention_overrides" | "possible_revenge_pattern";
export const RULES_COMPLIANCE_WEIGHTS: Record<ComplianceComponentId, number> = { risk_per_trade: 20, allowed_session: 10, maximum_trades: 10, stop_after_losses: 10, position_size_stability: 10, kill_switch: 15, daily_plan: 15, intervention_overrides: 5, possible_revenge_pattern: 5 };
export type RulesComplianceValues = Readonly<{ score: number | null; componentScores: Record<ComplianceComponentId, number> | null; weights: Record<ComplianceComponentId, number>; strongestBehavior: ComplianceComponentId | null; primaryImprovementAction: string | null }>;

export function calculateRulesComplianceScore(input: { components: Partial<Record<ComplianceComponentId, number>> }): TradingOsResult<RulesComplianceValues> {
  const ids = Object.keys(RULES_COMPLIANCE_WEIGHTS) as ComplianceComponentId[];
  const missingInputs = ids.filter((id) => !validScore(input.components[id])).map((id) => `compliance_${id}`);
  const empty: RulesComplianceValues = { score: null, componentScores: null, weights: RULES_COMPLIANCE_WEIGHTS, strongestBehavior: null, primaryImprovementAction: null };
  if (missingInputs.length) return result("needs_input", empty, ["compliance_data_missing"], missingInputs);
  const scores = Object.fromEntries(ids.map((id) => [id, Math.floor(input.components[id]!)])) as Record<ComplianceComponentId, number>;
  const score = Math.floor(ids.reduce((sum, id) => sum + scores[id] * RULES_COMPLIANCE_WEIGHTS[id], 0) / 100);
  const strongest = ids.reduce((best, id) => scores[id] > scores[best] ? id : best, ids[0]);
  const weakest = ids.reduce((worst, id) => scores[id] < scores[worst] ? id : worst, ids[0]);
  return result("safe_to_take", { score, componentScores: scores, weights: RULES_COMPLIANCE_WEIGHTS, strongestBehavior: strongest, primaryImprovementAction: improvementFor(weakest) }, [], []);
}
function validScore(value: number | undefined): value is number { return value != null && Number.isFinite(value) && value >= 0 && value <= 100; }
function improvementFor(id: ComplianceComponentId): string { return ({ risk_per_trade: "Keep planned risk at or below the active per-trade cap.", allowed_session: "Take new trades only inside the configured session.", maximum_trades: "Stop when the frozen plan trade count is reached.", stop_after_losses: "Respect the configured stop-after-losses rule.", position_size_stability: "Keep contract size inside the frozen plan.", kill_switch: "Respect every Kill Switch lock until its configured reset.", daily_plan: "Create and follow an immutable Daily Plan before trading.", intervention_overrides: "Reduce non-hard intervention overrides.", possible_revenge_pattern: "Pause after consecutive losses before considering another trade." })[id]; }
function result(status: TradingOsResult<RulesComplianceValues>["status"], values: RulesComplianceValues, reasons: string[], missingInputs: string[]): TradingOsResult<RulesComplianceValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
