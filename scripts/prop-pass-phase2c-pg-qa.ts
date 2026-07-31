/**
 * Phase 2C PG — assignment commands via authenticated JWT role simulation.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { ensureAuthUser } from "./prop-os-accounts-pg-store";

const DB = process.env.PROP_OS_PHASE2C_DB ?? "prop_os_phase2c";
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
  psql(`select public.prop_os_cmd_admin_allowlist_add('${userId}'::uuid, 'phase2c');`);
}

function seedAccountChallenge() {
  const body = {
    label: "2C Acc",
    firmKey: "apex-demo",
    accountSizeMinor: 5_000_000,
    currency: "USD",
    firmTimezone: "America/New_York",
  };
  const h = hash("create_account", body);
  const out = asAuth(
    OWNER,
    `select public.prop_os_cmd_create_account(
      'req-2c-acc', '${h}', '2C Acc', 'apex-demo', 5000000, 'USD', 'America/New_York'
    );`,
  );
  assert.equal(parseJson(out).kind, "success");
  const accId = psql(
    `select id::text from public.prop_accounts where user_id = '${OWNER}'::uuid limit 1`,
  );
  const snap = JSON.stringify({
    version: "rs-2c",
    firmKey: "apex-demo",
    currency: "USD",
    firmTimezone: "America/New_York",
    tradingDayRolloverHour: 0,
    profitTargetMinor: 300000,
    dailyLossLimitMinor: 100000,
    dailyLossBasis: "realized_only",
    dailyLossPolicyVersion: "daily-loss-v0",
    drawdown: { kind: "static", amountMinor: 200000 },
    minimumTradingDays: 1,
  }).replace(/'/g, "''");
  const chBody = { accountId: accId, templateId: "internal.apex-demo.eval.static", ruleSnapshot: { version: "rs-2c" } };
  const chH = hash("create_challenge_attempt", chBody);
  const chOut = asAuth(
    OWNER,
    `select public.prop_os_cmd_create_challenge_attempt(
      'req-2c-ch', '${chH}', '${accId}'::uuid,
      'internal.apex-demo.eval.static', '2026.07.1',
      '${snap}'::jsonb, 'evaluation', '2026-01-01T00:00:00Z'::timestamptz, null
    );`,
  );
  assert.equal(parseJson(chOut).kind, "success");
  const chId = psql(
    `select id::text from public.prop_challenges where account_id = '${accId}'::uuid limit 1`,
  );
  return { accId, chId };
}

function seedJournal(userId: string, clientId: string, pnl: number, exitTime: string) {
  psql(`
    begin;
    select set_config('request.jwt.claim.sub', '${userId}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);
    insert into public.trade_journal (
      id, user_id, client_id, trade_date, symbol, direction, contracts, pnl,
      entry_time, exit_time, mood, notes, created_at, updated_at
    ) values (
      gen_random_uuid(), '${userId}'::uuid, '${clientId}', '2026-02-01', 'ES', 'LONG', 1, ${pnl},
      '${exitTime}'::timestamptz, '${exitTime}'::timestamptz, 'ok', '', now(), now()
    )
    on conflict (user_id, client_id) do nothing;
    commit;
  `);
}

function main() {
  console.log("prop-pass-phase2c-pg-qa");
  ensureAuthUser(DB, OWNER, "owner-2c@example.com");
  ensureAuthUser(DB, OTHER, "other-2c@example.com");
  allowlist(OWNER);
  allowlist(OTHER);
  psql(`select public.prop_os_cmd_admin_set_enabled(true);`);

  check("PUBLIC cannot execute assign RPCs", () => {
    const has = psql(`
      select has_function_privilege('public',
        'public.prop_os_cmd_assign_trades(text,text,uuid,uuid,text[],text,text,boolean)', 'EXECUTE')::text;
    `);
    assert.ok(has === "f" || has === "false");
  });

  check("unauthenticated assign → forbidden", () => {
    const out = psql(`
      reset role;
      select set_config('request.jwt.claim.sub', '', true);
      select public.prop_os_cmd_assign_trades(
        'req-unauth', 'h', gen_random_uuid(), gen_random_uuid(), array['t1'], 'manual', null, false
      );
    `);
    assert.equal(parseJson(out).kind, "forbidden");
  });

  const { accId, chId } = seedAccountChallenge();
  seedJournal(OWNER, "jt1", 150, "2026-02-01T15:00:00Z");
  seedJournal(OWNER, "jt2", -20, "2026-02-02T15:00:00Z");
  seedJournal(OTHER, "other-jt", 99, "2026-02-01T15:00:00Z");

  check("owner assign + idempotent replay", () => {
    const body = {
      accountId: accId,
      challengeId: chId,
      tradeClientIds: ["jt1"],
      source: "manual",
    };
    const h = hash("assign_trades", {
      accountId: accId,
      challengeId: chId,
      tradeClientIds: ["jt1"],
      source: "manual",
    });
    // Use FNV-style hash from app? PG QA uses sha256 slice — receipt stores whatever client sends.
    // Memory/RPC use hashPropOsCommandPayload. For PG direct call, any stable hash works for replay.
    void body;
    const out1 = asAuth(
      OWNER,
      `select public.prop_os_cmd_assign_trades(
        'req-asg-1', '${h}', '${accId}'::uuid, '${chId}'::uuid, array['jt1'], 'manual', null, false
      );`,
    );
    const j1 = parseJson(out1);
    assert.equal(j1.kind, "success", JSON.stringify(j1));
    const out2 = asAuth(
      OWNER,
      `select public.prop_os_cmd_assign_trades(
        'req-asg-1', '${h}', '${accId}'::uuid, '${chId}'::uuid, array['jt1'], 'manual', null, false
      );`,
    );
    assert.equal(parseJson(out2).kind, "success");
    const cnt = psql(`
      select count(*) from public.prop_trade_assignment_events
      where user_id = '${OWNER}'::uuid and trade_client_id = 'jt1' and state = 'assigned'
    `);
    assert.equal(cnt, "1");
  });

  check("hash mismatch conflict", () => {
    const out = asAuth(
      OWNER,
      `select public.prop_os_cmd_assign_trades(
        'req-asg-1', 'different-hash-xxxxxxxxxxxx', '${accId}'::uuid, '${chId}'::uuid,
        array['jt1','jt2'], 'manual', null, false
      );`,
    );
    const j = parseJson(out);
    assert.equal(j.kind, "conflict");
  });

  check("cross-user trade assign denied", () => {
    const h = hash("assign_trades", { t: "other" });
    const out = asAuth(
      OWNER,
      `select public.prop_os_cmd_assign_trades(
        'req-asg-x', '${h}', '${accId}'::uuid, '${chId}'::uuid, array['other-jt'], 'manual', null, false
      );`,
    );
    const j = parseJson(out);
    assert.ok(j.kind === "validation_error" || j.kind === "conflict" || j.kind === "forbidden");
  });

  check("direct DML on events denied; journal unchanged", () => {
    const pnlBefore = psql(`select pnl::text from public.trade_journal where client_id = 'jt1'`);
    let denied = false;
    try {
      asAuth(
        OWNER,
        `update public.prop_trade_assignment_events set state = 'removed' where user_id = '${OWNER}'::uuid;`,
      );
    } catch {
      denied = true;
    }
    assert.equal(denied, true);
    const pnlAfter = psql(`select pnl::text from public.trade_journal where client_id = 'jt1'`);
    assert.equal(pnlBefore, pnlAfter);
  });

  check("kill switch blocks assign", () => {
    psql(`select public.prop_os_cmd_admin_set_enabled(false);`);
    const out = asAuth(
      OWNER,
      `select public.prop_os_cmd_assign_trades(
        'req-asg-off', 'hoff', '${accId}'::uuid, '${chId}'::uuid, array['jt2'], 'manual', null, false
      );`,
    );
    assert.equal(parseJson(out).kind, "forbidden");
    psql(`select public.prop_os_cmd_admin_set_enabled(true);`);
  });

  check("App authenticated cannot complete recalculation", () => {
    const can = psql(`
      select has_function_privilege(
        'authenticated',
        'public.prop_os_cmd_complete_recalculation(text,text,uuid,bigint,bigint)',
        'EXECUTE'
      )::text;
    `);
    assert.ok(can === "f" || can === "false");
    let denied = false;
    try {
      asAuth(
        OWNER,
        `select public.prop_os_cmd_complete_recalculation(
          'req-recalc-auth', 'h', '${chId}'::uuid, 1, 1
        );`,
      );
    } catch {
      denied = true;
    }
    assert.equal(denied, true);
  });

  check("processor complete requires snapshots; stale claim conflicts", () => {
    const rev = Number(
      psql(`select assignment_revision from public.prop_os_challenge_recalc where challenge_id = '${chId}'::uuid`),
    );
    const incomplete = psql(`
      begin;
      set local role prop_os_recalc_processor;
      select public.prop_os_cmd_complete_recalculation(
        'req-recalc-1', 'h1', '${chId}'::uuid, ${rev}, ${rev}
      );
      commit;
    `);
    assert.equal(parseJson(incomplete).kind, "conflict");
    assert.equal(parseJson(incomplete).reasonCode, "snapshots_incomplete");

    const stale = psql(`
      begin;
      set local role prop_os_recalc_processor;
      select public.prop_os_cmd_complete_recalculation(
        'req-recalc-stale', 'hstale', '${chId}'::uuid, ${rev - 1}, ${rev - 1}
      );
      commit;
    `);
    assert.equal(parseJson(stale).kind, "conflict");
    assert.equal(parseJson(stale).reasonCode, "stale_recalculation");
  });

  console.log(`prop-pass-phase2c-pg-qa: PASS (${passed})`);
}

main();
