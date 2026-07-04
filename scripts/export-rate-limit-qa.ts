import { runExportRateLimitQa } from "../src/security/exportRateLimitEngine";

runExportRateLimitQa().catch((error) => {
  console.error("[YouTrader:export-rate-limit-qa] Runner crashed", error);
  process.exit(1);
});
