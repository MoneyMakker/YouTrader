/**
 * Static gate: new code must not import deprecated replayChallenge.
 * Allowed: replay.ts definition, index re-export, invariants parity check.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const allowed = new Set([
  "src/propOs/replay.ts",
  "src/propOs/index.ts",
  "scripts/prop-os-invariants-qa.ts",
  "scripts/prop-os-no-replay-alias-qa.ts",
]);

const skipDirs = new Set([
  "node_modules",
  ".tmp",
  "build",
  ".git",
  "ios",
  "android",
  ".codex",
]);

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p, out);
      continue;
    }
    if (!/\.(ts|tsx|mjs|js)$/.test(name)) continue;
    out.push(p);
  }
}

const files: string[] = [];
walk(root, files);

const offenders: string[] = [];
let allowedHits = 0;

for (const file of files) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const text = readFileSync(file, "utf8");
  if (!text.includes("replayChallenge")) continue;
  if (allowed.has(rel)) {
    allowedHits += 1;
    continue;
  }
  offenders.push(rel);
}

console.log("prop-os-no-replay-alias-qa");
if (offenders.length) {
  console.error("Forbidden replayChallenge imports/usages:\n" + offenders.join("\n"));
  process.exit(1);
}
assert.ok(allowedHits >= 2, "expected replay alias + index export");
console.log(`  OK  no new replayChallenge consumers (allowed files=${allowedHits})`);
console.log("prop-os-no-replay-alias-qa: PASS");
