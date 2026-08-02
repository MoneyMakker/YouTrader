import type { MoneyMinor } from "./contracts";

export type FinancialRounding = "floor" | "ceil" | "half_away_from_zero";
export type DecimalInput = number | string;

export class FinancialMathError extends Error {
  constructor(readonly code: "invalid_decimal" | "invalid_minor" | "division_by_zero" | "unsafe_result") {
    super(code);
    this.name = "FinancialMathError";
  }
}

type Fraction = Readonly<{ numerator: bigint; denominator: bigint }>;

export function moneyAdd(...values: MoneyMinor[]): MoneyMinor {
  return safeMinor(values.reduce((sum, value) => sum + minorBigInt(value), 0n));
}

export function moneySubtract(left: MoneyMinor, right: MoneyMinor): MoneyMinor {
  return safeMinor(minorBigInt(left) - minorBigInt(right));
}

export function moneyMultiplyInteger(value: MoneyMinor, multiplier: number): MoneyMinor {
  if (!Number.isSafeInteger(multiplier)) throw new FinancialMathError("invalid_decimal");
  return safeMinor(minorBigInt(value) * BigInt(multiplier));
}

export function moneyMultiplyDecimal(
  value: MoneyMinor,
  multiplier: DecimalInput,
  rounding: FinancialRounding,
): MoneyMinor {
  const factor = decimalFraction(multiplier);
  return safeMinor(roundFraction(minorBigInt(value) * factor.numerator, factor.denominator, rounding));
}

export function moneyMultiplyDecimalRatio(
  value: MoneyMinor,
  numerator: DecimalInput,
  denominator: DecimalInput,
  rounding: FinancialRounding,
): MoneyMinor {
  const top = decimalFraction(numerator);
  const bottom = decimalFraction(denominator);
  if (bottom.numerator === 0n) throw new FinancialMathError("division_by_zero");
  return safeMinor(roundFraction(
    minorBigInt(value) * top.numerator * bottom.denominator,
    top.denominator * bottom.numerator,
    rounding,
  ));
}

export function moneyApplyBasisPointsFloor(value: MoneyMinor, basisPoints: number): MoneyMinor {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) throw new FinancialMathError("invalid_decimal");
  return safeMinor(floorDivide(minorBigInt(value) * BigInt(basisPoints), 10_000n));
}

export function ratioBasisPointsFloor(numerator: MoneyMinor, denominator: MoneyMinor): number {
  if (denominator <= 0) throw new FinancialMathError("division_by_zero");
  return safeInteger(floorDivide(minorBigInt(numerator) * 10_000n, minorBigInt(denominator)));
}

export function ratioScaledFloor(numerator: MoneyMinor, denominator: MoneyMinor, scale: number): number {
  if (denominator <= 0) throw new FinancialMathError("division_by_zero");
  if (!Number.isSafeInteger(scale) || scale <= 0) throw new FinancialMathError("invalid_decimal");
  return safeInteger(floorDivide(minorBigInt(numerator) * BigInt(scale), minorBigInt(denominator)));
}

export function contractFloor(allowedRiskMinor: MoneyMinor, lossPerContractMinor: MoneyMinor): number {
  if (allowedRiskMinor < 0 || lossPerContractMinor <= 0) throw new FinancialMathError("invalid_minor");
  return safeInteger(floorDivide(minorBigInt(allowedRiskMinor), minorBigInt(lossPerContractMinor)));
}

export function moneyMin(...values: MoneyMinor[]): MoneyMinor {
  if (!values.length) throw new FinancialMathError("invalid_minor");
  values.forEach(minorBigInt);
  return Math.min(...values);
}

export function moneyMax(...values: MoneyMinor[]): MoneyMinor {
  if (!values.length) throw new FinancialMathError("invalid_minor");
  values.forEach(minorBigInt);
  return Math.max(...values);
}

export function moneyClampNonNegative(value: MoneyMinor): MoneyMinor {
  minorBigInt(value);
  return value < 0 ? 0 : value;
}

