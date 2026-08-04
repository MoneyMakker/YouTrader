/**
 * Static Build 116 backward-compatibility gates for the expanded Prop Pass
 * production migration set. Does not invent PASS from "additive" alone —
 * asserts concrete safe shapes for shared production objects.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const mig = (name: string) => readFileSync(join(root, "supabase/migrations", name), "utf8");

/** Exact ordered expanded set for Build 117 Journal/runtime on production. */
export const EXPANDED_PRODUCTION_MIGRATION_SET = [
  "20260730190000_prop_os_database_foundation.sql",
  "20260730210000_prop_os_controlled_activation_read.sql",
  "20260730220000_prop_os_internal_commands.sql",
  "20260730230000_prop_os_command_boundary_hardening.sql",
  "20260730240000_prop_os_trade_assignment_commands.sql",
  "20260730250000_prop_os_assignment_recalc_hardening.sql",
  "20260730260000_prop_os_assignment_identity_invariant.sql",
  "20260730270000_prop_os_performance_intelligence.sql",
  "20260730280000_prop_os_performance_intelligence_remediation.sql",
  "20260731290000_prop_os_pi_timeout_reaper.sql",
  "20260802212828_prop_pass_trading_os_persistence.sql",
  "20260802223818_prop_pass_build117_persistence_hardening.sql",
  "20260802225538_prop_pass_journal_automatic_sync.sql",
  "20260802232311_prop_pass_pipeline_v2_runtime.sql",
  "20260802233700_prop_pass_runtime_processing_queue.sql",
  "20260802235500_prop_pass_settings_recalculation_events.sql",
] as const;

const EXPECTED_SHA256: Record<(typeof EXPANDED_PRODUCTION_MIGRATION_SET)[number], string> = {
  "20260730190000_prop_os_database_foundation.sql": "5ca0845a6f9fca338381be902675e9e8246bfc6b5925205b5c00064048b25f7f",
  "20260730210000_prop_os_controlled_activation_read.sql": "055e3a0a91f86a2b9733c059d45768bc47ac51f39e319a6e4621b06f599f3f54",
  "20260730220000_prop_os_internal_commands.sql": "eae741e9852c76c981a3960561a2f76178668fb951b2530d34a5f48010ded425",
  "20260730230000_prop_os_command_boundary_hardening.sql": "5efa8e3e04aec573af3b4ed3b180ebf280254fce1b689f89f58c58247fc4ae96",
  "20260730240000_prop_os_trade_assignment_commands.sql": "5e092feabb349246bd17438c0107a87cbbbfafe51bffd54f46ad86644b48179d",
  "20260730250000_prop_os_assignment_recalc_hardening.sql": "d17eaecc0804bd9fd48b7f9d1dfe65d4c718f2ee6eb976051a4bd344e4070469",
  "20260730260000_prop_os_assignment_identity_invariant.sql": "12e960caf36d32865038ee935236c8e0788b3bca90d46b7bcde02126b1fe5230",
  "20260730270000_prop_os_performance_intelligence.sql": "498edccd1affa9b648bb7e1e5349bc8453a884b59f1f0c3dd34d1d7b115559b1",
  "20260730280000_prop_os_performance_intelligence_remediation.sql": "240318734dd3574e7aea2753b11ac2560e575f4234eb785fbe56122ccfd3b020",
  "20260731290000_prop_os_pi_timeout_reaper.sql": "3dca310c03ee8d28459ada07b77766f3274d3c6574f32343f316893e6b112d48",
  "20260802212828_prop_pass_trading_os_persistence.sql": "9b0edf1b2eab15201c17806a93a7a0a17e026433cb1718e4011c06e3b14f2059",
  "20260802223818_prop_pass_build117_persistence_hardening.sql": "d1a4037e60a18fb80c7f5c3d775788fdcde24a83d58bcda536411690c8eb19fe",
  "20260802225538_prop_pass_journal_automatic_sync.sql": "f7ca73e3ba681c898ada9529674598f9190b4b2e013b815e5d14eaf0d66947fe",
  "20260802232311_prop_pass_pipeline_v2_runtime.sql": "bac3bca3951bbab11848a8bcd38bd1ed272b479f20b6390ff809364f43b6ea6d",
  "20260802233700_prop_pass_runtime_processing_queue.sql": "ecd79a18e68fef367a176cb08d602b237f6b4d2cf2cd5172affdf62e1fa5e09c",
  "20260802235500_prop_pass_settings_recalculation_events.sql": "724672da606c1aab21bba7b5b9f2e11113b80c4ad1a52f01edfe356dca5c3e9a",
};

