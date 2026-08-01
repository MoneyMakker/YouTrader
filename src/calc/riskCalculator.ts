/**
 * Pure futures risk / P&L calculator helpers (Calculator tab).
 * No React Native imports — unit-testable.
 */

export type CalcMode = "ticks" | "points";

export type CalcInstrument = {
  tickSize: number;
  tickValue: number;
  name?: string;
};

export type CalcInputs = {
  mode: CalcMode;
  amount: string;
  contracts: string;
  stopLoss: string;
  takeProfit: string;
  balance: string;
  riskPct: string;
  instrument: CalcInstrument;
};

export type CalcResults = {
  unitValue: number;
  resultUsd: number;
  riskUsd: number;
  rewardUsd: number;
  riskReward: number;
  maxRiskUsd: number;
  isFinite: boolean;
  hasNaN: boolean;
  errors: string[];
};

function parseFiniteNumber(raw: string): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return 0;
  if (!/^-?\d*\.?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function computeCalculatorResults(input: CalcInputs): CalcResults {
  const errors: string[] = [];
  const tickSize = input.instrument.tickSize;
  const tickValue = input.instrument.tickValue;
  if (!(tickSize > 0) || !(tickValue > 0)) {
    errors.push("invalid_instrument");
  }

  const amount = parseFiniteNumber(input.amount);
  const contracts = parseFiniteNumber(input.contracts);
  const stopLoss = parseFiniteNumber(input.stopLoss);
  const takeProfit = parseFiniteNumber(input.takeProfit);
  const balance = parseFiniteNumber(input.balance);
  const riskPct = parseFiniteNumber(input.riskPct);

  if (amount == null) errors.push("invalid_amount");
  if (contracts == null) errors.push("invalid_contracts");
  if (stopLoss == null) errors.push("invalid_stop_loss");
  if (takeProfit == null) errors.push("invalid_take_profit");
  if (balance == null) errors.push("invalid_balance");
  if (riskPct == null) errors.push("invalid_risk_pct");

  const a = amount ?? NaN;
  const c = contracts ?? NaN;
  const sl = stopLoss ?? NaN;
  const tp = takeProfit ?? NaN;
  const bal = balance ?? NaN;
  const pct = riskPct ?? NaN;

  if (c < 0) errors.push("negative_contracts");
  if (sl < 0) errors.push("negative_stop_loss");
  if (tp < 0) errors.push("negative_take_profit");
  if (bal < 0) errors.push("negative_balance");
  if (pct < 0) errors.push("negative_risk_pct");

  const unitValue =
    input.mode === "ticks" ? tickValue : tickSize > 0 ? tickValue / tickSize : NaN;
  const resultUsd = a * unitValue * c;
  const riskUsd = sl * unitValue * c;
  const rewardUsd = tp * unitValue * c;
  const riskReward = riskUsd ? rewardUsd / riskUsd : 0;
  const maxRiskUsd = (bal * pct) / 100;

  const values = [unitValue, resultUsd, riskUsd, rewardUsd, riskReward, maxRiskUsd];
  const hasNaN = values.some((v) => Number.isNaN(v));
  const isFinite = values.every((v) => Number.isFinite(v));

  if (hasNaN) errors.push("nan_result");
  if (!isFinite) errors.push("non_finite_result");

  return {
    unitValue,
    resultUsd,
    riskUsd,
    rewardUsd,
    riskReward,
    maxRiskUsd,
    isFinite,
    hasNaN,
    errors,
  };
}

export function formatCalcUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
