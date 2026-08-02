import assert from "node:assert/strict";
import {
  FinancialMathError,
  contractFloor,
  deserializeMoneyMinor,
  formatMoneyMinor,
  moneyAdd,
  moneyApplyBasisPointsFloor,
  moneyFromMajor,
  moneyMultiplyDecimal,
  moneyMultiplyDecimalRatio,
  moneySubtract,
  serializeMoneyMinor,
} from "../src/propPass/tradingOs/index";

assert.equal(moneyAdd(moneyFromMajor("0.1"), moneyFromMajor("0.2")), 30, "0.1 + 0.2 must equal exactly 30 minor units");
assert.equal(moneyAdd(moneyFromMajor("0.125"), moneyFromMajor("0.125")), 26, "fractional commissions use explicit half-away currency rounding per recorded charge");
assert.equal(moneyMultiplyDecimal(125, "0.25", "ceil"), 32, "fractional tick risk rounds conservatively upward");
assert.equal(moneyMultiplyDecimalRatio(125, "1.25", "0.25", "ceil"), 625);
assert.equal(moneyApplyBasisPointsFloor(101, 5_000), 50, "risk allocation rounds down");
assert.equal(contractFloor(999, 250), 3, "contracts never round upward");
assert.equal(contractFloor(1_000, 250), 4, "exact boundary is preserved");
assert.equal(moneySubtract(0, 1), -1);
assert.equal(formatMoneyMinor(-1), "-0.01");
assert.equal(deserializeMoneyMinor(serializeMoneyMinor(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);

let overflow: unknown;
try { moneyAdd(Number.MAX_SAFE_INTEGER, 1); } catch (error) { overflow = error; }
assert.ok(overflow instanceof FinancialMathError);
assert.equal((overflow as FinancialMathError).code, "unsafe_result");

let invalid: unknown;
try { moneyFromMajor(Number.NaN); } catch (error) { invalid = error; }
assert.ok(invalid instanceof FinancialMathError);

console.log("prop-pass-financial-math-qa: PASS");
