import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const output = join(tmpdir(), `propPassRuntime-${process.pid}.bundle.js`);
execFileSync("node_modules/.bin/esbuild", [
  "src/propPass/persistence/runtimeRebuild.ts", "--bundle", "--platform=neutral",
  "--format=esm", "--target=es2022", "--minify", "--legal-comments=none", `--outfile=${output}`,
], { stdio: "pipe" });
assert.equal(
  readFileSync(output, "utf8"),
  readFileSync("supabase/functions/_shared/propPassRuntime.bundle.js", "utf8"),
  "committed Edge bundle must exactly match the canonical runtime rebuild source",
);
console.log("prop-pass-edge-bundle-qa: PASS");
