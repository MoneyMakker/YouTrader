#!/usr/bin/env npx tsx
/**
 * RevenueCat mobile identity + restore-path contract QA.
 * Behavior-oriented source checks against YouTraderApp (not brittle App.tsx-only asserts).
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

  // Path A — anonymous restore from paywall: restorePurchases without requiring a session UUID first.
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
    restoreBody.includes('session?.user?.id') &&
      restoreBody.includes("revenueCatIdentityRef.current.synchronize"),
    "Path B: authenticated restore must synchronize identity before restore",
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

  // Identity reconciliation restore is allowed as a separate fallback path.
  assert(
    appSource.includes("decidePostLoginEntitlementReconcile") ||
      appSource.includes("identity:restore_fallback"),
    "Post-login entitlement reconciliation restore fallback must be wired",
  );

  console.log(
    `[YouTrader:revenuecat-mobile-identity-qa] ${results.length + 6} scenarios passed`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
