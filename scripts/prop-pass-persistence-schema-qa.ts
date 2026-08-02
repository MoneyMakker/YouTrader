import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const baseSql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260802212828_prop_pass_trading_os_persistence.sql"), "utf8");
const hardeningSql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260802223818_prop_pass_build117_persistence_hardening.sql"), "utf8");
const sql = `${baseSql}\n${hardeningSql}`;
const tables = ["prop_daily_plan_snapshots", "prop_pre_trade_assessments", "prop_rule_templates", "prop_intervention_events", "prop_timeline_events", "prop_live_risk_settings", "prop_payout_withdrawal_settings", "prop_kill_switch_settings", "prop_position_size_progressions", "prop_recovery_mode_states"];
for (const table of tables) assert.match(sql, new RegExp(`'${table}'`), `${table} must be RLS-scoped`);
assert.match(sql, /enable row level security/); assert.match(sql, /force row level security/); assert.match(sql, /to authenticated using \(user_id = \(select auth\.uid\(\)\)\)/);
assert.match(sql, /revoke all on table public\.%I from public, anon, authenticated/); assert.doesNotMatch(sql, /provider_token|identity_token|authorization_code/i);
assert.match(sql, /unique \(user_id, event_key\)/, "event persistence must support idempotency");
assert.match(sql, /append_only/, "historical plans and events must stay immutable");
for (const table of ["prop_instrument_spec_versions", "prop_intervention_overrides", "prop_decision_replays", "prop_processed_journal_events", "prop_account_runtime_states"]) {
  assert.match(hardeningSql, new RegExp(`'${table}'`), `${table} must be owner-scoped and RLS protected`);
}
assert.match(hardeningSql, /journal_event_identity_mismatch/);
assert.match(hardeningSql, /state_revision_digest_mismatch/);
assert.match(hardeningSql, /grant execute on function public\.prop_os_processor_claim_journal_event[\s\S]+to postgres, service_role/);
assert.doesNotMatch(hardeningSql, /grant execute on function public\.prop_os_processor_[^(]+\([^;]+to authenticated/);
assert.match(hardeningSql, /plan snapshot must belong to user and account/);
assert.doesNotMatch(hardeningSql, /provider_token|identity_token|authorization_code/i);
