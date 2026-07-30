/**
 * Fail if committed Prop OS types drift from live database schema.
 * Usage: DATABASE_URL=... npm run test:prop-os-schema-drift
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const committedPath = path.join(root, "src/types/propOsDatabase.ts");
const livePath = path.join(root, ".tmp/propOsDatabase.live.ts");
const url = process.env.DATABASE_URL ?? "postgresql://postgres@localhost:55432/prop_os_clean2";

fs.mkdirSync(path.dirname(livePath), { recursive: true });

const gen = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--experimental-transform-types", path.join(root, "scripts/generate-prop-os-db-types-live.ts")],
  {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: url, OUT_PATH: livePath },
  },
);
if (gen.status !== 0) {
  console.error(gen.stderr || gen.stdout);
  process.exit(1);
}

function tableCols(src: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const tableRe = / {6}(prop_\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\};/g;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(src))) {
    out[m[1]!] = [...m[2]!.matchAll(/^\s+(\w+):/gm)].map((x) => x[1]!);
  }
  return out;
}

const committed = fs.readFileSync(committedPath, "utf8");
const live = fs.readFileSync(livePath, "utf8");
const a = tableCols(committed);
const b = tableCols(live);
assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), "table set drift");
for (const t of Object.keys(b)) {
  assert.deepEqual(a[t], b[t], `column drift in ${t}`);
}
console.log(`prop-os-schema-drift: PASS (${Object.keys(b).length} tables)`);
