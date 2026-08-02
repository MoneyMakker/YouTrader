import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { hasActivePropPassEntitlement } from "../../src/billing/propPassEntitlement";
import { resolvePropPassProductState } from "../../src/propPass/productState";
import type { PropPassUiState } from "../../src/propPass/types";

const root = path.resolve(import.meta.dirname, "../..");
const entitlementId = "YouTrader Pro";
const products = ["youtrader_pro_weekly", "youtrader_pro_monthly", "youtrader_pro_yearly__"];

const activeCustomerInfo = {
  entitlements: {
    active: {
      [entitlementId]: { isActive: true, productIdentifier: "youtrader_pro_monthly" },
    },
  },
};
assert.equal(hasActivePropPassEntitlement(activeCustomerInfo, entitlementId, products), true);
assert.equal(hasActivePropPassEntitlement({ entitlements: { active: {} } }, entitlementId, products), false);

const available = { kind: "available", model: {} } as PropPassUiState;
assert.equal(
  resolvePropPassProductState({ entitled: true, appEnvironment: "production", uiState: available }).kind,
  "dashboard",
);
assert.equal(
  resolvePropPassProductState({ entitled: false, appEnvironment: "production", uiState: available }).kind,
  "locked",
);
assert.equal(
  resolvePropPassProductState({ entitled: true, appEnvironment: "production", uiState: { kind: "no_account" } }).kind,
  "setup",
);
assert.equal(
  resolvePropPassProductState({ entitled: true, appEnvironment: "production", uiState: { kind: "disabled" } }).kind,
  "setup",
);
assert.equal(
  resolvePropPassProductState({ entitled: true, appEnvironment: "staging", uiState: { kind: "disabled" } }).kind,
  "unsupported",
);
assert.equal(
  resolvePropPassProductState({ entitled: true, appEnvironment: "production", uiState: { kind: "repository_unavailable" } }).kind,
  "recoverable_error",
);

const mapperSource = readFileSync(path.join(root, "src/propPass/mapUiState.ts"), "utf8");
assert.match(mapperSource, /case "evaluation_error":[\s\S]*?kind: "repository_unavailable"/);

const appSource = readFileSync(path.join(root, "src/app/YouTraderApp.tsx"), "utf8");
assert.match(appSource, /hasActivePropPassEntitlement\(\s*customerInfo,/);
assert.match(appSource, /refreshCurrentEntitlements\(`\$\{tab\}-focus`, \[0\]\)/);
assert.match(appSource, /addCustomerInfoUpdateListener/);

console.log("propPassProductionContract.selftest PASS");
