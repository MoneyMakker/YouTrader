import { runUsageLimitsQa } from "../src/config/usageLimitsEngine";

const results = runUsageLimitsQa();
let failed = 0;

for (const result of results) {
  const status = result.pass ? "PASS" : "FAIL";
  if (!result.pass) failed += 1;
  console.log(`${status} ${result.name} — ${result.detail}`);
}

if (failed > 0) {
  console.error(`\n${failed} scenario(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${results.length} usage limit scenarios passed.`);
