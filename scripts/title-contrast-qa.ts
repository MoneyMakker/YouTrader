/**
 * Visual token regression: title styles used as active headings must set
 * explicit primary ink (C.text), never rely on RN default black.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const STYLES = path.join(ROOT, "src/app/styles.ts");

const REQUIRED_PRIMARY_TITLE_KEYS = [
  "statsDashboardTitle",
  "journalHeaderTitle",
  "errorBoundaryTitle",
  "calendarMonthOverviewValue",
  "propMissionStatus",
  "monthPickerTitle",
] as const;

function extractStyleBlock(source: string, key: string): string {
  const re = new RegExp(`${key}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`, "m");
  const m = source.match(re);
  assert.ok(m, `missing style key ${key}`);
  return m[1];
}

function run() {
  const source = fs.readFileSync(STYLES, "utf8");
  for (const key of REQUIRED_PRIMARY_TITLE_KEYS) {
    const body = extractStyleBlock(source, key);
    assert.match(body, /\.\.\.ydlTypography\.title/, `${key} must use title role`);
    assert.match(body, /color:\s*C\.text/, `${key} must set C.text (not muted/disabled/default)`);
    assert.doesNotMatch(body, /color:\s*C\.muted/, `${key} must not use muted token`);
    assert.doesNotMatch(body, /color:\s*C\.sub/, `${key} must not use secondary token as primary ink`);
  }
  console.log(
    `[YouTrader:title-contrast-qa] ${REQUIRED_PRIMARY_TITLE_KEYS.length} title styles OK`,
  );
}

run();
