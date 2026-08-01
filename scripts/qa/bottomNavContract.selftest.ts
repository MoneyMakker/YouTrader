/**
 * Bottom navigation contract — Settings primary, Calendar in More only.
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

// Eligible order: journal → optional propPass → stats → settings → more
const tabsBlockMatch = appSrc.match(
  /const tabs: \{ id: Tab; label: string \}\[\] = \[([\s\S]*?)\];/,
);
assert.ok(tabsBlockMatch, "tabs array must exist");
const tabsBlock = tabsBlockMatch![1];
assert.ok(tabsBlock.includes('{ id: "journal"'), "Journal must be first dock tab");
assert.ok(tabsBlock.includes("propPassTabVisible"), "Prop Pass must be gated by eligibility");
assert.ok(tabsBlock.includes('{ id: "stats"'), "Stats must be a dock tab");
assert.ok(tabsBlock.includes('{ id: "settings"'), "Settings must be in dock tabs");
assert.ok(tabsBlock.includes('{ id: "more"'), "More must be a dock tab");

const journalIdx = tabsBlock.indexOf('{ id: "journal"');
const statsIdx = tabsBlock.indexOf('{ id: "stats"');
const settingsIdx = tabsBlock.indexOf('{ id: "settings"');
const moreIdx = tabsBlock.indexOf('{ id: "more"');
assert.ok(journalIdx < statsIdx && statsIdx < settingsIdx && settingsIdx < moreIdx, "Dock order must be Journal → Stats → Settings → More");

// Settings selected state must not remap to More
assert.ok(
  !appSrc.includes('tab === "settings" ||\n            tab === "calendar"'),
  "Settings tab must not remap activeId to more",
);
assert.ok(
  !/activeId=\{[\s\S]*?tab === "settings"[\s\S]*?\? "more"/.test(appSrc),
  "Settings must keep its own selected dock state",
);

// More hub: Calendar present, Settings absent
assert.ok(moreSrc.includes('id: "calendar"'), "Calendar must remain in More");
assert.ok(!moreSrc.includes('id: "settings"'), "Settings must not be duplicated in More");
assert.ok(
  moreSrc.includes("Settings is a primary bottom tab"),
  "MoreScreen must document Settings as primary tab",
);

// qaTabIds contract for Maestro/debug
assert.ok(appSrc.includes('"settings"'), "qaTabIds / dock must expose settings");
assert.ok(
  /qaTabIds = \[[\s\S]*?"settings"[\s\S]*?"more"/.test(appSrc),
  "qaTabIds must include settings before more",
);

console.log("bottomNavContract selftest PASS");
