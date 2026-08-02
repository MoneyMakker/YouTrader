import assert from "node:assert/strict";
import { duplicateEditableRuleTemplate, validateEditableRuleTemplate } from "../src/propPass/tradingOs";
const template = Object.freeze({ id: "base", label: "Custom", effectiveDate: "2026-08-02", templateVersion: "v1", archived: false, disclaimer: "Verify these rules against your current prop-firm agreement." as const, challenge: { id: "base", effectiveDate: "2026-08-02", templateVersion: "v1", dailyLossLimitMinor: 10_000, maximumLossLimitMinor: 20_000, profitTargetMinor: 30_000, drawdownType: "static" as const, drawdownCalculation: "end_of_day" as const, maximumContracts: 2 }, live: { id: "base", weeklyLossLimitMinor: 10_000, postWithdrawalReserveMinor: 5_000 } });
assert.equal(validateEditableRuleTemplate(template).valid, true);
const duplicate = duplicateEditableRuleTemplate(template, { id: "copy", label: "Copy", effectiveDate: "2026-08-03", templateVersion: "v2" });
assert.equal(duplicate.challenge.templateVersion, "v2"); assert.equal(template.challenge.templateVersion, "v1");
console.log("prop-pass-rules-qa: PASS");
