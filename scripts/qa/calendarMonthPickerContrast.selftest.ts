import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const styles = readFileSync(path.join(root, "src/app/styles.ts"), "utf8");

assert.match(styles, /monthPickerYearText:\s*\{[\s\S]*?color:\s*C\.text/);
assert.match(styles, /monthPickerMonthText:\s*\{[\s\S]*?color:\s*C\.text/);
assert.match(styles, /monthPickerMonthActive:\s*\{\s*borderColor:\s*C\.green,\s*backgroundColor:\s*C\.greenSoft\s*\}/);
assert.match(styles, /monthPickerMonth:\s*\{[\s\S]*?minHeight:\s*44/);

console.log("calendarMonthPickerContrast.selftest PASS");
