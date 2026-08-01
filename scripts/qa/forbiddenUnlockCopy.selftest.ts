/**
 * Forbidden unlock / legacy sales copy — product surfaces only.
 * Run: npx tsx scripts/qa/forbiddenUnlockCopy.selftest.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

const FORBIDDEN = [
  "Unlock Full Edge Analysis",
  "Unlock Full Trading Profile",
  "Unlock Your Trading Edge",
  "Everything you need to trade like a professional",
  "educational feedback after every trade",
  "Pattern Intelligence",
  "Market Intelligence",
] as const;

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "build",
  ".git",
  "DerivedData",
  "DerivedData-ReleaseStaging",
  "DerivedData-yt3-qa",
  "coverage",
  "dist",
  "first-launch-evidence",
  "phase4f-screenshots",
  "simulator-recovery",
  "stats-redesign-evidence",
]);

const SCAN_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
]);

const SELF = "forbiddenUnlockCopy.selftest.ts";

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!SCAN_EXTS.has(ext)) continue;
    if (full.endsWith(SELF)) continue;
    out.push(full);
  }
  return out;
}

/** Product UI + QA flows that assert visible copy. */
const roots = [
  path.join(root, "src"),
  path.join(root, ".maestro/yt3"),
];

const hits: string[] = [];
for (const start of roots) {
  const files = fs.existsSync(start) && fs.statSync(start).isDirectory() ? walk(start) : [];
  for (const file of files) {
    let raw = "";
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const phrase of FORBIDDEN) {
      if (raw.includes(phrase)) {
        hits.push(`${path.relative(root, file)} :: ${phrase}`);
      }
    }
  }
}

assert.equal(hits.length, 0, `Forbidden unlock/sales copy found:\n${hits.slice(0, 50).join("\n")}`);

const appSrc = fs.readFileSync(path.join(root, "src/app/YouTraderApp.tsx"), "utf8");
assert.ok(!appSrc.includes('{ id: "calendar", label: t("calendar") }'), "Calendar must not be a bottom tab");
assert.ok(appSrc.includes("StatsDashboard"), "StatsDashboard must be wired");
assert.ok(!appSrc.includes("<PaywallPreview"), "PaywallPreview must not overlay Stats");
assert.ok(appSrc.includes("SubscriptionScreen"), "SubscriptionScreen must remain available");
assert.ok(
  appSrc.includes('{ id: "settings", label: t("settings") }'),
  "Settings must be a primary bottom tab",
);

const moreSrc = fs.readFileSync(path.join(root, "src/app/MoreScreen.tsx"), "utf8");
assert.ok(moreSrc.includes('id: "calendar"'), "Calendar must be available in More");
assert.ok(!moreSrc.includes('id: "settings"'), "Settings must not be duplicated in More");

console.log("forbiddenUnlockCopy selftest PASS");
