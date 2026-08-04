/**
 * Static gates for the FINAL minimal Build 117 Prop Pass SQL set (13 files).
 * Performance Intelligence migrations are excluded (REQUIRED_ONLY_IF_PI_ENABLED).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const mig = (name: string) => readFileSync(join(root, "supabase/migrations", name), "utf8");

export const MINIMAL_PRODUCTION_MIGRATION_SET = [
  "20260730190000_prop_os_database_foundation.sql",
  "20260730210000_prop_os_controlled_activation_read.sql",
  "20260730220000_prop_os_internal_commands.sql",
  "20260730230000_prop_os_command_boundary_hardening.sql",
  "20260730240000_prop_os_trade_assignment_commands.sql",
  "20260730250000_prop_os_assignment_recalc_hardening.sql",
  "20260730260000_prop_os_assignment_identity_invariant.sql",
  "20260802212828_prop_pass_trading_os_persistence.sql",
  "20260802223818_prop_pass_build117_persistence_hardening.sql",
  "20260802225538_prop_pass_journal_automatic_sync.sql",
  "20260802232311_prop_pass_pipeline_v2_runtime.sql",
  "20260802233700_prop_pass_runtime_processing_queue.sql",
  "20260802235500_prop_pass_settings_recalculation_events.sql",
] as const;

export const OPTIONAL_PI_MIGRATIONS = [
  "20260730270000_prop_os_performance_intelligence.sql",
  "20260730280000_prop_os_performance_intelligence_remediation.sql",
  "20260731290000_prop_os_pi_timeout_reaper.sql",
] as const;

const EXPECTED_SHA256: Record<(typeof MINIMAL_PRODUCTION_MIGRATION_SET)[number], string> = {
  "20260730190000_prop_os_database_foundation.sql": "5ca0845a6f9fca338381be902675e9e8246bfc6b5925205b5c00064048b25f7f",
  "20260730210000_prop_os_controlled_activation_read.sql": "055e3a0a91f86a2b9733c059d45768bc47ac51f39e319a6e4621b06f599f3f54",
  "20260730220000_prop_os_internal_commands.sql": "eae741e9852c76c981a3960561a2f76178668fb951b2530d34a5f48010ded425",
  "20260730230000_prop_os_command_boundary_hardening.sql": "5efa8e3e04aec573af3b4ed3b180ebf280254fce1b689f89f58c58247fc4ae96",
  "20260730240000_prop_os_trade_assignment_commands.sql": "5e092feabb349246bd17438c0107a87cbbbfafe51bffd54f46ad86644b48179d",
  "20260730250000_prop_os_assignment_recalc_hardening.sql": "d17eaecc0804bd9fd48b7f9d1dfe65d4c718f2ee6eb976051a4bd344e4070469",
  "20260730260000_prop_os_assignment_identity_invariant.sql": "12e960caf36d32865038ee935236c8e0788b3bca90d46b7bcde02126b1fe5230",
  "20260802212828_prop_pass_trading_os_persistence.sql": "9b0edf1b2eab15201c17806a93a7a0a17e026433cb1718e4011c06e3b14f2059",
  "20260802223818_prop_pass_build117_persistence_hardening.sql": "d1a4037e60a18fb80c7f5c3d775788fdcde24a83d58bcda536411690c8eb19fe",
  "20260802225538_prop_pass_journal_automatic_sync.sql": "f7ca73e3ba681c898ada9529674598f9190b4b2e013b815e5d14eaf0d66947fe",
  "20260802232311_prop_pass_pipeline_v2_runtime.sql": "bac3bca3951bbab11848a8bcd38bd1ed272b479f20b6390ff809364f43b6ea6d",
  "20260802233700_prop_pass_runtime_processing_queue.sql": "ecd79a18e68fef367a176cb08d602b237f6b4d2cf2cd5172affdf62e1fa5e09c",
  "20260802235500_prop_pass_settings_recalculation_events.sql": "724672da606c1aab21bba7b5b9f2e11113b80c4ad1a52f01edfe356dca5c3e9a",
};

for (const name of MINIMAL_PRODUCTION_MIGRATION_SET) {
  const body = mig(name);
  assert.equal(createHash("sha256").update(body).digest("hex"), EXPECTED_SHA256[name], name);
  assert.doesNotMatch(body, /\bdrop\s+table\b/i);
  assert.doesNotMatch(body, /\btruncate\b/i);
  assert.doesNotMatch(body, /\bdrop\s+column\b/i);
  assert.doesNotMatch(body, /disable\s+row\s+level\s+security/i);
}

assert.equal(
  MINIMAL_PRODUCTION_MIGRATION_SET.some((n) => (OPTIONAL_PI_MIGRATIONS as readonly string[]).includes(n)),
  false,
  "minimal set must exclude PI migrations",
);

// Later Prop Pass SQL must not reference PI objects.
for (const name of MINIMAL_PRODUCTION_MIGRATION_SET.slice(7)) {
  const body = mig(name);
  assert.doesNotMatch(body, /prop_performance_intelligence/i, `${name} must not depend on PI`);
  assert.doesNotMatch(body, /prop_os_pi_/i, `${name} must not depend on PI`);
  assert.doesNotMatch(body, /performance_intelligence/i, `${name} must not depend on PI`);
}

// Migration 4: no apply-time DELETE (only admin function body).
const boundary = mig("20260730230000_prop_os_command_boundary_hardening.sql");
const withoutFns = boundary.replace(/\$\$[\s\S]*?\$\$/g, "$$/*fn*/$$");
assert.doesNotMatch(withoutFns, /delete\s+from\s+public\.prop_os_command_allowlist/i);

const journalSync = mig("20260802225538_prop_pass_journal_automatic_sync.sql");
assert.match(journalSync, /add column if not exists prop_pass_revision bigint not null default 1/);

console.log(
  JSON.stringify(
    {
      suite: "prop-pass-minimal-migration-set-static",
      migrationCount: MINIMAL_PRODUCTION_MIGRATION_SET.length,
      removedOptionalPi: OPTIONAL_PI_MIGRATIONS.length,
      hashesVerified: true,
    },
    null,
    2,
  ),
);
console.log("prop-pass-minimal-migration-set-static: PASS");
