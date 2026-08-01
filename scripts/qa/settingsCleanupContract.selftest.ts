/**
 * Settings cleanup contract selftest (presentation + auth provider rules).
 * Run: npx tsx scripts/qa/settingsCleanupContract.selftest.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveSessionAccountLabel,
  resolveSessionAuthProvider,
  sessionSupportsChangeEmail,
  sessionSupportsPasswordControls,
} from "../../src/auth/resolveSessionAuthProvider";
import { buildSettingsSubscriptionPresentation } from "../../src/app/startup/settingsSubscriptionPresentation";

function fakeSession(input: {
  email?: string;
  provider?: string;
  identities?: Array<{ provider: string }>;
  hasPassword?: boolean;
  id?: string;
}) {
  return {
    user: {
      id: input.id || "00000000-0000-4000-8000-000000000001",
      email: input.email,
      identities: input.identities,
      app_metadata: {
        provider: input.provider,
        ...(input.hasPassword ? { has_password: true } : {}),
      },
      user_metadata: {},
    },
  } as any;
}

const apple = fakeSession({
  email: "hidden@privaterelay.appleid.com",
  identities: [{ provider: "apple" }],
  provider: "apple",
});
assert.equal(resolveSessionAuthProvider(apple), "apple");
assert.equal(sessionSupportsPasswordControls(apple), false);
assert.equal(sessionSupportsChangeEmail(apple), false);
assert.equal(resolveSessionAccountLabel(apple), "hidden@privaterelay.appleid.com");

const google = fakeSession({
  email: "trader@gmail.com",
  identities: [{ provider: "google" }],
  provider: "google",
});
assert.equal(resolveSessionAuthProvider(google), "google");
assert.equal(sessionSupportsPasswordControls(google), false);
assert.equal(sessionSupportsChangeEmail(google), false);

const email = fakeSession({
  email: "trader@example.com",
  identities: [{ provider: "email" }],
  provider: "email",
  hasPassword: true,
});
assert.equal(resolveSessionAuthProvider(email), "email");
assert.equal(sessionSupportsPasswordControls(email), true);
assert.equal(sessionSupportsChangeEmail(email), true);

const noEmail = fakeSession({ identities: [{ provider: "apple" }], provider: "apple" });
assert.equal(resolveSessionAccountLabel(noEmail), "Apple");
assert.doesNotMatch(resolveSessionAccountLabel(noEmail), /00000000/);

const entitled = buildSettingsSubscriptionPresentation({
  managementURL: "https://apps.apple.com/account/subscriptions",
  entitlements: {
    active: {
      "YouTrader Pro": {
        productIdentifier: "youtrader_pro_monthly",
        expirationDate: "2026-09-01T00:00:00.000Z",
        willRenew: true,
      },
    },
  },
});
assert.ok(entitled);
assert.equal(entitled!.renewalKind, "renews");

const root = path.resolve(__dirname, "../..");
const settingsSrc = fs.readFileSync(path.join(root, "src/app/YouTraderApp.tsx"), "utf8");
const accountSrc = fs.readFileSync(
  path.join(root, "src/components/settings/SettingsAccountSection.tsx"),
  "utf8",
);
const moreSrc = fs.readFileSync(path.join(root, "src/app/MoreScreen.tsx"), "utf8");
const notifSrc = fs.readFileSync(
  path.join(root, "src/notifications/SmartNotificationsSection.tsx"),
  "utf8",
);

assert.match(accountSrc, /mode === "row"/);
assert.match(accountSrc, /settings-delete-account/);
assert.match(accountSrc, /settings-sign-out/);
assert.doesNotMatch(accountSrc, /accountCloudSync|accountSyncedAcross|PasswordStatusRow|Sync now|syncNow/);
assert.match(settingsSrc, /settings-manage-subscription/);
assert.match(settingsSrc, /settings-view-plans/);
assert.match(settingsSrc, /settings-restore-purchases/);
assert.doesNotMatch(settingsSrc, /onImportTradesCsv/);
assert.doesNotMatch(settingsSrc, /onSyncNow/);
assert.match(moreSrc, /id: "importTrades"/);
assert.match(notifSrc, /copy\.proOnly && !isPro/);

console.log("settingsCleanupContract selftest PASS");
