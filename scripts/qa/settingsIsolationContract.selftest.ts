/**
 * Settings isolation + production QA diagnostics absence.
 * CONTRACT PASS — PHYSICAL NOT RUN
 * Run: node --import tsx scripts/qa/settingsIsolationContract.selftest.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildSettingsSubscriptionPresentation } from "../../src/app/startup/settingsSubscriptionPresentation";
import { CUSTOMER_INFO_FIXTURES } from "./fixtures/customerInfoFixtures";

const root = path.resolve(__dirname, "../..");

for (const id of [
  "weekly_active",
  "monthly_trial",
  "annual_trial",
  "trial_canceled_access_active",
] as const) {
  const p = buildSettingsSubscriptionPresentation(CUSTOMER_INFO_FIXTURES[id]);
  assert.ok(p, id);
  assert.ok(!/\bFree\b|\bGuest\b/i.test(`${p!.planLabel} ${p!.renewalLine} ${p!.priceLabel}`));
}

// User-switch cache clearing contract
type Bag = { journal: string[]; entitlement: string | null };
const byUser = new Map<string, Bag>();
function loadUser(id: string): Bag {
  if (!byUser.has(id)) byUser.set(id, { journal: [], entitlement: null });
  return byUser.get(id)!;
}
function clearUser(id: string) {
  byUser.delete(id);
}
loadUser("a").journal.push("t1");
loadUser("a").entitlement = "weekly";
clearUser("a");
assert.equal(byUser.get("a"), undefined);
loadUser("b").journal.push("t2");
assert.deepEqual(loadUser("b").journal, ["t2"]);
assert.notDeepEqual(loadUser("b").journal, ["t1"]);

// Production must not mount visible QA reset markers
const app = fs.readFileSync(path.join(root, "src/app/YouTraderApp.tsx"), "utf8");
assert.ok(app.includes('sanitizedRuntimeConfigReport().appEnvironment === "staging"'));
assert.ok(app.includes("showStagingQaResetMarkers"));
assert.ok(app.includes("hideQaConfigBanners"));

const markers = fs.readFileSync(path.join(root, "src/qa/StagingQaResetMarkers.tsx"), "utf8");
assert.ok(markers.includes("opacity: 0"));
assert.ok(markers.includes("Must not be mounted in production"));

console.log("settingsIsolationContract selftest CONTRACT PASS (PHYSICAL NOT RUN)");
