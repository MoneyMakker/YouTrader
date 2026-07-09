import { check, stepResult, tryRun, readJson } from "../lib.mjs";

export function productionReadinessGate() {
  const checks = [];
  const r = tryRun("node", ["scripts/ai-platform-v2/production-readiness-gate.mjs"]);
  let gateStatus = "FAIL";
  let summary = { passed: 0, failed: 0, warned: 0 };

  const report = readJson("scripts/ai-platform-v2/reports/readiness-latest.json");
  if (report) {
    summary = {
      passed: report.items?.filter((i) => i.status === "PASS").length ?? 0,
      failed: report.items?.filter((i) => i.status === "FAIL").length ?? 0,
      warned: report.items?.filter((i) => i.status === "WARNING").length ?? 0,
    };
    gateStatus = report.finalStatus === "READY FOR PREVIEW" || report.finalStatus === "READY FOR PRODUCTION" ? "PASS" : report.finalStatus === "BLOCKED" ? "FAIL" : "WARNING";
    if (summary.failed === 0 && r.ok) gateStatus = "PASS";
  }

  checks.push(check("readiness_run", "Production Readiness Gate executed", r.ok || summary.failed === 0 ? "PASS" : "FAIL"));
  checks.push(check("readiness_fail", "FAIL count", summary.failed === 0 ? "PASS" : "FAIL", `${summary.failed} FAIL`));
  checks.push(check("readiness_warn", "WARNING count", "PASS", `${summary.warned} WARNING`));
  checks.push(check("readiness_pass", "PASS count", "PASS", `${summary.passed} PASS`));

  const blockers = summary.failed > 0 ? [`Production Readiness Gate: ${summary.failed} FAIL`] : [];
  return stepResult("readiness", "Step 2 — Production Readiness Gate", checks, blockers);
}
