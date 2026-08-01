/**
 * Product/nav/startup contract coverage map — deterministic, no device.
 * CONTRACT PASS — LIVE E2E NOT RUN
 * Run: node --import tsx scripts/qa/productCoverageContract.selftest.ts
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

function runSelftest(rel: string) {
  const r = spawnSync("node", ["--import", "tsx", path.join(root, rel)], { encoding: "utf8" });
  assert.equal(r.status, 0, `${rel} failed:\n${r.stdout}\n${r.stderr}`);
}

const required = [
  "scripts/qa/paywallPlanCopy.selftest.ts",
  "scripts/qa/trialEligibility.selftest.ts",
  "scripts/qa/customerInfoContract.selftest.ts",
  "scripts/qa/identityLinkContract.selftest.ts",
  "scripts/qa/acquisitionPhase.selftest.ts",
  "scripts/qa/bottomNavContract.selftest.ts",
  "scripts/qa/forbiddenFreeAccessCopy.selftest.ts",
  "scripts/qa/forbiddenAiCopy.selftest.ts",
  "scripts/qa/forbiddenCredentialFiles.selftest.ts",
  "scripts/qa/newsFaultContract.selftest.ts",
  "scripts/qa/settingsIsolationContract.selftest.ts",
  "scripts/qa/piContract.selftest.ts",
  "scripts/qa/propPassPresentation.selftest.ts",
  "scripts/qa/onboardingProfileConsistency.selftest.ts",
  "scripts/calculator-risk-qa.ts",
];

for (const rel of required) {
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  runSelftest(rel);
}

// Source guards for journal/stats/calendar wiring + paid-only
const app = fs.readFileSync(path.join(root, "src/app/YouTraderApp.tsx"), "utf8");
assert.ok(app.includes("acquisitionPhase"), "startup state machine present");
assert.ok(app.includes('acquisitionPhase === "auth"'), "mandatory auth phase");
assert.ok(app.includes("Purchases.logIn"), "identity link path");
assert.ok(app.includes("JournalScreen"), "Journal surface");
assert.ok(app.includes("StatsOverview") || app.includes("StatsDashboard") || app.includes('tab === "stats"'), "Stats surface");
assert.ok(app.includes("MoreScreen") || app.includes('id: "more"'), "More nav");
assert.ok(!new RegExp("Continue without an " + "account", "i").test(app));

const acq = fs.readFileSync(path.join(root, "src/app/startup/acquisitionState.ts"), "utf8");
assert.ok(acq.includes("no free plan") || acq.includes("no guest"));

const storekit = JSON.parse(fs.readFileSync(path.join(root, "ios/YouTraderStaging.storekit"), "utf8"));
const byId = Object.fromEntries(
  storekit.subscriptionGroups[0].subscriptions.map((s: { productID: string }) => [s.productID, s]),
);
assert.equal(byId.youtrader_pro_weekly.introductoryOffer, null);
assert.equal(byId.youtrader_pro_monthly.introductoryOffer.subscriptionPeriod, "P3D");
assert.equal(byId.youtrader_pro_yearly__.introductoryOffer.subscriptionPeriod, "P1W");

console.log("productCoverageContract selftest CONTRACT PASS (LIVE E2E NOT RUN)");
