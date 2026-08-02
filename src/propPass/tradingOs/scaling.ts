import type { MoneyMinor, TradingOsResult } from "./contracts";
import { moneyAdd, moneyMin } from "./financialMath";

export type ScalingRecommendationInput = {
  currentRiskPerTradeMinor: MoneyMinor | null;
  currentContracts: number | null;
  maximumAllowedRiskPerTradeMinor: MoneyMinor | null;
  maximumAllowedContracts: number | null;
  userMaximumRiskPerTradeMinor: MoneyMinor | null;
  riskStepMinor: MoneyMinor | null;
  requiresNewEquityHigh: boolean | null;
  atNewEquityHigh: boolean | null;
  minimumProfitableSessions: number | null;
  completedCompliantProfitableSessions: number | null;
  currentDrawdownBps: number | null;
  maximumAcceptableDrawdownBps: number | null;
  capitalPreservationScore: number | null;
  minimumPreservationScore: number | null;
  stablePositionSizing: boolean | null;
  recoveryModeActive: boolean;
  killSwitchActive: boolean;
  weeklyRiskRoomPositive: boolean | null;
};

export type ScalingRecommendationValues = {
  eligible: boolean;
  currentRiskPerTradeMinor: MoneyMinor | null;
  currentContracts: number | null;
  recommendedNextRiskPerTradeMinor: MoneyMinor;
  recommendedNextContracts: number;
  maximumAllowedRiskPerTradeMinor: MoneyMinor | null;
  maximumAllowedContracts: number | null;
  passedCriteria: string[];
  blockers: string[];
  earliestSafeReassessment: string | null;
};

export function recommendScaling(input: ScalingRecommendationInput): TradingOsResult<ScalingRecommendationValues> {
  const required = ["currentRiskPerTradeMinor", "currentContracts", "maximumAllowedRiskPerTradeMinor", "maximumAllowedContracts", "userMaximumRiskPerTradeMinor", "riskStepMinor", "requiresNewEquityHigh", "atNewEquityHigh", "minimumProfitableSessions", "completedCompliantProfitableSessions", "currentDrawdownBps", "maximumAcceptableDrawdownBps", "capitalPreservationScore", "minimumPreservationScore", "stablePositionSizing", "weeklyRiskRoomPositive"] as const;
  const missingInputs = required.filter((field) => input[field] == null).map((field) => `scaling_${field}`);
  const empty = emptyValues(input);
  if (missingInputs.length || !valid(input)) return result("needs_input", empty, ["scaling_setup_missing_or_invalid"], missingInputs.length ? missingInputs : ["scaling_configuration"]);
  const blockers: string[] = [];
  if (input.requiresNewEquityHigh && !input.atNewEquityHigh) blockers.push("new_equity_high_required");
  if (input.completedCompliantProfitableSessions! < input.minimumProfitableSessions!) blockers.push("minimum_compliant_profitable_sessions_not_met");
  if (input.currentDrawdownBps! > input.maximumAcceptableDrawdownBps!) blockers.push("drawdown_above_scaling_threshold");
  if (input.capitalPreservationScore! < input.minimumPreservationScore!) blockers.push("preservation_score_below_threshold");
  if (!input.stablePositionSizing) blockers.push("position_size_not_stable");
  if (!input.weeklyRiskRoomPositive) blockers.push("weekly_risk_room_exhausted");
  if (input.recoveryModeActive) blockers.push("recovery_mode_active");
  if (input.killSwitchActive) blockers.push("kill_switch_active");
  const passedCriteria = blockers.length ? [] : ["equity_high_requirement_met", "profitable_sessions_requirement_met", "drawdown_within_threshold", "preservation_score_requirement_met", "position_size_stable", "weekly_risk_room_available", "recovery_mode_inactive", "kill_switch_inactive"];
  const eligible = blockers.length === 0 && input.currentContracts! < input.maximumAllowedContracts! && input.currentRiskPerTradeMinor! < moneyMin(input.maximumAllowedRiskPerTradeMinor!, input.userMaximumRiskPerTradeMinor!);
  if (!eligible && blockers.length === 0) blockers.push("already_at_configured_hard_cap");
  const riskCap = moneyMin(input.maximumAllowedRiskPerTradeMinor!, input.userMaximumRiskPerTradeMinor!);
  const recommendedNextRiskPerTradeMinor = eligible ? moneyMin(riskCap, moneyAdd(input.currentRiskPerTradeMinor!, input.riskStepMinor!)) : input.currentRiskPerTradeMinor!;
  const recommendedNextContracts = eligible ? Math.min(input.maximumAllowedContracts!, input.currentContracts! + 1) : input.currentContracts!;
  return result("safe_to_take", { eligible, currentRiskPerTradeMinor: input.currentRiskPerTradeMinor!, currentContracts: input.currentContracts!, recommendedNextRiskPerTradeMinor, recommendedNextContracts, maximumAllowedRiskPerTradeMinor: riskCap, maximumAllowedContracts: input.maximumAllowedContracts!, passedCriteria, blockers, earliestSafeReassessment: eligible ? "After the next completed, rule-compliant session." : reassessment(input) }, blockers, []);
}

function valid(input: ScalingRecommendationInput): boolean { return input.currentRiskPerTradeMinor! >= 0 && input.maximumAllowedRiskPerTradeMinor! >= 0 && input.userMaximumRiskPerTradeMinor! >= 0 && input.riskStepMinor! > 0 && Number.isInteger(input.currentContracts!) && input.currentContracts! >= 0 && Number.isInteger(input.maximumAllowedContracts!) && input.maximumAllowedContracts! >= 0 && Number.isInteger(input.minimumProfitableSessions!) && input.minimumProfitableSessions! > 1 && Number.isInteger(input.completedCompliantProfitableSessions!) && input.completedCompliantProfitableSessions! >= 0 && input.currentDrawdownBps! >= 0 && input.maximumAcceptableDrawdownBps! >= 0 && input.capitalPreservationScore! >= 0 && input.capitalPreservationScore! <= 100 && input.minimumPreservationScore! >= 0 && input.minimumPreservationScore! <= 100; }
function reassessment(input: ScalingRecommendationInput): string { const sessions = Math.max(0, input.minimumProfitableSessions! - input.completedCompliantProfitableSessions!); return sessions ? `After ${sessions} more compliant profitable session(s) and all current hard caps remain clear.` : "When the current blocker is resolved and all hard caps remain clear."; }
function emptyValues(input: ScalingRecommendationInput): ScalingRecommendationValues { return { eligible: false, currentRiskPerTradeMinor: input.currentRiskPerTradeMinor, currentContracts: input.currentContracts, recommendedNextRiskPerTradeMinor: 0, recommendedNextContracts: 0, maximumAllowedRiskPerTradeMinor: input.maximumAllowedRiskPerTradeMinor, maximumAllowedContracts: input.maximumAllowedContracts, passedCriteria: [], blockers: [], earliestSafeReassessment: null }; }
function result(status: TradingOsResult<ScalingRecommendationValues>["status"], values: ScalingRecommendationValues, reasons: string[], missingInputs: string[]): TradingOsResult<ScalingRecommendationValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
