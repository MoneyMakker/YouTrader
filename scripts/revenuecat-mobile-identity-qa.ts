#!/usr/bin/env npx tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runRevenueCatIdentityQaOrThrow } from "../src/billing/revenueCatIdentity.qa";

async function main() {
  const results = await runRevenueCatIdentityQaOrThrow();
  const appSource = readFileSync(resolve(process.cwd(), "App.tsx"), "utf8");
  const restoreSyncIndex = appSource.indexOf('syncRevenueCatIdentity("restore_purchases")');
  const restoreCallIndex = appSource.indexOf("Purchases.restorePurchases()", restoreSyncIndex);
  const restoreCallCount = appSource.split("Purchases.restorePurchases()").length - 1;
  const restoreBodyEnd = appSource.indexOf("\n  useEffect(() => {", restoreSyncIndex);
  const restoreBody = appSource.slice(restoreSyncIndex, restoreBodyEnd);
  const settingsRestoreIndex = appSource.indexOf("!isPremium ? (\n            <Pressable\n              disabled={purchaseBusy}\n              onPress={onRestore}");

  if (restoreSyncIndex < 0 || restoreCallIndex < restoreSyncIndex) {
    throw new Error("Restore Purchases must synchronize the Supabase UUID before calling RevenueCat restorePurchases.");
  }
  if (settingsRestoreIndex < 0) {
    throw new Error("Settings subscription screen must expose Restore Purchases for every non-Pro user.");
  }
  if (restoreCallCount !== 1) {
    throw new Error("Restore Purchases must issue exactly one RevenueCat restorePurchases call per tap.");
  }
  if (!restoreBody.includes('t("noActiveSubscription")') || !restoreBody.includes('t("restoreFailedTryAgain")')) {
    throw new Error("Restore Purchases must preserve neutral no-purchase and generic retry states.");
  }
  if (!restoreBody.includes("refreshCurrentEntitlements") || restoreBody.includes("Purchases.purchase")) {
    throw new Error("Restore Purchases must refresh entitlement state without starting a purchase.");
  }

  console.log(`[YouTrader:revenuecat-mobile-identity-qa] ${results.length + 5} scenarios passed`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
