/**
 * Run: npx tsx scripts/qa/stagingQaNewsFault.selftest.ts
 */
import assert from "node:assert/strict";
import {
  isStagingNewsFaultAllowed,
  parseStagingNewsFaultUrl,
  resolveNewsLoadPlan,
} from "../../src/qa/stagingQaNewsFault";

assert.equal(parseStagingNewsFaultUrl("youtrader://qa/news-fault?mode=offline"), "offline");
assert.equal(parseStagingNewsFaultUrl("youtrader://qa/seed-trade"), null);
assert.equal(isStagingNewsFaultAllowed({ EXPO_PUBLIC_APP_ENV: "production" }), false);
assert.equal(isStagingNewsFaultAllowed({ EXPO_PUBLIC_APP_ENV: "staging" }), true);
assert.equal(resolveNewsLoadPlan("timeout").forceTimeout, true);
assert.equal(resolveNewsLoadPlan("empty").forceEmpty, true);
assert.equal(resolveNewsLoadPlan("offline").useNetwork, false);
assert.equal(resolveNewsLoadPlan("none").useNetwork, true);
console.log("stagingQaNewsFault.selftest PASS");
