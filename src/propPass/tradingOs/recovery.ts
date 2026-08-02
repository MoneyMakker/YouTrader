import type { MoneyMinor, TradingOsResult } from "./contracts";

export type RecoveryModeInput = {
  currentEquityMinor: MoneyMinor | null;
  equityHighMinor: MoneyMinor | null;
  normalRiskPerTradeMinor: MoneyMinor | null;
  normalMaximumContracts: number | null;
  activationDrawdownBps: number | null;
  recoveryRiskBps: number | null;
  minimumCompliantProfitableSessions: number | null;
  completedCompliantProfitableSessions: number | null;
};

export type RecoveryModeValues = {
  active: boolean;
  belowEquityHighBps: number | null;
  normalRiskPerTradeMinor: MoneyMinor | null;
  reducedRiskPerTradeMinor: MoneyMinor;
  normalMaximumContracts: number | null;
  reducedMaximumContracts: number;
  activationReason: string | null;
  exitCriteria: string[];
  exitProgress: { completedCompliantProfitableSessions: number; requiredCompliantProfitableSessions: number } | null;
  scalingDisabled: boolean;
  gamblerDisabled: boolean;
};

export function evaluateRecoveryMode(input: RecoveryModeInput): TradingOsResult<RecoveryModeValues> {
  const fields = ["currentEquityMinor", "equityHighMinor", "normalRiskPerTradeMinor", "normalMaximumContracts", "activationDrawdownBps", "recoveryRiskBps", "minimumCompliantProfitableSessions", "completedCompliantProfitableSessions"] as const;
  const missingInputs = fields.filter((field) => input[field] == null).map((field) => `recovery_${field}`);
  const empty = emptyValues();
  if (missingInputs.length > 0 || !isValid(input)) return result("needs_input", empty, ["recovery_setup_missing_or_invalid"], missingInputs.length ? missingInputs : ["recovery_configuration"]);

  const belowEquityHighBps = Math.max(0, Math.floor(((input.equityHighMinor! - input.currentEquityMinor!) * 10_000) / Math.max(1, input.equityHighMinor!)));
  const active = belowEquityHighBps >= input.activationDrawdownBps!;
  const reducedRiskPerTradeMinor = active ? Math.floor(input.normalRiskPerTradeMinor! * input.recoveryRiskBps! / 10_000) : input.normalRiskPerTradeMinor!;
  const reducedMaximumContracts = active ? Math.floor(input.normalMaximumContracts! * input.recoveryRiskBps! / 10_000) : input.normalMaximumContracts!;
  const completed = input.completedCompliantProfitableSessions!;
  const required = input.minimumCompliantProfitableSessions!;
  return result("safe_to_take", {
    active,
    belowEquityHighBps,
    normalRiskPerTradeMinor: input.normalRiskPerTradeMinor!,
    reducedRiskPerTradeMinor,
    normalMaximumContracts: input.normalMaximumContracts!,
    reducedMaximumContracts,
    activationReason: active ? `Equity is ${belowEquityHighBps} bps below its recorded high; the Recovery Mode threshold is ${input.activationDrawdownBps} bps.` : null,
    exitCriteria: ["Reach a new equity high.", `Complete ${required} profitable sessions with rule compliance.`],
    exitProgress: { completedCompliantProfitableSessions: Math.min(completed, required), requiredCompliantProfitableSessions: required },
    scalingDisabled: active,
    gamblerDisabled: active,
  }, active ? ["recovery_mode_active"] : [], []);
}

function isValid(input: RecoveryModeInput): boolean {
  return input.currentEquityMinor! >= 0 && input.equityHighMinor! > 0 && input.normalRiskPerTradeMinor! >= 0 && Number.isInteger(input.normalMaximumContracts!) && input.normalMaximumContracts! >= 0 && input.activationDrawdownBps! >= 0 && input.activationDrawdownBps! <= 10_000 && input.recoveryRiskBps! >= 0 && input.recoveryRiskBps! <= 10_000 && Number.isInteger(input.minimumCompliantProfitableSessions!) && input.minimumCompliantProfitableSessions! > 1 && Number.isInteger(input.completedCompliantProfitableSessions!) && input.completedCompliantProfitableSessions! >= 0;
}
function emptyValues(): RecoveryModeValues { return { active: false, belowEquityHighBps: null, normalRiskPerTradeMinor: null, reducedRiskPerTradeMinor: 0, normalMaximumContracts: null, reducedMaximumContracts: 0, activationReason: null, exitCriteria: [], exitProgress: null, scalingDisabled: false, gamblerDisabled: false }; }
function result(status: TradingOsResult<RecoveryModeValues>["status"], values: RecoveryModeValues, reasons: string[], missingInputs: string[]): TradingOsResult<RecoveryModeValues> { return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] }; }
