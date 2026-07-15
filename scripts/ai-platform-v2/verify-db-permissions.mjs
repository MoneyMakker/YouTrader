#!/usr/bin/env node
/**
 * Verify DB permissions for AI Platform Edge Functions (read-only audit).
 * Usage: node scripts/ai-platform-v2/verify-db-permissions.mjs [--write-doc-section]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

const REQUIRED = [
  { table: "user_subscriptions", role: "service_role", privileges: ["SELECT"], reason: "Pro entitlement check in ai-coach / market-intelligence" },
  { table: "user_subscriptions", role: "authenticated", privileges: ["SELECT"], reason: "Client reads own subscription via RLS" },
  { table: "ai_usage_events", role: "service_role", privileges: ["SELECT", "INSERT"], reason: "Rate limits + usage metadata from Edge (recommended)" },
  { table: "ai_usage_events", role: "authenticated", privileges: ["SELECT", "INSERT"], reason: "Client usage events via RLS" },
];

function queryGrants() {
  const sql = `select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('user_subscriptions','ai_usage_events') and grantee in ('service_role','authenticated','anon') order by 1,2,3;`;
  const out = execFileSync("supabase", ["db", "query", "--linked", "--yes", sql], { cwd: ROOT, encoding: "utf8" });
  const rows = [];
  const match = out.match(/"rows":\s*(\[[\s\S]*?\])\s*,\s*"warning"/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      /* fall through */
    }
  }
  return rows;
}

function hasGrant(grants, table, role, priv) {
  return grants.some((g) => g.table_name === table && g.grantee === role && g.privilege_type === priv);
}

function main() {
  const grants = queryGrants();
  const checks = [];

  for (const req of REQUIRED) {
    for (const priv of req.privileges) {
      const ok = hasGrant(grants, req.table, req.role, priv);
      const scopeRequired = req.table === "user_subscriptions" && req.role === "service_role" && priv === "SELECT";
      checks.push({
        table: req.table,
        role: req.role,
        privilege: priv,
        status: ok ? "PASS" : scopeRequired ? "FAIL" : "WARNING",
        reason: req.reason,
      });
    }
  }

  // RLS enabled
  const rlsSql = `select relname, relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relname in ('user_subscriptions','ai_usage_events');`;
  let rlsOk = true;
  try {
    const rlsOut = execFileSync("supabase", ["db", "query", "--linked", "--yes", rlsSql], { cwd: ROOT, encoding: "utf8" });
    rlsOk = rlsOut.includes("true");
  } catch {
    rlsOk = false;
  }
  checks.push({ table: "user_subscriptions + ai_usage_events", role: "all", privilege: "RLS enabled", status: rlsOk ? "PASS" : "FAIL", reason: "RLS must stay enabled" });

  // anon should NOT have SELECT on user_subscriptions
  const anonSubSelect = hasGrant(grants, "user_subscriptions", "anon", "SELECT");
  checks.push({ table: "user_subscriptions", role: "anon", privilege: "SELECT absent", status: !anonSubSelect ? "PASS" : "FAIL", reason: "Least privilege for anonymous clients" });

  const report = { generatedAt: new Date().toISOString(), checks };
  fs.mkdirSync(path.join(ROOT, "scripts/ai-platform-v2/reports"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "scripts/ai-platform-v2/reports/db-permissions.json"), JSON.stringify(report, null, 2));

  for (const c of checks) {
    console.log(`${c.status} ${c.table} ${c.role} ${c.privilege}`);
  }

  const fails = checks.filter((c) => c.status === "FAIL").length;
  process.exit(fails > 0 ? 1 : 0);
}

main();
