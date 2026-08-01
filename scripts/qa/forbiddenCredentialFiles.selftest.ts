/**
 * Fail if credential-like files appear in the git index or repo working tree.
 * Run: npx tsx scripts/qa/forbiddenCredentialFiles.selftest.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

const FORBIDDEN_NAME =
  /(password|passwd|credentials?|secrets?)\.(txt|env|json|pem|p8|key)$/i;
const FORBIDDEN_BASENAME = [
  /^SIM_EMAIL_PASSWORD/i,
  /^.*PASSWORD_UNIT\.txt$/i,
  /^\.env\.production$/i,
];

function walk(dir: string, out: string[] = [], depth = 0): string[] {
  if (depth > 8) return out;
  const skip = new Set([
    "node_modules",
    ".git",
    "build",
    "dist",
    "DerivedData",
    "DerivedData-ReleaseStaging",
    "DerivedData-yt3-qa",
    ".expo",
  ]);
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Never scan approved external-style secret dirs that are gitignored
      if (entry.name === "secrets" && dir.includes(".codex")) continue;
      walk(full, out, depth + 1);
      continue;
    }
    out.push(full);
  }
  return out;
}

const hits: string[] = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file);
  const base = path.basename(file);
  if (FORBIDDEN_NAME.test(base) || FORBIDDEN_BASENAME.some((re) => re.test(base))) {
    // Allow documentation that only mentions filenames, not the files themselves
    if (rel.startsWith("docs/") && base.endsWith(".md")) continue;
    if (rel.includes("selftest")) continue;
    hits.push(rel);
  }
}

assert.equal(
  hits.length,
  0,
  `Credential-like files must not live in the repo tree:\n${hits.join("\n")}`,
);

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8", cwd: root })
  .split("\n")
  .filter(Boolean);
const trackedHits = tracked.filter(
  (f) => FORBIDDEN_NAME.test(path.basename(f)) || FORBIDDEN_BASENAME.some((re) => re.test(path.basename(f))),
);
assert.equal(
  trackedHits.length,
  0,
  `Credential-like files tracked by git:\n${trackedHits.join("\n")}`,
);

console.log("forbiddenCredentialFiles selftest PASS");
