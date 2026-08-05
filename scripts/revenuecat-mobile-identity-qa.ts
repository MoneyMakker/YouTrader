#!/usr/bin/env npx tsx
/**
 * RevenueCat mobile identity + restore-path contract QA (account-first).
 * Behavior-oriented source checks against YouTraderApp.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runRevenueCatIdentityQaOrThrow } from "../src/billing/revenueCatIdentity.qa";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main() {
  const results = await runRevenueCatIdentityQaOrThrow();
  const appSource = readFileSync(resolve(process.cwd(), "src/app/YouTraderApp.tsx"), "utf8");
  const identitySource = readFileSync(resolve(process.cwd(), "src/billing/revenueCatIdentity.ts"), "utf8");
  const logoutSource = readFileSync(resolve(process.cwd(), "src/auth/explicitLogout.ts"), "utf8");

  assert(
    appSource.includes("RevenueCatIdentitySynchronizer"),
    "YouTraderApp must use RevenueCatIdentitySynchronizer",
  );
  assert(
    appSource.includes("revenueCatIdentityRef.current.synchronize"),
    "YouTraderApp must call synchronizer.synchronize with the Supabase session user id",
  );
  assert(
    identitySource.includes("logIn: (appUserID: string)") || identitySource.includes("logIn: (appUserID)"),
    "Synchronizer client must expose logIn(appUserID)",
  );
  assert(
    /Purchases\.logIn\(appUserID\)/.test(appSource) || /logIn: \(appUserID\) => Purchases\.logIn\(appUserID\)/.test(appSource),
    "Synchronizer wiring must call Purchases.logIn(session UUID)",
  );
  assert(
    !/Purchases\.logIn\(\s*session\.user\.email/.test(appSource),
    "Email must never be used as RevenueCat App User ID",
  );
  assert(
    /Purchases\.configure\(\{\s*apiKey:\s*REVENUECAT_API_KEY,\s*appUserID:\s*userId\s*\}\)/.test(appSource) ||
      appSource.includes("appUserID: userId"),
    "RevenueCat must configure with Supabase UUID appUserID",
  );
  assert(
    !/Purchases\.configure\(\{\s*apiKey:\s*REVENUECAT_API_KEY\s*\}\)/.test(appSource),
    "Anonymous Purchases.configure({ apiKey }) must not remain in the normal flow",
  );

  const restoreFnMatch = appSource.match(
    /const restorePurchases = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[/,
  );
  assert(!!restoreFnMatch, "restorePurchases callback must exist");
  const restoreBody = restoreFnMatch![0];
  assert(
    restoreBody.includes("Purchases.restorePurchases()"),
    "Restore must call Purchases.restorePurchases()",
  );
  assert(
    restoreBody.includes("!session?.user?.id") || restoreBody.includes("if (!session?.user?.id)"),
    "Restore must require an authenticated Supabase session",
  );
  assert(
    restoreBody.includes("ensureAuthenticatedRevenueCatIdentity") ||
      restoreBody.includes("revenueCatIdentityRef.current.synchronize"),
    "Authenticated restore must synchronize identity before restore",
  );
  assert(
    restoreBody.includes('t("noActiveSubscription")') &&
      restoreBody.includes('t("restoreFailedTryAgain")'),
    "Restore must preserve neutral no-purchase and generic retry states",
  );
  assert(
    !restoreBody.includes("Purchases.purchasePackage") &&
      !restoreBody.includes("Purchases.purchaseProduct"),
    "Restore must never start a purchase",
  );

  // Automatic restore after login must be gone.
  assert(
    !appSource.includes("identity:restore_fallback"),
    "Post-login automatic restore fallback must be removed",
  );
  assert(
    !appSource.includes("preAuthEntitledRef"),
    "preAuthEntitledRef must be removed",
  );
  assert(
    !appSource.includes("entitledUserIdAtLogoutRef"),
    "entitledUserIdAtLogoutRef silent-restore marker must be removed",
  );

  // Ordinary logout must not call Purchases.logOut.
  const signOutMatch = appSource.match(
    /const signOut = useCallback\(async \([^)]*\) => \{[\s\S]*?\n  \}, \[/,
  );
  assert(!!signOutMatch, "signOut callback must exist");
  assert(
    !/Purchases\.logOut\s*\(/.test(signOutMatch![0]),
    "Ordinary YouTrader logout must not call Purchases.logOut",
  );
  assert(
    logoutSource.includes("revenueCatLogOutOnce: false"),
    "explicitLogout plan must keep revenueCatLogOutOnce false",
  );

  console.log(
    `[YouTrader:revenuecat-mobile-identity-qa] ${results.length + 10} scenarios passed`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
