/**
 * Numeric precision contract for Performance Intelligence (pi-metric-spec-v0).
 *
 * Internal representation:
 * - Money: integer minor units (no fractional currency in engine).
 * - Counts / sequences: integers.
 * - Ratios: integer micro-units (valueScaled), scale = PI_RATIO_SCALE (1e6).
 *   Display value = valueScaled / PI_RATIO_SCALE.
 *
 * Accumulation: left-to-right sum over chronologically ordered trades.
 * Division: integer scaled quotient via roundHalfAwayFromZero.
 * Rounding stage: only at ratio emission (never mid-accumulation for money).
 * Negative zero: normalized to +0 in valueScaled.
 * Median: sort ascending; odd → middle; even → mean of two middle via scaled int.
 * Dispersion (CV): stdev/mean as scaled ratio; sample stdev (n-1).
 * Undefined states: explicit RatioOrUndefined kinds — never NaN/Infinity.
 */

export const PI_RATIO_SCALE = 1_000_000 as const;
export const PI_RATIO_OUTPUT_DECIMALS = 6 as const;
export const PI_MONEY_SCALE = 1 as const; // already minor integers

export type PrecisionContract = typeof PRECISION_CONTRACT;

export const PRECISION_CONTRACT = {
  version: "pi-metric-spec-v0",
  money: {
    representation: "integer_minor_units",
    rounding: "none_in_engine",
  },
  ratios: {
    representation: "integer_scaled",
    scale: PI_RATIO_SCALE,
    roundingMode: "half_away_from_zero",
    roundingStage: "at_ratio_emission_only",
    outputDecimals: PI_RATIO_OUTPUT_DECIMALS,
    negativeZero: "normalized_to_positive_zero",
  },
  median: {
    odd: "middle_element",
    even: "mean_of_two_middle_via_scaled_integer",
  },
  stdev: {
    kind: "sample",
    formula: "sqrt(sum((x-mean)^2)/(n-1))",
  },
  serialization: {
    ratioValueField: "valueScaled",
    undefinedKinds: [
      "undefined_zero_loss",
      "undefined_zero_profit",
      "undefined_zero_denominator",
      "unavailable",
    ],
  },
} as const;

/** Round half away from zero to integer. */
export function roundHalfAwayFromZero(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n === 0 || Object.is(n, -0)) return 0;
  return n >= 0 ? Math.floor(n + 0.5) : Math.ceil(n - 0.5);
}

/** num/den → scaled integer ratio. */
export function ratioScaled(
  num: number,
  den: number,
): number {
  if (den === 0) return 0;
  return roundHalfAwayFromZero((num * PI_RATIO_SCALE) / den);
}

export function scaledToNumber(valueScaled: number): number {
  if (valueScaled === 0) return 0;
  return valueScaled / PI_RATIO_SCALE;
}

export function normalizeNegZeroScaled(valueScaled: number): number {
  return valueScaled === 0 ? 0 : valueScaled;
}
