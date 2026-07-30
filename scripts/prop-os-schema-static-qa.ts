/**
 * Phase 1A — static validation of Prop OS migration against frozen contract.
 * Does not require a live database.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath = path.join(
  root,
  "supabase/migrations/20260730190000_prop_os_database_foundation.sql",
);

const REQUIRED_TABLES = [
  "prop_accounts",
  "prop_challenges",
  "prop_challenge_rule_snapshots",
  "prop_trade_assignments",
  "prop_executions",
  "prop_account_events",
  "prop_challenge_transitions",
  "prop_engine_snapshots",
  "prop_score_snapshots",
  "prop_violation_records",
  "prop_data_quality_flags",
  "prop_correction_events",
] as const;

const FORBIDDEN_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /alter\s+table\s+public\.trade_journal/i, why: "must not alter trade_journal" },
  { re: /alter\s+table\s+public\.prop_firms/i, why: "must not alter prop_firms" },
  { re: /alter\s+table\s+public\.user_firm_settings/i, why: "must not alter user_firm_settings" },
  { re: /alter\s+table\s+public\.risk_snapshots/i, why: "must not alter risk_snapshots" },
  {
    re: /insert\s+into\s+public\.prop_trade_assignments/i,
    why: "must not auto-assign legacy trades",
  },
  {
    re: /insert\s+into\s+public\.prop_trade_assignments[\s\S]*trade_journal/i,
    why: "must not backfill assignments from trade_journal",
  },
  {
    re: /create\s+policy[\s\S]*on\s+public\.prop_/i,
    why: "Phase 1A must keep zero client policies (deny-by-default)",
  },
];

const REQUIRED_FRAGMENTS = [
  "enable row level security",
  "force row level security",
  "prop_os_forbid_mutation",
  "prop_os_forbid_delete",
  "prop_os_enforce_challenge_account_owner",
  "prop_os_enforce_assignment_owner",
  "prop_os_enforce_challenge_no_silent_overwrite",
  "prop-os-schema-v0",
  "account_size_minor",
  "starting_balance_minor",
  "realized_pnl_minor",
  "fees_minor",
  "firm_timezone",
  "calculation_version",
  "confidence_policy_version",
  "revoke all on table public.",
  "grant all on table public.",
  "to postgres, service_role",
];

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  OK  ${name}`);
}

console.log("prop-os-schema-static-qa");

check("migration file exists", () => {
  assert.ok(fs.existsSync(migrationPath), migrationPath);
});

const sql = fs.readFileSync(migrationPath, "utf8");

check("additive: no forbidden mutations / backfill / client policies", () => {
  for (const { re, why } of FORBIDDEN_PATTERNS) {
    assert.equal(re.test(sql), false, why);
  }
});

check("all required tables created", () => {
  for (const t of REQUIRED_TABLES) {
    assert.ok(
      new RegExp(`create table if not exists public\\.${t}\\b`, "i").test(sql),
      `missing table ${t}`,
    );
  }
});

check("required security / money / version fragments present", () => {
  const lower = sql.toLowerCase();
  for (const frag of REQUIRED_FRAGMENTS) {
    assert.ok(lower.includes(frag.toLowerCase()), `missing fragment: ${frag}`);
  }
});

check("legacy journal left untouched (no FK from journal)", () => {
  assert.equal(/references\s+public\.trade_journal/i.test(sql), false);
  assert.equal(/alter\s+table\s+public\.trade_journal/i.test(sql), false);
});

check("immutable / append-only triggers wired", () => {
  assert.ok(/prop_challenge_rule_snapshots_immutable/i.test(sql));
  assert.ok(/prop_engine_snapshots_forbid_mutation/i.test(sql));
  assert.ok(/prop_score_snapshots_forbid_mutation/i.test(sql));
  assert.ok(/prop_correction_events_forbid_mutation/i.test(sql));
  assert.ok(/prop_challenges_forbid_delete/i.test(sql));
  assert.ok(/prop_executions_forbid_delete/i.test(sql));
});

check("assignment uniqueness + state shape constraints", () => {
  assert.ok(/unique\s*\(\s*user_id\s*,\s*trade_client_id\s*\)/i.test(sql));
  assert.ok(/prop_trade_assignments_state_shape/i.test(sql));
});

check("ownership timeline indexes present", () => {
  assert.ok(/prop_accounts_user_status_idx/i.test(sql));
  assert.ok(/prop_challenges_user_status_idx/i.test(sql));
  assert.ok(/prop_executions_challenge_occurred_idx/i.test(sql));
  assert.ok(/prop_account_events_challenge_occurred_idx/i.test(sql));
});

check("src/propOs remains disconnected from App shell", () => {
  const app = fs.readFileSync(path.join(root, "App.tsx"), "utf8");
  assert.equal(/propOs|prop_accounts|prop_challenges/.test(app), false);
  const you = fs.existsSync(path.join(root, "src/app/YouTraderApp.tsx"))
    ? fs.readFileSync(path.join(root, "src/app/YouTraderApp.tsx"), "utf8")
    : "";
  // Phase 2A: App may import application layer `propPass`, never domain `propOs`.
  assert.equal(/from\s+['\"].*propOs/.test(you), false);
  assert.equal(/calculateChallenge|createMemoryAccountStore|runShadow/.test(you), false);
});

console.log(`prop-os-schema-static-qa: PASS (${passed} checks)`);