export function moneyCompare(left: MoneyMinor, right: MoneyMinor): -1 | 0 | 1 {
  const a = minorBigInt(left);
  const b = minorBigInt(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function moneyFromMajor(value: DecimalInput, currencyScale = 100): MoneyMinor {
  if (!Number.isSafeInteger(currencyScale) || currencyScale <= 0) throw new FinancialMathError("invalid_decimal");
  const fraction = decimalFraction(value);
  return safeMinor(roundFraction(fraction.numerator * BigInt(currencyScale), fraction.denominator, "half_away_from_zero"));
}

export function serializeMoneyMinor(value: MoneyMinor): string {
  return minorBigInt(value).toString();
}

export function deserializeMoneyMinor(value: string): MoneyMinor {
  if (!/^-?\d+$/.test(value)) throw new FinancialMathError("invalid_minor");
  return safeMinor(BigInt(value));
}

export function formatMoneyMinor(value: MoneyMinor, currencyScale = 100): string {
  const raw = minorBigInt(value);
  const sign = raw < 0n ? "-" : "";
  const absolute = raw < 0n ? -raw : raw;
  const scale = BigInt(currencyScale);
  const decimals = Math.round(Math.log10(currencyScale));
  if (10 ** decimals !== currencyScale) throw new FinancialMathError("invalid_decimal");
  return `${sign}${absolute / scale}.${(absolute % scale).toString().padStart(decimals, "0")}`;
}

export function decimalRatioToNumber(numerator: DecimalInput, denominator: DecimalInput): number {
  const top = decimalFraction(numerator);
  const bottom = decimalFraction(denominator);
  if (bottom.numerator === 0n) throw new FinancialMathError("division_by_zero");
  return Number(top.numerator * bottom.denominator) / Number(top.denominator * bottom.numerator);
}

function decimalFraction(value: DecimalInput): Fraction {
  const source = typeof value === "number" ? numberSource(value) : value.trim();
  const match = source.match(/^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) throw new FinancialMathError("invalid_decimal");
  const sign = match[1] === "-" ? -1n : 1n;
  const fractionDigits = match[3] ?? "";
  const exponent = Number(match[4] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) throw new FinancialMathError("invalid_decimal");
  const digits = BigInt(`${match[2]}${fractionDigits}`) * sign;
  const scalePower = fractionDigits.length - exponent;
  return scalePower >= 0
    ? normalize(digits, 10n ** BigInt(scalePower))
    : normalize(digits * (10n ** BigInt(-scalePower)), 1n);
}

function numberSource(value: number): string {
  if (!Number.isFinite(value)) throw new FinancialMathError("invalid_decimal");
  return Object.is(value, -0) ? "0" : value.toString();
}

function normalize(numerator: bigint, denominator: bigint): Fraction {
  if (denominator === 0n) throw new FinancialMathError("division_by_zero");
  const sign = denominator < 0n ? -1n : 1n;
  const gcd = greatestCommonDivisor(numerator, denominator);
  return { numerator: numerator / gcd * sign, denominator: denominator / gcd * sign };
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

function roundFraction(numerator: bigint, denominator: bigint, rounding: FinancialRounding): bigint {
  if (denominator === 0n) throw new FinancialMathError("division_by_zero");
  if (rounding === "floor") return floorDivide(numerator, denominator);
  if (rounding === "ceil") return -floorDivide(-numerator, denominator);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return quotient;
  const absRemainder = remainder < 0n ? -remainder : remainder;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  return absRemainder * 2n >= absDenominator ? quotient + (numerator * denominator > 0n ? 1n : -1n) : quotient;
}

function floorDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new FinancialMathError("division_by_zero");
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder !== 0n && (numerator < 0n) !== (denominator < 0n) ? quotient - 1n : quotient;
}

function minorBigInt(value: MoneyMinor): bigint {
  if (!Number.isSafeInteger(value)) throw new FinancialMathError("invalid_minor");
  return BigInt(value);
}

function safeMinor(value: bigint): MoneyMinor { return safeInteger(value); }
function safeInteger(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new FinancialMathError("unsafe_result");
  return result;
}
