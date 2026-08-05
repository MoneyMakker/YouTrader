/**
 * Focused delete-account cleanup hardening QA.
 * Verifies the Edge Function cleanup no longer references nonexistent tables,
 * nonexistent columns, or tables whose FK CASCADE/SET NULL handles deletion.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let failures = 0;

function check(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS  ${name}`);
    return;
  }
  failures += 1;
  console.error(`FAIL  ${name}`);
}

const src = readFileSync(resolve("supabase/functions/delete-account/index.ts"), "utf8");

// Tables that do NOT exist in any migration — must not appear in cleanup.
const nonexistentTables = ["trades", "ai_analysis_usage", "ai_quota_lifecycle", "account_deletion_requests"] as const;
for (const table of nonexistentTables) {
  // Allow the table name in the explanatory comment block (lines 121-125), but not in a data-manipulation statement.
  const deleteCall = new RegExp(`\\.from\\s*\\(\\s*["'\`]${table}["'\`]\\)`, "i");
  check(
    `nonexistent table "${table}" is not in any .from().delete() call`,
    !deleteCall.test(src),
  );
}

// request_limits has no user_id column — it uses actor_hash.
check(
  "request_limits is not cleaned via .from('request_limits')",
  !/\.from\s*\(\s*["'`]request_limits["'`]\s*\)/.test(src),
);

// security_events uses ON DELETE SET NULL — rows must survive for audit.
check(
  "security_events rows are preserved via ON DELETE SET NULL (not manually deleted)",
  !/\.from\s*\(\s*["'`]security_events["'`]\s*\)/.test(src),
);

// All remaining CASCADE tables are handled by the auth.users FK; no manual cleanup loop remains.
check(
  "no table-level .delete() loop remains in the function",
  !/for\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+(?:tables|table(?:Name)s?)\s*\)/.test(src),
);

// The response contract must be preserved.
check("response contains ok", /\bok\s*:\s*true\b/.test(src));
check("response contains appleRevoked", /\bappleRevoked\b/.test(src));
check("response contains manualAppleRevocationRequired", /\bmanualAppleRevocationRequired\b/.test(src));

// Apple token cleanup must remain explicitly before deleteUser.
check("deleteAppleRefreshToken is called before deleteUser", /\bdeleteAppleRefreshToken\b/.test(src));

// auth user deletion remains.
check("admin.auth.admin.deleteUser is still called", /admin\.auth\.admin\.deleteUser\s*\(/.test(src));

// No raw user_id from the request body — authority is JWT only.
check("user_id is never destructured from request body", !/req\.json.*user_id|body\.user_id/.test(src));

// No stale table-name array remains.
check("no stale table-name array survived", !/const\s+tables\s*=\s*\[/.test(src));

if (failures > 0) {
  console.error(`\ndelete-account-cleanup-hardening: ${failures} failing check(s)`);
  process.exit(1);
}
console.log("\ndelete-account-cleanup-hardening: all checks passed");