const PRE_EXISTING_PRODUCTION_TABLES = [
  "trade_journal",
  "user_subscriptions",
  "ai_usage_events",
  "auth_provider_tokens",
] as const;

for (const name of EXPANDED_PRODUCTION_MIGRATION_SET) {
  const body = mig(name);
  const digest = createHash("sha256").update(body).digest("hex");
  assert.equal(digest, EXPECTED_SHA256[name], `hash mismatch ${name}`);
  assert.doesNotMatch(body, /\bdrop\s+table\b/i, `${name} must not DROP TABLE`);
  assert.doesNotMatch(body, /\btruncate\b/i, `${name} must not TRUNCATE`);
  assert.doesNotMatch(body, /\bdrop\s+column\b/i, `${name} must not DROP COLUMN`);
  assert.doesNotMatch(body, /disable\s+row\s+level\s+security/i, `${name} must not disable RLS`);
  for (const table of PRE_EXISTING_PRODUCTION_TABLES) {
    assert.doesNotMatch(body, new RegExp(`drop\\s+table\\s+(if\\s+exists\\s+)?(public\\.)?${table}\\b`, "i"), `${name} must not drop ${table}`);
    assert.doesNotMatch(body, new RegExp(`alter\\s+table\\s+(public\\.)?${table}[\\s\\S]{0,200}rename\\s+to\\b`, "i"), `${name} must not rename ${table}`);
  }
}

// Only allowlisted DELETE targets (allowlist maintenance), never trade_journal / auth users.
const boundary = mig("20260730230000_prop_os_command_boundary_hardening.sql");
const deletes = [...boundary.matchAll(/delete\s+from\s+([a-z0-9_.".]+)/gi)].map((m) => m[1].replace(/"/g, "").toLowerCase());
assert.ok(deletes.every((target) => target.includes("prop_os_command_allowlist")), "boundary hardening may only delete allowlist rows");

// Shared Journal column for Build 116: NOT NULL with DEFAULT so existing inserts keep working.
const journalSync = mig("20260802225538_prop_pass_journal_automatic_sync.sql");
assert.match(
  journalSync,
  /add column if not exists prop_pass_revision bigint not null default 1/,
  "prop_pass_revision must be NOT NULL DEFAULT 1 for Build 116 insert compatibility",
);

// Migrations must not seed real users or Prop Pass accounts at apply time.
// Processor function bodies may INSERT into prop_* tables at runtime (allowed).
for (const name of EXPANDED_PRODUCTION_MIGRATION_SET) {
  const body = mig(name);
  assert.doesNotMatch(body, /insert\s+into\s+auth\.users\b/i, `${name} must not seed auth.users`);
  // Strip dollar-quoted function bodies before checking for apply-time prop_ seeds.
  const withoutFunctions = body.replace(/\$\$[\s\S]*?\$\$/g, "$$/*fn*/$$");
  assert.doesNotMatch(
    withoutFunctions,
    /insert\s+into\s+public\.prop_(accounts|challenges|trade_assignments)\b/i,
    `${name} must not seed core prop rows at apply time`,
  );
}

// auth_provider_tokens already on production under a different version stamp — must stay out of set.
assert.equal(
  EXPANDED_PRODUCTION_MIGRATION_SET.includes("20260802001141_auth_provider_tokens.sql" as never),
  false,
);

console.log(
  JSON.stringify(
    {
      suite: "prop-pass-build116-compat-static",
      migrationCount: EXPANDED_PRODUCTION_MIGRATION_SET.length,
      hashesVerified: true,
      noDropTruncate: true,
      journalRevisionDefaultSafe: true,
      allowlistDeleteOnly: true,
      authProviderTokensExcluded: true,
    },
    null,
    2,
  ),
);
console.log("prop-pass-build116-compat-static: PASS");
