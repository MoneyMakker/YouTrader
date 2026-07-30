/**
 * Phase 2B PG — RPC commands via authenticated JWT role simulation.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { ensureAuthUser } from "./prop-os-accounts-pg-store";
import { buildRuleConfirmationSummary, getPropOsTemplate } from "../src/propOs/templates/index";

const DB = process.env.PROP_OS_PHASE2B_DB ?? "prop_os_phase2b";
const OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  OK  ${name}`);
}

function psql(sql: string): string {
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
      },
    },
  ).trim();
}

function hash(commandType: string, body: unknown): string {
  return createHash("sha256")
    .update(`${commandType}\0${JSON.stringify(body)}`)
    .digest("hex")
    .slice(0, 32);
}

function asAuth(userId: string, sql: string): string {
  return psql(`
    begin;
    select set_config('request.jwt.claim.sub', '${userId}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;
    ${sql}
    commit;
  `);
}

function parseJson(raw: string): Record<string, unknown> {
  const lines = raw.split("\n").filter((l) => l.startsWith("{") || l.startsWith("["));
  const joined = lines.join("") || raw;
  const start = joined.indexOf("{");
  const end = joined.lastIndexOf("}");
  assert.ok(start >= 0 && end > start, `no json in: ${raw}`);
  return JSON.parse(joined.slice(start, end + 1)) as Record<string, unknown>;
}

function allowlist(userId: string) {
  psql(`select public.prop_os_cmd_admin_allowlist_add('${userId}'::uuid, 'phase2b-pg');`);
}

function main() {
  console.log("prop-pass-phase2b-pg-qa");
  ensureAuthUser(DB, OWNER, "owner-2b@example.com");
  ensureAuthUser(DB, OTHER, "other-2b@example.com");
  allowlist(OWNER);
  // OTHER intentionally not allowlisted for cross-user; add for ownership-forbidden path
  allowlist(OTHER);
  psql(`select public.prop_os_cmd_admin_set_enabled(true);`);

  check("unauthenticated command denied", () => {
    let denied = false;
    try {
      psql(`
        reset role;
        select public.prop_os_cmd_create_account(
          'req-unauth-1', 'hash1', 'L', 'apex-demo', 5000000, 'USD', 'America/New_York'
        );
      `);
    } catch {
      denied = true;
    }
    // function returns forbidden jsonb when auth.uid null via exception path
    if (!denied) {
      const out = psql(`
        reset role;
        select public.prop_os_cmd_create_account(
          'req-unauth-2', 'hash2', 'L', 'apex-demo', 5000000, 'USD', 'America/New_York'
        );
      `);
      const j = parseJson(out);
      assert.equal(j.kind, "forbidden");
    }
  });

  check("owner create account + idempotent replay", () => {
    const body = {
      label: "PG Eval",
      firmKey: "apex-demo",
      accountSizeMinor: 5000000,
      currency: "USD",
      firmTimezone: "America/New_York",
    };
    const h = hash("create_account", body);
    const out1 = asAuth(
      OWNER,
      `select public.prop_os_cmd_create_account(
        'req-pg-acc-1', '${h}', 'PG Eval', 'apex-demo', 5000000, 'USD', 'America/New_York'
      );`,
    );
    const j1 = parseJson(out1);
    assert.equal(j1.kind, "success");
    const out2 = asAuth(
      OWNER,
      `select public.prop_os_cmd_create_account(
        'req-pg-acc-1', '${h}', 'PG Eval', 'apex-demo', 5000000, 'USD', 'America/New_York'
      );`,
    );
    const j2 = parseJson(out2);
    assert.equal(j2.kind, "success");
    const id1 = (j1.value as { account: { id: string } }).account.id;
    const id2 = (j2.value as { account: { id: string } }).account.id;
    assert.equal(id1, id2);
    const count = psql(
      `select count(*) from public.prop_accounts where user_id = '${OWNER}'::uuid`,
    );
    assert.equal(count, "1");
  });

  check("challenge create atomic + rule snapshot", () => {
    const accId = psql(
      `select id::text from public.prop_accounts where user_id = '${OWNER}'::uuid limit 1`,
    );
    const tpl = getPropOsTemplate("internal.apex-demo.eval.static")!;
    const conf = buildRuleConfirmationSummary(tpl, 5_000_000);
    const snap = JSON.stringify(conf.ruleSnapshot).replace(/'/g, "''");
    const body = {
      accountId: accId,
      templateId: conf.templateId,
      ruleSnapshot: conf.ruleSnapshot,
    };
    const h = hash("create_challenge_attempt", body);
    const out = asAuth(
      OWNER,
      `select public.prop_os_cmd_create_challenge_attempt(
        'req-pg-ch-1', '${h}', '${accId}'::uuid,
        '${conf.templateId}', '${conf.templateVersion}',
        '${snap}'::jsonb, 'evaluation', now(), null
      );`,
    );
    const j = parseJson(out);
    assert.equal(j.kind, "success");
    const chId = (j.value as { challenge: { id: string } }).challenge.id;
    const rules = psql(
      `select count(*) from public.prop_challenge_rule_snapshots where challenge_id = '${chId}'::uuid`,
    );
    assert.equal(rules, "1");
  });

  check("cross-user mutate forbidden; direct DML denied", () => {
    const accId = psql(
      `select id::text from public.prop_accounts where user_id = '${OWNER}'::uuid limit 1`,
    );
    const out = asAuth(
      OTHER,
      `select public.prop_os_cmd_set_default_account(
        'req-pg-def-x', 'hx', '${accId}'::uuid
      );`,
    );
    const j = parseJson(out);
    assert.equal(j.kind, "forbidden");

    let dmlDenied = false;
    try {
      asAuth(
        OWNER,
        `insert into public.prop_accounts (
          id, user_id, firm_key, label, account_size_minor, currency, firm_timezone, status, source
        ) values (
          gen_random_uuid(), '${OWNER}'::uuid, 'x', 'direct', 100, 'USD', 'UTC', 'active', 'user_created'
        );`,
      );
    } catch {
      dmlDenied = true;
    }
    assert.equal(dmlDenied, true);
  });

  check("select challenge + archive with confirm", () => {
    const accId = psql(
      `select id::text from public.prop_accounts where user_id = '${OWNER}'::uuid limit 1`,
    );
    const chId = psql(
      `select id::text from public.prop_challenges where account_id = '${accId}'::uuid limit 1`,
    );
    const sel = asAuth(
      OWNER,
      `select public.prop_os_cmd_select_challenge(
        'req-pg-sel-1', 'hs', '${accId}'::uuid, '${chId}'::uuid
      );`,
    );
    assert.equal(parseJson(sel).kind, "success");

    const need = asAuth(
      OWNER,
      `select public.prop_os_cmd_archive_account(
        'req-pg-arch-1', 'ha', '${accId}'::uuid, false
      );`,
    );
    assert.equal(parseJson(need).kind, "conflict");

    const arch = asAuth(
      OWNER,
      `select public.prop_os_cmd_archive_account(
        'req-pg-arch-2', 'hb', '${accId}'::uuid, true
      );`,
    );
    assert.equal(parseJson(arch).kind, "success");
    const status = psql(`select status from public.prop_accounts where id = '${accId}'::uuid`);
    assert.equal(status, "archived");
    // history still readable as owner
    const readable = asAuth(
      OWNER,
      `select count(*)::text from public.prop_accounts where id = '${accId}'::uuid;`,
    );
    assert.ok(readable.includes("1"));
  });

  check("service-role strings absent from App command paths", () => {
    const files = [
      "src/propPass/commandGateway.ts",
      "src/propOs/commands/rpcWriteService.ts",
      "src/propPass/PropPassOnboardingFlow.tsx",
    ];
    for (const f of files) {
      const body = execFileSync("cat", [`${process.cwd()}/${f}`], { encoding: "utf8" });
      assert.equal(/SUPABASE_SERVICE_ROLE|service_role\s*=/.test(body), false, f);
    }
  });

  console.log(`prop-pass-phase2b-pg-qa: PASS (${passed})`);
}

main();
