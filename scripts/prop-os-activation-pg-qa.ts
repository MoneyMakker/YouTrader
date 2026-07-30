/**
 * Phase 1E — local PostgreSQL RLS / read-path assertions.
 * Does NOT touch production. Requires local postgres :55432.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  createAccountManagementService,
} from "../src/propOs/accounts/index";
import {
  createPsqlAccountStore,
  ensureAuthUser,
  ensureInternalPrefsTable,
} from "./prop-os-accounts-pg-store";

const DB = process.env.PROP_OS_ACTIVATION_DB ?? "prop_os_activation1e";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const NOW = "2026-01-10T12:00:00.000Z";

function psql(sql: string, extraEnv: Record<string, string> = {}): string {
  return execFileSync(
    "psql",
    ["-d", DB, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `/opt/homebrew/opt/postgresql@17/bin:${process.env.PATH ?? ""}`,
        PGHOST: process.env.PGHOST ?? "localhost",
        PGPORT: process.env.PGPORT ?? "55432",
        PGUSER: process.env.PGUSER ?? "postgres",
        ...extraEnv,
      },
    },
  ).trim();
}

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  OK  ${name}`);
}

function baseRules() {
  return {
    version: "rs-1e-pg",
    firmKey: "fixture-firm",
    currency: "USD",
    firmTimezone: "America/New_York",
    tradingDayRolloverHour: 0,
    profitTargetMinor: 300_000,
    dailyLossLimitMinor: 1_000_000,
    dailyLossBasis: "realized_only" as const,
    dailyLossPolicyVersion: "daily-loss-v0" as const,
    drawdown: { kind: "static" as const, amountMinor: 200_000 },
    minimumTradingDays: 1,
  };
}

async function main() {
  console.log("prop-os-activation-pg-qa");
  ensureInternalPrefsTable(DB);
  ensureAuthUser(DB, USER_A, "a@example.com");
  ensureAuthUser(DB, USER_B, "b@example.com");

  const store = createPsqlAccountStore(DB);
  const svc = createAccountManagementService(store);

  const account = await svc.createPropAccount({
    userId: USER_A,
    label: "A",
    accountSizeMinor: 5_000_000,
    firmTimezone: "America/New_York",
    nowUtc: NOW,
  });
  const { challenge } = await svc.createChallengeAttempt({
    userId: USER_A,
    accountId: account.id,
    ruleSnapshot: baseRules(),
    nowUtc: NOW,
  });
  await svc.setDefaultAccount(USER_A, account.id);

  // Seed engine snapshot as service_role
  psql(`
    set role service_role;
    insert into public.prop_engine_snapshots (
      id, user_id, challenge_id, calculation_version, rule_set_version, input_revision,
      calculated_at, status, payload, confidence, limitations,
      readiness_model_version, confidence_policy_version, schema_version, created_at
    ) values (
      gen_random_uuid(), '${USER_A}'::uuid, '${challenge.id}'::uuid,
      'calc-spec-v0', 'rs-1e-pg', 'rev-1', '${NOW}'::timestamptz, 'ok',
      '{"accountState":{}}'::jsonb, '{}'::jsonb, '[]'::jsonb,
      null, 'confidence-policy-v0', 'prop-os-schema-v0', '${NOW}'::timestamptz
    );
    reset role;
  `);

  check("preferences table exists (Option A)", () => {
    assert.equal(psql(`select to_regclass('public.prop_os_user_preferences')`), "prop_os_user_preferences");
  });

  check("owner can SELECT own account", () => {
    const n = psql(`
      select set_config('request.jwt.claim.sub', '${USER_A}', true);
      set local role authenticated;
      select count(*)::text from public.prop_accounts where id = '${account.id}'::uuid;
    `);
    assert.equal(n.split("\n").pop(), "1");
  });

  check("cross-user SELECT rejected (0 rows)", () => {
    const n = psql(`
      select set_config('request.jwt.claim.sub', '${USER_B}', true);
      set local role authenticated;
      select count(*)::text from public.prop_accounts where id = '${account.id}'::uuid;
    `);
    assert.equal(n.split("\n").pop(), "0");
  });

  check("authenticated cannot INSERT engine snapshot", () => {
    let failed = false;
    try {
      psql(`
        select set_config('request.jwt.claim.sub', '${USER_A}', true);
        set local role authenticated;
        insert into public.prop_engine_snapshots (
          id, user_id, challenge_id, calculation_version, rule_set_version, input_revision,
          calculated_at, status, payload, confidence, limitations,
          confidence_policy_version, schema_version, created_at
        ) values (
          gen_random_uuid(), '${USER_A}'::uuid, '${challenge.id}'::uuid,
          'calc-spec-v0', 'rs-1e-pg', 'rev-x', now(), 'ok',
          '{}'::jsonb, '{}'::jsonb, '[]'::jsonb,
          'confidence-policy-v0', 'prop-os-schema-v0', now()
        );
      `);
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
  });

  check("authenticated cannot UPDATE engine snapshot", () => {
    let failed = false;
    try {
      psql(`
        select set_config('request.jwt.claim.sub', '${USER_A}', true);
        set local role authenticated;
        update public.prop_engine_snapshots set status = 'tampered' where challenge_id = '${challenge.id}'::uuid;
      `);
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    const status = psql(
      `select status from public.prop_engine_snapshots where challenge_id = '${challenge.id}'::uuid limit 1`,
    );
    assert.equal(status, "ok");
  });

  check("owner can read own preferences; other cannot", () => {
    const own = psql(`
      select set_config('request.jwt.claim.sub', '${USER_A}', true);
      set local role authenticated;
      select count(*)::text from public.prop_os_user_preferences where user_id = '${USER_A}'::uuid;
    `);
    assert.equal(own.split("\n").pop(), "1");
    const other = psql(`
      select set_config('request.jwt.claim.sub', '${USER_B}', true);
      set local role authenticated;
      select count(*)::text from public.prop_os_user_preferences where user_id = '${USER_A}'::uuid;
    `);
    assert.equal(other.split("\n").pop(), "0");
  });

  check("default account is not authorization (B still cannot read A account)", () => {
    // Even if B somehow wrote a preference pointing at A's account — trigger should block;
    // and SELECT on accounts still owner-scoped.
    let blocked = false;
    try {
      psql(`
        set role service_role;
        insert into public.prop_os_user_preferences (user_id, default_account_id)
        values ('${USER_B}'::uuid, '${account.id}'::uuid);
        reset role;
      `);
    } catch {
      blocked = true;
    }
    assert.equal(blocked, true);
  });

  check("archived account remains owner-readable", async () => {
    await svc.archiveAccount(USER_A, account.id, NOW);
    const n = psql(`
      select set_config('request.jwt.claim.sub', '${USER_A}', true);
      set local role authenticated;
      select count(*)::text from public.prop_accounts
      where id = '${account.id}'::uuid and status = 'archived';
    `);
    assert.equal(n.split("\n").pop(), "1");
  });

  console.log(`prop-os-activation-pg-qa: PASS (${passed})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
