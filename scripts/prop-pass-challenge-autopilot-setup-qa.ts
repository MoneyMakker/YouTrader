import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  AUTOPILOT_NEEDS_INPUT_FIELDS,
  AUTOPILOT_PERSISTED_FIELDS,
  buildAutopilotRuleSnapshot,
  draftFromTemplate,
  parseMajorToMinor,
} from "../src/propPass/challengeAutopilotSetup";
import { listPropOsInternalTemplates } from "../src/propOs/templates/index";

const template = listPropOsInternalTemplates()[0]!;
const size = template.supportedAccountSizesMinor[0]!;
const draft = draftFromTemplate(template, size);
assert.ok(draft, "verified template must produce an editable draft");

assert.equal(parseMajorToMinor("50000.01"), 5_000_001);
assert.equal(parseMajorToMinor("50000,01"), 5_000_001);
assert.equal(parseMajorToMinor("0.1"), 10);
assert.equal(parseMajorToMinor("1.001"), null);
assert.equal(parseMajorToMinor("1e3"), null);
assert.equal(parseMajorToMinor("-1"), null);

const built = buildAutopilotRuleSnapshot({
  template,
  accountSize: "50000.01",
  draft: {
    ...draft!,
    profitTarget: "3000.11",
    dailyLossLimit: "1000.22",
    maximumLossLimit: "2000.33",
    minimumTradingDays: "5",
    maximumContracts: "7",
    drawdownKind: "trailingIntraday",
    timezone: "America/Chicago",
  },
});
assert.equal(built.ok, true);
if (built.ok) {
  assert.equal(built.accountSizeMinor, 5_000_001);
  assert.equal(built.ruleSnapshot.profitTargetMinor, 300_011);
  assert.equal(built.ruleSnapshot.dailyLossLimitMinor, 100_022);
  assert.equal(built.ruleSnapshot.drawdown.amountMinor, 200_033);
  assert.equal(built.ruleSnapshot.minimumTradingDays, 5);
  assert.equal(built.ruleSnapshot.maxContracts, 7);
  assert.equal(built.ruleSnapshot.drawdown.kind, "trailingIntraday");
  assert.equal(built.ruleSnapshot.intradayRequiresEquityStream, true);
  assert.equal(built.ruleSnapshot.firmTimezone, "America/Chicago");
}

assert.ok(AUTOPILOT_PERSISTED_FIELDS.includes("maximum_contracts"));
assert.ok(AUTOPILOT_NEEDS_INPUT_FIELDS.includes("risk_mode"));
assert.ok(AUTOPILOT_NEEDS_INPUT_FIELDS.includes("preferred_instrument"));
assert.ok(AUTOPILOT_NEEDS_INPUT_FIELDS.includes("payout_threshold"));

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, "src/propPass/PropPassOnboardingFlow.tsx"),
  "utf8",
);
assert.match(source, /type WizardStep = 0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7/);
assert.match(source, /accountType === "live"/);
assert.match(source, /disabled=\{accountType === "live"\}/);

const warning = "Verify these rules against your current prop-firm agreement.";
for (const locale of ["en", "ru", "es", "fr", "it", "uk", "de"]) {
  const messages = JSON.parse(
    fs.readFileSync(path.join(root, `src/i18n/locales/${locale}.json`), "utf8"),
  ) as Record<string, string>;
  assert.ok(messages["propPass.autopilot.warning"], `${locale} warning missing`);
}
const en = JSON.parse(
  fs.readFileSync(path.join(root, "src/i18n/locales/en.json"), "utf8"),
) as Record<string, string>;
assert.equal(en["propPass.autopilot.warning"], warning);

console.log("Prop Pass Challenge Autopilot Setup QA passed");
