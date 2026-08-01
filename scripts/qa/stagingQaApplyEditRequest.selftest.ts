/**
 * Regression protection for qaApplyEditRequest QA orchestration state.
 * Run: npx tsx scripts/qa/stagingQaApplyEditRequest.selftest.ts
 *
 * Accidental removal/rename of App state `qaApplyEditRequest` MUST fail this suite.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  QA_APPLY_EDIT_REQUEST_STATE_KEY,
  clearStagingQaApplyEditRequest,
  consumeStagingQaApplyEditRequest,
  createStagingQaApplyEditRequest,
  resolveTradeForApplyEditRequest,
  stagingQaApplyEditAllowedInEnv,
  type YouTraderAppQaApplyEditState,
} from "../../src/qa/stagingQaApplyEditRequest";

const root = path.resolve(__dirname, "../..");
const appPath = path.join(root, "src/app/YouTraderApp.tsx");
const appSource = fs.readFileSync(appPath, "utf8");

// --- Exact App state owner contract (prevents Session 10 regression) ---
assert.equal(QA_APPLY_EDIT_REQUEST_STATE_KEY, "qaApplyEditRequest");
assert.match(
  appSource,
  /const \[qaApplyEditRequest, setQaApplyEditRequest\] = useState/,
  "YouTraderApp must declare useState qaApplyEditRequest",
);
assert.match(
  appSource,
  /setQaApplyEditRequest\((request|\{ url, nonce:)/,
  "YouTraderApp must create apply-edit requests via setQaApplyEditRequest(request|{ url, nonce })",
);
assert.match(
  appSource,
  /createStagingQaApplyEditRequest\(url\)/,
  "YouTraderApp deep link must use createStagingQaApplyEditRequest helper",
);
assert.match(
  appSource,
  /qaApplyEditRequest=\{qaApplyEditRequest\}/,
  "YouTraderApp must pass qaApplyEditRequest into the journal screen",
);
assert.match(
  appSource,
  /onQaApplyEditConsumed/,
  "YouTraderApp must wire consume callback",
);

// Type-level shape (compile-time via assignment)
const stateSample: YouTraderAppQaApplyEditState = {
  qaApplyEditRequest: null,
};
assert.equal(stateSample.qaApplyEditRequest, null);

// --- Lifecycle: create → resolve → consume/clear ---
const stagingEnv = { EXPO_PUBLIC_APP_ENV: "staging" };
const prodEnv = { EXPO_PUBLIC_APP_ENV: "production" };

assert.equal(stagingQaApplyEditAllowedInEnv(stagingEnv), true);
assert.equal(stagingQaApplyEditAllowedInEnv(prodEnv), false);

const bad = createStagingQaApplyEditRequest("youtrader://qa/seed-trade", 1, stagingEnv);
assert.equal(bad, null);

const prodBlocked = createStagingQaApplyEditRequest(
  "youtrader://qa/apply-trade-edit?marker=S11&notes=QA-S11-EDITED&pnl=125",
  42,
  prodEnv,
);
assert.equal(prodBlocked, null, "production must not create apply-edit requests");

const created = createStagingQaApplyEditRequest(
  "youtrader://qa/apply-trade-edit?marker=S11&notes=QA-S11-EDITED&pnl=125&exit=5225",
  99,
  stagingEnv,
);
assert.ok(created);
assert.equal(created!.nonce, 99);
assert.match(created!.url, /apply-trade-edit/);

const trades = [
  { id: "qa-seed-S11-1", notes: "notes:QA-S11", pnl: 50, entry: 5200, exit: 5210, contracts: 1 },
  { id: "other", notes: "live", pnl: 10, entry: 1, exit: 2, contracts: 1 },
];
const target = resolveTradeForApplyEditRequest(created!.url, trades);
assert.ok(target);
assert.equal(target!.id, "qa-seed-S11-1");

const consumed = consumeStagingQaApplyEditRequest(created);
assert.equal(consumed, null);
assert.equal(clearStagingQaApplyEditRequest(), null);

// After consume, App clears React state — simulate required clear path in source
assert.match(
  appSource,
  /setQaApplyEditRequest\(null\)/,
  "YouTraderApp must clear qaApplyEditRequest after consume",
);

console.log("stagingQaApplyEditRequest.selftest PASS");
