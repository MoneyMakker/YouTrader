/**
 * Unit gates for staging QA reset — no RN runtime required.
 */
import assert from "node:assert/strict";
import {
  isStagingQaResetAllowed,
  shouldRunStagingQaReset,
} from "../src/qa/stagingQaResetGates";

function run() {
  assert.equal(
    isStagingQaResetAllowed({ EXPO_PUBLIC_APP_ENV: "production" }),
    false,
    "production must block QA reset",
  );
  assert.equal(
    isStagingQaResetAllowed({ EXPO_PUBLIC_APP_ENV: "prod" }),
    false,
    "prod alias must block QA reset",
  );
  assert.equal(
    isStagingQaResetAllowed({ EXPO_PUBLIC_APP_ENV: "staging" }),
    true,
    "staging allows QA reset gate",
  );
  assert.equal(
    shouldRunStagingQaReset({
      env: { EXPO_PUBLIC_APP_ENV: "staging", EXPO_PUBLIC_QA_RESET_AUTH: "1" },
    }),
    true,
    "env flag triggers reset in staging",
  );
  assert.equal(
    shouldRunStagingQaReset({
      env: { EXPO_PUBLIC_APP_ENV: "production", EXPO_PUBLIC_QA_RESET_AUTH: "1" },
      deepLinkUrl: "youtrader://qa/reset-auth",
    }),
    false,
    "production never triggers even with env+deeplink",
  );
  assert.equal(
    shouldRunStagingQaReset({
      env: { EXPO_PUBLIC_APP_ENV: "staging" },
      deepLinkUrl: "youtrader://qa/reset-auth",
    }),
    true,
    "staging deeplink triggers reset",
  );
  assert.equal(
    shouldRunStagingQaReset({
      env: { EXPO_PUBLIC_APP_ENV: "staging" },
      processArgs: ["-YTQAResetAuth"],
    }),
    true,
    "launch argument triggers reset",
  );
  console.log("[YouTrader:staging-qa-reset] gates passed");
}

run();
