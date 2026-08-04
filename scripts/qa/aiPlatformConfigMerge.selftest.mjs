import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("supabase/functions/_shared/aiPlatform/config.ts", "utf8");
assert.match(src, /DANGEROUS_MERGE_KEYS/);
assert.match(src, /__proto__/);
assert.match(src, /while \(stack\.length\)/);
assert.doesNotMatch(src, /deepMerge\([^)]*deepMerge/);
assert.doesNotMatch(src, /out\[key[^\]]*\]\s*=\s*deepMerge/);
console.log("aiPlatformConfigMerge selftest: PASS");
