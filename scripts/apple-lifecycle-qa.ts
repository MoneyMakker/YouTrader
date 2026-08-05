/**
 * Focused Apple lifecycle QA — pure decision helpers only.
 * No network, no device, no secrets.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyBootstrapSession,
  evaluateDeleteAccountResponse,
  evaluateStoreAppleTokenResponse,
  isStaleLifecycleResponse,
  planPostDeletionTeardown,
  shouldPurgeCachedSession,
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

check(
  "deleted user session is purged on bootstrap",
  shouldPurgeCachedSession(classifyBootstrapSession({ status: 403, code: "user_not_found" })),
);
check(
  "expired refresh token is purged on bootstrap",
  shouldPurgeCachedSession(classifyBootstrapSession({ message: "Invalid Refresh Token" })),
);
check(
  "temporary network error keeps the cached session",
  !shouldPurgeCachedSession(
    classifyBootstrapSession({ name: "AuthRetryableFetchError", message: "Network request failed" }),
  ),
);
check("valid session is never purged", classifyBootstrapSession(null) === "valid");

const appSource = readFileSync(resolve("src/app/YouTraderApp.tsx"), "utf8");
const signOutBody = appSource.match(/const signOut = useCallback\(async \([^)]*\) => \{[\s\S]*?\n  \}, \[/)?.[0] || "";
check("remote sign-out cannot throw past local teardown", /catch \(thrown\)/.test(signOutBody));
check("deletion teardown never calls Purchases.logOut", !/Purchases\.logOut\s*\(/.test(signOutBody));
check(
  "deletion flows force local teardown",
  (appSource.match(/signOut\(\{ force: true \}\)/g) || []).length >= 1 &&
    /onSignOut\(\{ force: true \}\)/.test(
      readFileSync(resolve("src/components/settings/SettingsAccountSection.tsx"), "utf8"),
    ),
);
check(
  "bootstrap validates the cached session before trusting it",
  /classifyBootstrapSession/.test(appSource) && /shouldPurgeCachedSession/.test(appSource),
);
check(
  "authorization code is forwarded exactly once",
  (appSource.match(/storeAppleAuthTokenAfterSignIn\(/g) || []).length === 1,
);

if (failures > 0) {
  console.error(`\napple-lifecycle-qa: ${failures} failing check(s)`);
  process.exit(1);
}
console.log("\napple-lifecycle-qa: all checks passed");
