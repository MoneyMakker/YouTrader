import { check, stepResult, tryRun, readJson } from "../lib.mjs";

export function sqlPermissionAudit() {
  const checks = [];
  const blockers = [];

  const r = tryRun("node", ["scripts/ai-platform-v2/verify-db-permissions.mjs"], { timeout: 120_000 });
  const report = readJson("scripts/ai-platform-v2/reports/db-permissions.json", { checks: [] });

  for (const c of report.checks || []) {
    const label = `${c.table} · ${c.role} · ${c.privilege}`;
    checks.push(check(`db_${c.table}_${c.role}_${c.privilege}`.replace(/\W/g, "_"), label, c.status, c.reason || ""));
    if (c.status === "FAIL") blockers.push(`DB permission: ${label}`);
  }

  if (!report.checks?.length) {
    checks.push(check("db_audit", "DB permission audit executed", r.ok ? "PASS" : "FAIL", r.err?.slice(0, 120) || ""));
    if (!r.ok) blockers.push("DB permission audit failed to run");
  }

  return stepResult("db", "Step 5 — SQL Permission Audit", checks, blockers);
}
