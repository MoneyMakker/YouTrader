/**
 * Bottom navigation contract — Settings primary, Calendar in More only.
 * Dock order: Journal → Prop Pass → Stats → Futures (more) → Settings.
 * Run: npx tsx scripts/qa/bottomNavContract.selftest.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const appSrc = fs.readFileSync(path.join(root, "src/app/YouTraderApp.tsx"), "utf8");
const moreSrc = fs.readFileSync(path.join(root, "src/app/MoreScreen.tsx"), "utf8");

// Dock tabs must include Settings; Calendar must not be a dock tab.
assert.ok(
  appSrc.includes('{ id: "settings", label: t("settings") }'),
  "Settings must be a primary bottom tab",
);
assert.ok(
  !appSrc.includes('{ id: "calendar", label: t("calendar") }'),
  "Calendar must not appear in the bottom dock",
);

// Dock order: journal → propPass → stats → more (Futures) → settings
const tabsBlockMatch = appSrc.match(
  /const tabs: \{ id: Tab; label: string \}\[\] = \[([\s\S]*?)\];/,
);
assert.ok(tabsBlockMatch, "tabs array must exist");
const tabsBlock = tabsBlockMatch![1];
assert.ok(tabsBlock.includes('{ id: "journal"'), "Journal must be first dock tab");
assert.ok(tabsBlock.includes("propPassTabVisible"), "Prop Pass visibility flag remains");
assert.ok(tabsBlock.includes('{ id: "propPass"'), "Prop Pass must be a dock tab");
assert.ok(tabsBlock.includes('{ id: "stats"'), "Stats must be a dock tab");
assert.ok(tabsBlock.includes('{ id: "settings"'), "Settings must be in dock tabs");
assert.ok(tabsBlock.includes('{ id: "more"'), "More must be a dock tab");

assert.ok(
  appSrc.includes("PropPassLockedPreview"),
  "Non-entitled Prop Pass must render locked preview",
);
assert.ok(
  /propPassTabVisible\s*=\s*!\(qaPropPassPayload\?\.forceHidePropPassTab\)/.test(appSrc) ||
    appSrc.includes("propPassTabVisible = !(qaPropPassPayload?.forceHidePropPassTab)"),
  "Prop Pass tab visibility must not require isPremium",
);

const journalIdx = tabsBlock.indexOf('{ id: "journal"');
const propPassIdx = tabsBlock.indexOf('{ id: "propPass"');
const statsIdx = tabsBlock.indexOf('{ id: "stats"');
const settingsIdx = tabsBlock.indexOf('{ id: "settings"');
const moreIdx = tabsBlock.indexOf('{ id: "more"');
assert.ok(
  journalIdx < propPassIdx &&
    propPassIdx < statsIdx &&
    statsIdx < moreIdx &&
    moreIdx < settingsIdx,
  "Dock order must be Journal → Prop Pass → Stats → Futures → Settings",
);

// Settings selected state must not remap to More
assert.ok(
  !appSrc.includes('tab === "settings" ||\n            tab === "calendar"'),
  "Settings tab must not remap activeId to more",
);
assert.ok(
  !/activeId=\{[\s\S]*?tab === "settings"[\s\S]*?\? "more"/.test(appSrc),
  "Settings must keep its own selected dock state",
);

// More hub: Calendar present, Settings absent, Support/legal absent
assert.ok(moreSrc.includes('id: "calendar"'), "Calendar must remain in More");
assert.ok(!moreSrc.includes('id: "settings"'), "Settings must not be duplicated in More");
assert.ok(
  moreSrc.includes("Settings is a primary bottom tab"),
  "MoreScreen must document Settings as primary tab",
);
assert.ok(!moreSrc.includes("more.sectionSupport"), "Futures must not show Support section");
assert.ok(!moreSrc.includes('id: "help"'), "Futures must not include Help");
assert.ok(!moreSrc.includes('id: "privacy"'), "Futures must not include Privacy Policy");
assert.ok(!moreSrc.includes('id: "terms"'), "Futures must not include Terms of Use");
assert.ok(
  appSrc.includes('t("termsRiskPrivacy")') || appSrc.includes("termsRiskPrivacy"),
  "Legal links must remain reachable from Settings",
);
assert.ok(appSrc.includes("Support"), "Support must remain reachable from Settings");

// qaTabIds contract for Maestro/debug
assert.ok(appSrc.includes('"settings"'), "qaTabIds / dock must expose settings");
assert.ok(
  /qaTabIds = \[[\s\S]*?"more"[\s\S]*?"settings"/.test(appSrc),
  "qaTabIds must include more before settings",
);

console.log("bottomNavContract selftest PASS");
