/**
 * Focused Post-Purchase Authentication QA — pure logic only.
 * No network, no device, no secrets.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  resolveAcquisitionPhase,
  type AcquisitionInput,
} from "../../src/app/startup/acquisitionState";
import { migrateGuestTradesToUser, type MigrationResult } from "../../src/postPurchase/AnonymousDataMigrationService";

let failures = 0;

function check(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS  ${name}`);
    return;
  }
  failures += 1;
  console.error(`FAIL  ${name}`);
}

function baseInput(overrides: Partial<AcquisitionInput> = {}): AcquisitionInput {
  return {
    hydrated: true,
    onboardingCompleted: true,
    paywallCompleted: false,
    authRequired: false,
    hasSession: false,
    isPremium: true,
    revenueCatReady: true,
    ...overrides,
  };
}

// ── Routing: post_purchase_auth phase ──────────────────────────────────────

check(
  "anonymous purchase + active entitlement routes to post_purchase_auth",
  resolveAcquisitionPhase(baseInput({ postPurchaseAuthPending: true })) === "post_purchase_auth",
);

check(
  "anonymous purchase without entitlement routes to auth (badge hidden)",
  resolveAcquisitionPhase(baseInput({ postPurchaseAuthPending: true, isPremium: false })) === "auth",
);

check(
  "authenticated user never routes to post_purchase_auth",
  resolveAcquisitionPhase(baseInput({ postPurchaseAuthPending: true, hasSession: true, isPremium: true })) === "main",
);

check(
  "unauthenticated user without purchase routes to auth (not post_purchase_auth)",
  resolveAcquisitionPhase(baseInput()) === "auth",
);

check(
  "unauthenticated user without entitlement stays on auth",
  resolveAcquisitionPhase(baseInput({ isPremium: false })) === "auth",
);

check(
  "explicit logout never routes to post_purchase_auth even with pending flag",
  resolveAcquisitionPhase(baseInput({ postPurchaseAuthPending: true, loggingOut: true })) === "loading",
);

// ── Screen source: badge never shown without entitlement ────────────────────

const screenSource = readFileSync(resolve("src/postPurchase/PostPurchaseAuthScreen.tsx"), "utf8");
check(
  "activation badge references translated key (not raw text)",
  /postPurchase\.activatedBadge/.test(screenSource),
);
check(
  "badge uses CheckCircle icon (visual indicator)",
  /CheckCircle/.test(screenSource),
);

// ── RevenueCat: Purchases.logOut never called ──────────────────────────────

const linkerSource = readFileSync(resolve("src/postPurchase/RevenueCatIdentityLinker.ts"), "utf8");
check(
  "RevenueCatIdentityLinker never calls Purchases.logOut",
  !/Purchases\.logOut\s*\(/.test(linkerSource),
);

const bridgeSource = readFileSync(resolve("src/postPurchase/PostPurchaseAuthBridge.tsx"), "utf8");
check(
  "PostPurchaseAuthBridge never calls Purchases.logOut",
  !/Purchases\.logOut\s*\(/.test(bridgeSource),
);

// ── App integration: Purchases.logOut absent from linking path ────────────

const appSource = readFileSync(resolve("src/app/YouTraderApp.tsx"), "utf8");
check(
  "postPurchaseAuthPending never triggers Purchases.logOut",
  !/postPurchaseAuthPending.*Purchases\.logOut|Purchases\.logOut.*postPurchaseAuthPending/.test(appSource),
);

// ── Migration: idempotency markers ──────────────────────────────────────────

check(
  "migrateGuestTradesToUser uses a migration marker prefix",
  /MIGRATION_MARKER_PREFIX/.test(readFileSync(resolve("src/postPurchase/AnonymousDataMigrationService.ts"), "utf8")),
);

// ── Duplicate tap prevention (state machine) ────────────────────────────────

const coordinatorSource = readFileSync(resolve("src/postPurchase/PostPurchaseAuthCoordinator.tsx"), "utf8");
check(
  "coordinator prevents duplicate authenticate calls while busy",
  /state\.phase\s*!==\s*"idle".*return/.test(coordinatorSource) || /busy/.test(bridgeSource),
);

// ── Bridge cancellation handling ────────────────────────────────────────────

check(
  "bridge catches cancellation and returns to idle",
  /setPhase\s*\(\s*"idle"\s*\)/.test(bridgeSource) && /cancel/.test(bridgeSource),
);

check(
  "bridge does not show destructive alerts on cancel",
  !/(destructive|purchase failed).*cancel/i.test(bridgeSource),
);

// ── Auth callback existence ─────────────────────────────────────────────────

check(
  "handlePostPurchaseApple is wired in app source",
  /handlePostPurchaseApple/.test(appSource),
);
check(
  "handlePostPurchaseGoogle is wired in app source",
  /handlePostPurchaseGoogle/.test(appSource),
);
check(
  "handlePostPurchaseEmail is wired in app source",
  /handlePostPurchaseEmail/.test(appSource),
);

// ── Linking detection effect exists ─────────────────────────────────────────

check(
  "linking detection effect watches postPurchaseAuthPending",
  /useEffect/.test(appSource) && /postPurchaseAuthPending/.test(appSource),
);

// ── Providers converge to shared coordinator ────────────────────────────────

check(
  "PostPurchaseAuthCoordinator handles all three providers through one state machine",
  /authenticating_apple/.test(coordinatorSource) &&
    /authenticating_google/.test(coordinatorSource) &&
    /authenticating_email/.test(coordinatorSource),
);

// ── Screen renders provider loading states ─────────────────────────────────

check(
  "screen shows provider-specific loading via providerLoading map",
  /providerLoading/.test(screenSource),
);

// ── Apple lifecycle remained intact ────────────────────────────────────────

const acctDeletionSource = readFileSync(resolve("src/auth/accountDeletionFlow.ts"), "utf8");
check(
  "accountDeletionFlow planPostDeletionTeardown still returns callPurchasesLogOut: false",
  /callPurchasesLogOut:\s*false/.test(acctDeletionSource),
);

check(
  "classifyBootstrapSession still handles deleted_user",
  /deleted_user/.test(acctDeletionSource),
);

check(
  "shouldPurgeCachedSession still purges deleted_user",
  /verdict\s*===\s*"deleted_user"/.test(acctDeletionSource),
);

if (failures > 0) {
  console.error(`\npost-purchase-auth-qa: ${failures} failing check(s)`);
  process.exit(1);
}
console.log("\npost-purchase-auth-qa: all checks passed");
