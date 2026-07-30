/**
 * Static assertions against Phase 2B hardening migration SQL.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const HARDENING = path.join(
  ROOT,
  "supabase/migrations/20260730230000_prop_os_command_boundary_hardening.sql",
);
const ORIGINAL = path.join(
  ROOT,
  "supabase/migrations/20260730220000_prop_os_internal_commands.sql",
);

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  OK  ${name}`);
}

const sql = fs.readFileSync(HARDENING, "utf8");
const allCmdSql = fs.readFileSync(ORIGINAL, "utf8") + "\n" + sql;

console.log("prop-os-command-hardening-static-qa");

check("hardening migration exists", () => {
  assert.ok(fs.existsSync(HARDENING));
});

check("every SECURITY DEFINER cmd uses safe search_path", () => {
  const defs = [...sql.matchAll(/create or replace function public\.(prop_os_cmd_\w+)[\s\S]*?\$\$;/gi)];
  assert.ok(defs.length >= 6, `expected cmd functions, got ${defs.length}`);
  for (const m of defs) {
    const body = m[0]!;
    if (!/security definer/i.test(body)) continue;
    assert.match(
      body,
      /set search_path to pg_catalog,\s*public/i,
      `missing hardened search_path in ${m[1]}`,
    );
  }
});

check("EXECUTE revoked from PUBLIC on cmd functions", () => {
  assert.match(sql, /revoke all on function public\.prop_os_cmd_assert_authorized\(\) from public/i);
  assert.match(sql, /revoke all on function public\.prop_os_cmd_create_account[\s\S]*from public/i);
  assert.match(sql, /revoke all on function public\.prop_os_cmd_create_challenge_attempt[\s\S]*from public/i);
});

check("grant execute only to authenticated for mutation cmds", () => {
  assert.match(
    sql,
    /grant execute on function public\.prop_os_cmd_create_account[\s\S]*to authenticated/i,
  );
  assert.equal(
    /grant execute on function public\.prop_os_cmd_create_account[\s\S]*to anon/i.test(sql),
    false,
  );
  assert.equal(
    /grant execute on function public\.prop_os_cmd_admin_[\s\S]*to authenticated/i.test(sql),
    false,
  );
});

check("actor from auth.uid via assert_authorized; no client user_id authority", () => {
  assert.match(sql, /prop_os_cmd_assert_authorized/i);
  assert.match(sql, /uid := \(select auth\.uid\(\)\)/i);
  assert.match(sql, /prop_os_command_allowlist/i);
  assert.match(sql, /prop_os_command_gate/i);
  // Client cannot pass actor as authority — body uses uid from assert
  assert.match(sql, /uid := public\.prop_os_cmd_assert_authorized\(\)/i);
});

check("sanitized errors — no SQLSTATE text / detail leak patterns in returns", () => {
  assert.equal(/sqlerrm|SQLERRM|pg_exception_detail/i.test(sql), false);
  assert.match(sql, /'kind',\s*'forbidden'/);
  assert.match(sql, /'kind',\s*'unexpected_error'/);
});

check("attempt_number uniqueness present", () => {
  assert.match(sql, /attempt_number/i);
  assert.match(sql, /prop_challenges_account_attempt_uidx/i);
});

check("receipt written after mutations in create_challenge", () => {
  const fn = sql.match(
    /create or replace function public\.prop_os_cmd_create_challenge_attempt[\s\S]*?\$\$;/i,
  );
  assert.ok(fn);
  const body = fn![0]!;
  const snapIdx = body.indexOf("insert into public.prop_challenge_rule_snapshots");
  const receiptIdx = body.indexOf("prop_os_cmd_store_receipt");
  assert.ok(snapIdx > 0 && receiptIdx > snapIdx, "receipt must follow snapshot insert");
});

check("kill-switch mid-flight documented as atomic under initial auth", () => {
  assert.match(sql, /Mid-flight gate flip/i);
  assert.match(sql, /initial authorization/i);
});

check("schema-qualified table refs in hardened cmds", () => {
  assert.match(allCmdSql, /from public\.prop_accounts/i);
  assert.match(allCmdSql, /from public\.prop_challenges/i);
  assert.match(allCmdSql, /into public\.prop_os_command_receipts/i);
});

console.log(`prop-os-command-hardening-static-qa: PASS (${passed})`);
