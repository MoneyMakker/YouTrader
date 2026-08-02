import type { TradingOsResult } from "./contracts";

export type PreservationComponentId =
  | "current_drawdown"
  | "daily_risk_adherence"
  | "weekly_risk_adherence"
  | "consecutive_loss_control"
  | "position_size_stability"
  | "hard_rule_compliance"
  | "kill_switch_events"
  | "recovery_mode_adherence";

export type CapitalPreservationInput = {
  /** Each value is a deterministic 0–100 compliance subscore from persisted account/trade facts. */
  components: Partial<Record<PreservationComponentId, number>>;
};

export type CapitalPreservationValues = {
  score: number | null;
  level: "strong" | "stable" | "watch" | "at_risk" | null;
  weights: Record<PreservationComponentId, number>;
  componentScores: Record<PreservationComponentId, number> | null;
  strongestFactor: PreservationComponentId | null;
  primaryImprovementAction: string | null;
};

/**
 * Preservation is intentionally a risk-discipline score, not a profitability score.
 * Weights total 100: drawdown 20, daily 15, weekly 15, loss control 10,
 * size stability 10, hard-rule compliance 20, Kill Switch 5, Recovery Mode 5.
 */
export const CAPITAL_PRESERVATION_WEIGHTS: Record<PreservationComponentId, number> = {
  current_drawdown: 20,
  daily_risk_adherence: 15,
  weekly_risk_adherence: 15,
  consecutive_loss_control: 10,
  position_size_stability: 10,
  hard_rule_compliance: 20,
  kill_switch_events: 5,
  recovery_mode_adherence: 5,
};

const COMPONENT_IDS = Object.keys(CAPITAL_PRESERVATION_WEIGHTS) as PreservationComponentId[];

export function calculateCapitalPreservationScore(input: CapitalPreservationInput): TradingOsResult<CapitalPreservationValues> {
  const missingInputs = COMPONENT_IDS.filter((id) => !isScore(input.components[id])).map((id) => `preservation_${id}`);
  const empty = emptyValues();
  if (missingInputs.length > 0) return result("needs_input", empty, ["preservation_data_missing"], missingInputs);

  const componentScores = Object.fromEntries(COMPONENT_IDS.map((id) => [id, Math.floor(input.components[id]!)])) as Record<PreservationComponentId, number>;
  const score = Math.floor(COMPONENT_IDS.reduce((sum, id) => sum + componentScores[id] * CAPITAL_PRESERVATION_WEIGHTS[id], 0) / 100);
  const strongestFactor = COMPONENT_IDS.reduce((best, id) => componentScores[id] > componentScores[best] ? id : best, COMPONENT_IDS[0]);
  const weakestFactor = COMPONENT_IDS.reduce((worst, id) => componentScores[id] < componentScores[worst] ? id : worst, COMPONENT_IDS[0]);
  const level = score >= 85 ? "strong" : score >= 70 ? "stable" : score >= 50 ? "watch" : "at_risk";
  return result("safe_to_take", {
    score,
    level,
    weights: CAPITAL_PRESERVATION_WEIGHTS,
    componentScores,
    strongestFactor,
    primaryImprovementAction: improvementFor(weakestFactor),
  }, [], []);
}

function isScore(value: number | undefined): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100; }
function emptyValues(): CapitalPreservationValues { return { score: null, level: null, weights: CAPITAL_PRESERVATION_WEIGHTS, componentScores: null, strongestFactor: null, primaryImprovementAction: null }; }
function improvementFor(id: PreservationComponentId): string {
  return ({
    current_drawdown: "Reduce risk until drawdown room improves.", daily_risk_adherence: "Keep each trade inside today’s risk budget.", weekly_risk_adherence: "Protect the remaining weekly loss room.",
    consecutive_loss_control: "Follow the configured stop-after-losses rule.", position_size_stability: "Keep position size within the planned range.", hard_rule_compliance: "Resolve hard-rule violations before taking another trade.",
    kill_switch_events: "Respect each Kill Switch stop for the configured session.", recovery_mode_adherence: "Keep Recovery Mode limits in force until its exit criteria are met.",
  })[id];
}
function result(status: TradingOsResult<CapitalPreservationValues>["status"], values: CapitalPreservationValues, reasons: string[], missingInputs: string[]): TradingOsResult<CapitalPreservationValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
