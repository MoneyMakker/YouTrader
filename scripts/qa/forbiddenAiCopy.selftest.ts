/**
 * Forbidden user-facing AI terminology — Node selftest.
 * Run: npx tsx scripts/qa/forbiddenAiCopy.selftest.ts
 *
 * Internal API/processor names may remain in code paths that are not user-facing.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  formatPropMoney,
  formatPropMoneyA11y,
  minorToMajor,
} from "../../src/propPass/formatMoney";

const root = path.resolve(__dirname, "../..");

/** Patterns that must not appear as *display* string values in locale JSON. */
const FORBIDDEN_VALUE_PATTERNS: RegExp[] = [
  /\bAI Analytics\b/i,
  /\bArtificial Intelligence\b/i,
  /\bAI-powered\b/i,
  /\bAsk AI\b/i,
  /\bAI Coach\b/i,
  /\bAI coaching\b/i,
  /\bAI Summary\b/i,
  /\bAI Report\b/i,
  /\bPerformance Intelligence\b/i,
  /\bPerformance Coach\b/i,
  /\bUnlock AI\b/i,
  /\bSmart Analytics\b/i,
  /\bAuto-analysis\b/i,
  /\bAuto analysis\b/i,
  /\balgorithm-generated\b/i,
];

const LOCALE_DIR = path.join(root, "src/i18n/locales");

function collectForbiddenInLocales(): string[] {
  const hits: string[] = [];
  for (const file of fs.readdirSync(LOCALE_DIR).filter((f) => f.endsWith(".json"))) {
    const raw = fs.readFileSync(path.join(LOCALE_DIR, file), "utf8");
    const json = JSON.parse(raw) as Record<string, string>;
    for (const [key, value] of Object.entries(json)) {
      if (typeof value !== "string") continue;
      // Keys may still contain "ai" for internal continuity; values must not.
      for (const re of FORBIDDEN_VALUE_PATTERNS) {
        if (re.test(value)) {
          hits.push(`${file}:${key}=${value.slice(0, 80)}`);
        }
      }
    }
  }
  return hits;
}

const localeHits = collectForbiddenInLocales();
assert.equal(
  localeHits.length,
  0,
  `Forbidden AI copy in locales:\n${localeHits.slice(0, 40).join("\n")}`,
);

// Money formatter unit coverage
assert.equal(minorToMajor(5100000), 51000);
assert.equal(minorToMajor(300000), 3000);
assert.equal(minorToMajor(null), null);
assert.equal(formatPropMoney(5100000), "$51,000.00");
assert.equal(formatPropMoney(300000), "$3,000.00");
assert.equal(formatPropMoney(0), "$0.00");
assert.equal(formatPropMoney(-22000), "-$220.00");
assert.equal(formatPropMoney(null), "—");
assert.ok(formatPropMoney(100, { currency: "ZZZ" }).includes("1.00") || formatPropMoney(100, { currency: "ZZZ" }).includes("$"));
assert.ok(!/minor/i.test(formatPropMoneyA11y(12500)));

// Presentation status mapping covered in propPassPresentation.selftest.ts

console.log("forbiddenAiCopy + formatPropMoney selftest PASS");
