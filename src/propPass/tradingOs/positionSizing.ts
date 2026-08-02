import { validateInstrumentSpec } from "./domain";
import type { MoneyMinor, TradePlanInput, TradingOsResult } from "./contracts";

export type PositionSizingInput = {
  plan: Pick<TradePlanInput, "instrument" | "stopDistance" | "stopUnit">;
  allowedRiskMinor: MoneyMinor | null;
  propMaximumContracts?: number | null;
  modeMaximumContracts?: number | null;
};

export type PositionSizingValues = {
  stopTicks: number | null;
  baseLossPerContractMinor: MoneyMinor | null;
  slippageLossPerContractMinor: MoneyMinor | null;
  commissionPerContractMinor: MoneyMinor | null;
  totalLossPerContractMinor: MoneyMinor | null;
  recommendedContracts: number | null;
  actualRiskMinor: MoneyMinor | null;
  unusedRiskMinor: MoneyMinor | null;
};

/** Conservative position sizing: contracts are always rounded down. */
export function calculatePositionSize(input: PositionSizingInput): TradingOsResult<PositionSizingValues> {
  const blank: PositionSizingValues = {
    stopTicks: null, baseLossPerContractMinor: null, slippageLossPerContractMinor: null,
    commissionPerContractMinor: null, totalLossPerContractMinor: null, recommendedContracts: null,
    actualRiskMinor: null, unusedRiskMinor: null,
  };
  const instrument = input.plan.instrument;
  const validation = validateInstrumentSpec(instrument);
  const missingInputs = [...validation.missingInputs];
  const reasons = [...validation.reasons];
  if (!instrument || input.plan.stopDistance == null || !input.plan.stopUnit || input.allowedRiskMinor == null) {
    if (input.plan.stopDistance == null) missingInputs.push("stop_distance");
    if (!input.plan.stopUnit) missingInputs.push("stop_unit");
    if (input.allowedRiskMinor == null) missingInputs.push("allowed_risk");
    return response("needs_input", blank, reasons, missingInputs);
  }
  if (!Number.isFinite(input.plan.stopDistance) || input.plan.stopDistance <= 0) return response("needs_input", blank, ["invalid_stop_distance"], []);
  if (!Number.isSafeInteger(input.allowedRiskMinor) || input.allowedRiskMinor < 0) return response("needs_input", blank, ["invalid_allowed_risk"], []);
  if (validation.reasons.length) return response("needs_input", blank, reasons, missingInputs);

  const stopTicks = input.plan.stopUnit === "ticks" ? input.plan.stopDistance : input.plan.stopDistance / instrument.tickSize;
  if (!Number.isFinite(stopTicks) || stopTicks <= 0) return response("needs_input", blank, ["invalid_stop_ticks"], []);
  const base = Math.ceil(stopTicks * instrument.tickValueMinor);
  const slippage = Math.ceil((instrument.defaultSlippageTicks ?? 0) * instrument.tickValueMinor);
  const commission = instrument.roundTripCommissionMinor ?? 0;
  const total = base + slippage + commission;
  if (!Number.isSafeInteger(total) || total <= 0) return response("needs_input", blank, ["invalid_loss_per_contract"], []);
  const cap = minPositive(input.propMaximumContracts, input.modeMaximumContracts, instrument.maximumSupportedContracts);
  const uncapped = Math.floor(input.allowedRiskMinor / total);
  const contracts = cap == null ? uncapped : Math.min(uncapped, cap);
  const actualRiskMinor = contracts * total;
  return response(
    contracts === 0 ? "risky" : "safe_to_take",
    { stopTicks, baseLossPerContractMinor: base, slippageLossPerContractMinor: slippage, commissionPerContractMinor: commission, totalLossPerContractMinor: total, recommendedContracts: contracts, actualRiskMinor, unusedRiskMinor: input.allowedRiskMinor - actualRiskMinor },
    contracts === 0 ? ["minimum_position_exceeds_current_risk_limit"] : [], [],
  );
}

function minPositive(...values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isSafeInteger(value) && value > 0);
  return valid.length ? Math.min(...valid) : null;
}

function response(status: TradingOsResult<PositionSizingValues>["status"], values: PositionSizingValues, reasons: string[], missingInputs: string[]): TradingOsResult<PositionSizingValues> {
  return { values, status, reasons, missingInputs, appliedHardLimits: [], relatedRuleIds: [] };
}
