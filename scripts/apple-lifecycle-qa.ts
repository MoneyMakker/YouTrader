/**
 * Focused Apple lifecycle QA — pure decision helpers only.
 * No network, no device, no secrets.
 */
import {
  evaluateDeleteAccountResponse,
  evaluateStoreAppleTokenResponse,
  isStaleLifecycleResponse,
  planPostDeletionTeardown,
} from "../src/auth/accountDeletionFlow";

let failures = 0;

function check(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS  ${name}`);
    return;
  }
  failures += 1;
  console.error(`FAIL  ${name}`);
}

check(
  "authorization code forwarded once yields stored evidence",
  evaluateStoreAppleTokenResponse(true, { ok: true, stored: true }).pass,
);
check(
  "missing authorization code never reports stored:true",
  !evaluateStoreAppleTokenResponse(false, { ok: true, stored: true }).pass,
);
check(
  "store response body is consumed",
  evaluateStoreAppleTokenResponse(true, { ok: true, stored: false }).stored === false,
);
check(
  "HTTP 200 with stored:false is not PASS",
  !evaluateStoreAppleTokenResponse(true, { ok: true, stored: false }).pass,
);
check("empty store body is not PASS", !evaluateStoreAppleTokenResponse(true, null).pass);

check(
  "delete response body is consumed",
  evaluateDeleteAccountResponse({ ok: true, appleRevoked: true }).appleRevoked === true,
);
check(
  "appleRevoked:false is not PASS",
  !evaluateDeleteAccountResponse({ ok: true, appleRevoked: false }).pass,
);
check(
  "manual revocation required is not PASS",
  !evaluateDeleteAccountResponse({
    ok: true,
    appleRevoked: true,
    manualAppleRevocationRequired: true,
  }).pass,
);
check(
  "full revoke evidence is PASS",
  evaluateDeleteAccountResponse({
    ok: true,
    appleRevoked: true,
    manualAppleRevocationRequired: false,
  }).pass,
);

const teardown = planPostDeletionTeardown();
check(
  "successful deletion clears local session and caches",
  teardown.clearSupabaseSession && teardown.clearLocalUserCaches && teardown.clearCustomerInfo,
);
check("successful deletion resets root to Auth", teardown.resetNavigationRootToAuth);
check(
  "back navigation cannot reopen Main",
  teardown.enterAccountDeletingState && teardown.blockAuthenticatedShell,
);
check("teardown does not depend on remote sign-out", teardown.forceLocalTeardown);
check("Purchases.logOut is not called", teardown.callPurchasesLogOut === false);

check("stale previous-user responses are ignored", isStaleLifecycleResponse("attempt-a", "attempt-b"));
check("missing correlation id is treated as stale", isStaleLifecycleResponse("attempt-a", null));
check("correlated response is accepted", !isStaleLifecycleResponse("attempt-b", "attempt-b"));

if (failures > 0) {
  console.error(`\napple-lifecycle-qa: ${failures} failing check(s)`);
  process.exit(1);
}
console.log("\napple-lifecycle-qa: all checks passed");
