/**
 * Forbidden free/guest user-facing copy — Node selftest.
 * Run: npx tsx scripts/qa/forbiddenFreeAccessCopy.selftest.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

const FORBIDDEN = [
  "Free plan",
  "Free Journal",
  "Continue without an account",
  "Continue with Free Journal",
  "Guest Mode",
  "Current plan: Free",
  "Current plan Free",
] as const;

/** Locale values that must not be exactly "Free" under subscription keys. */
const FORBIDDEN_LOCALE_VALUES: RegExp[] = [
  /^Free$/i,
  /Continue without an account/i,
  /Continue with Free Journal/i,
  /Free Journal/i,
  /Guest Mode/i,
];

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

const SELF = "forbiddenFreeAccessCopy.selftest.ts";

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

const roots = [
  path.join(root, "src"),
  path.join(root, "scripts/qa"),
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
        hits.push(`${path.relative(root, file)}: ${phrase}`);
      }
    }
  }
}

assert.equal(hits.length, 0, `Forbidden free/guest copy:\n${hits.slice(0, 40).join("\n")}`);

const localeDir = path.join(root, "src/i18n/locales");
const localeHits: string[] = [];
for (const file of fs.readdirSync(localeDir).filter((f) => f.endsWith(".json"))) {
  const json = JSON.parse(fs.readFileSync(path.join(localeDir, file), "utf8")) as Record<string, string>;
  for (const [key, value] of Object.entries(json)) {
    if (typeof value !== "string") continue;
    if (key.includes("freePlan") || key.includes("stayFree") || /free/i.test(key)) {
      for (const re of FORBIDDEN_LOCALE_VALUES) {
        if (re.test(value)) localeHits.push(`${file}:${key}=${value}`);
      }
    }
    for (const re of FORBIDDEN_LOCALE_VALUES) {
      if (re.test(value) && /free|guest|without an account/i.test(value)) {
        localeHits.push(`${file}:${key}=${value}`);
      }
    }
  }
}

assert.equal(
  localeHits.length,
  0,
  `Forbidden free/guest locale values:\n${localeHits.slice(0, 40).join("\n")}`,
);

console.log("forbiddenFreeAccessCopy selftest PASS");
