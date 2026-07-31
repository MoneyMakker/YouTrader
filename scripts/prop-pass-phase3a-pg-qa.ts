/**
 * Phase 3A PG — Performance Intelligence RPC security + RLS.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureAuthUser } from "./prop-os-accounts-pg-store";

const ROOT = path.resolve(import.meta.dirname, "..");
const DB = process.env.PROP_OS_PHASE3A_DB ?? "prop_os_phase3a";
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
  psql(`select public.prop_os_cmd_admin_allowlist_add('${userId}'::uuid, 'phase3a');`);
}

function seedAccountChallenge() {
  const body = {
    label: "3A Acc",
    firmKey: "apex-demo",
    accountSizeMinor: 5_000_000,
    currency: "USD",
    firmTimezone: "America/New_York",
  };
  const h = hash("create_account", body);
  const out = asAuth(
    OWNER,
    `select public.prop_os_cmd_create_account(
      'req-3a-acc', '${h}', '3A Acc', 'apex-demo', 5000000, 'USD', 'America/New_York'
    );`,
  );
  assert.equal(parseJson(out).kind, "success");
  const accId = psql(
    `select id::text from public.prop_accounts where user_id = '${OWNER}'::uuid limit 1`,
  );
  const snap = JSON.stringify({
    version: "rs-3a",
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
  const chBody = { accountId: accId, templateId: "internal.apex-demo.eval.static", ruleSnapshot: { version: "rs-3a" } };
  const chH = hash("create_challenge_attempt", chBody);
  const chOut = asAuth(
    OWNER,
    `select public.prop_os_cmd_create_challenge_attempt(
      'req-3a-ch', '${chH}', '${accId}'::uuid,
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

function scopeKeyAccount(accId: string): string {
  const scope = { kind: "account", accountId: accId, includeArchivedChallenges: false };
  return createHash("sha256").update(JSON.stringify(scope)).digest("hex");
}

function main() {
  console.log("prop-pass-phase3a-pg-qa");
  ensureAuthUser(DB, OWNER, "owner-3a@example.com");
  ensureAuthUser(DB, OTHER, "other-3a@example.com");
  allowlist(OWNER);
  psql(`select public.prop_os_cmd_admin_set_enabled(true);`);

  check("unauthenticated snapshot select denied / empty under RLS", () => {
    const cnt = psql(`
      reset role;
      select set_config('request.jwt.claim.sub', '', true);
      select count(*)::text from public.prop_performance_intelligence_snapshots;
    `)
      .split("\n")
      .filter(Boolean)
      .pop();
    assert.equal(cnt, "0");
  });

  check("PUBLIC cannot execute PI request RPC", () => {
    const has = psql(`
      select has_function_privilege('public',
        'public.prop_os_cmd_request_performance_intelligence(text,text,uuid,jsonb,text)', 'EXECUTE')::text;
    `);
    assert.ok(has === "f" || has === "false");
  });

  const { accId } = seedAccountChallenge();
  const sk = scopeKeyAccount(accId);
  const scopeJson = JSON.stringify({
    kind: "account",
    accountId: accId,
    includeArchivedChallenges: false,
  }).replace(/'/g, "''");

  check("allowlisted request_performance_intelligence works", () => {
    const out = asAuth(
      OWNER,
      `select public.prop_os_cmd_request_performance_intelligence(
        'req-pi-1', 'hpi1', '${accId}'::uuid, '${scopeJson}'::jsonb, '${sk}'
      );`,
    );
    const j = parseJson(out);
    assert.equal(j.kind, "queued", JSON.stringify(j));
  });

  check("non-allowlisted request forbidden", () => {
    const out = asAuth(
      OTHER,
      `select public.prop_os_cmd_request_performance_intelligence(
        'req-pi-other', 'hpi2', '${accId}'::uuid, '${scopeJson}'::jsonb, '${sk}'
      );`,
    );
    assert.equal(parseJson(out).kind, "forbidden");
  });

  check("kill switch blocks PI request", () => {
    psql(`select public.prop_os_cmd_admin_set_enabled(false);`);
    const out = asAuth(
      OWNER,
      `select public.prop_os_cmd_request_performance_intelligence(
        'req-pi-off', 'hpioff', '${accId}'::uuid, '${scopeJson}'::jsonb, '${sk}'
      );`,
    );
    assert.equal(parseJson(out).kind, "forbidden");
    psql(`select public.prop_os_cmd_admin_set_enabled(true);`);
  });

  check("authenticated INSERT on snapshots denied", () => {
    let denied = false;
    try {
      asAuth(
        OWNER,
        `insert into public.prop_performance_intelligence_snapshots (
          user_id, account_id, scope_kind, scope_key, scope_json, assignment_revision,
          input_revision, metric_spec_version, engine_version, status, dataset_summary,
          performance, risk, sequences, segments, findings, identity_hash, source_trade_count
        ) values (
          '${OWNER}'::uuid, '${accId}'::uuid, 'account', '${sk}', '{}'::jsonb, 0,
          'test', 'pi-metric-spec-v0', 'pi-engine-v0', 'current', '{}'::jsonb,
          '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, 'x', 0
        );`,
      );
    } catch {
      denied = true;
    }
    assert.equal(denied, true);
  });

  check("authenticated cannot EXECUTE complete/fail PI functions", () => {
    for (const fn of [
      "public.prop_os_cmd_complete_performance_intelligence(uuid,text,bigint,jsonb)",
      "public.prop_os_cmd_fail_performance_intelligence(uuid,text,bigint,text)",
    ]) {
      const can = psql(`select has_function_privilege('authenticated', '${fn}', 'EXECUTE')::text;`);
      assert.ok(can === "f" || can === "false", fn);
    }
    let denied = false;
    try {
      asAuth(
        OWNER,
        `select public.prop_os_cmd_complete_performance_intelligence(
          '${OWNER}'::uuid, '${sk}', 0, '{}'::jsonb
        );`,
      );
    } catch {
      denied = true;
    }
    assert.equal(denied, true);
  });

  check("processor complete with stale revision → conflict", () => {
    psql(`
      insert into public.prop_os_assignment_revisions (user_id, revision, updated_at)
      values ('${OWNER}'::uuid, 2, now())
      on conflict (user_id) do update set revision = 2, updated_at = now();
    `);
    const stale = psql(`
      begin;
      set local role prop_os_performance_intelligence_processor;
      select public.prop_os_cmd_complete_performance_intelligence(
        '${OWNER}'::uuid,
        '${sk}',
        1,
        jsonb_build_object(
          'accountId', '${accId}',
          'inputRevision', 'pi-rev-1:test',
          'status', 'current',
          'metricSpecVersion', 'pi-metric-spec-v0',
          'engineVersion', 'pi-engine-v0',
          'scope', jsonb_build_object('kind','account','accountId','${accId}','includeArchivedChallenges',false),
          'datasetSummary', jsonb_build_object('tradeCount', 0, 'identityHash', 'x'),
          'performance', '{}'::jsonb,
          'risk', '{}'::jsonb,
          'sequences', '{}'::jsonb,
          'segments', '[]'::jsonb,
          'findings', '[]'::jsonb,
          'sourceRange', jsonb_build_object('earliestTradeAt', null, 'latestTradeAt', null),
          'schemaVersion', 'prop-os-schema-v0'
        )
      );
      commit;
    `);
    const j = parseJson(stale);
    assert.equal(j.kind, "conflict");
    assert.equal(j.reasonCode, "stale_assignment_revision");
  });

  check("assignment recalc processor cannot EXECUTE PI complete", () => {
    const can = psql(`
      select has_function_privilege(
        'prop_os_recalc_processor',
        'public.prop_os_cmd_complete_performance_intelligence(uuid,text,bigint,jsonb)',
        'EXECUTE'
      )::text;
    `);
    assert.ok(can === "f" || can === "false");
  });

  check("PI processor has EXECUTE on complete; uniqueness index exists", () => {
    const can = psql(`
      select has_function_privilege(
        'prop_os_performance_intelligence_processor',
        'public.prop_os_cmd_complete_performance_intelligence(uuid,text,bigint,jsonb)',
        'EXECUTE'
      )::text;
    `);
    assert.ok(can === "t" || can === "true");
    const idx = psql(`
      select count(*)::text from pg_indexes
      where indexname = 'prop_pi_snapshots_logical_identity_uidx';
    `);
    assert.equal(idx, "1");
  });

  check("publication failure injection rolls back current", () => {
    psql(`
      insert into public.prop_os_assignment_revisions (user_id, revision, updated_at)
      values ('${OWNER}'::uuid, 3, now())
      on conflict (user_id) do update set revision = 3, updated_at = now();
      insert into public.prop_performance_intelligence_calc (
        user_id, scope_key, scope_json, account_id, assignment_revision, state
      ) values (
        '${OWNER}'::uuid, '${sk}', '${scopeJson}'::jsonb, '${accId}'::uuid, 3, 'queued'
      )
      on conflict (user_id, scope_key) do update
        set state = 'queued', assignment_revision = 3, updated_at = now();
    `);
    for (const stage of [
      "pi_queue_claim",
      "pi_snapshot_insert",
      "pi_finding_insert",
      "pi_current_projection",
      "pi_queue_completion",
      "pi_receipt_completion",
    ]) {
      let failed = false;
      try {
        psql(`
          begin;
          select set_config('prop_os.fail_after', '${stage}', true);
          set local role prop_os_performance_intelligence_processor;
          select public.prop_os_cmd_complete_performance_intelligence(
            '${OWNER}'::uuid, '${sk}', 3,
            jsonb_build_object(
              'accountId', '${accId}',
              'inputRevision', 'pi-rev-3:${stage}',
              'status', 'current',
              'metricSpecVersion', 'pi-metric-spec-v0',
              'engineVersion', 'pi-engine-v0',
              'clientRequestId', 'pireq-${stage}',
              'scope', jsonb_build_object('kind','account','accountId','${accId}','includeArchivedChallenges',false),
              'datasetSummary', jsonb_build_object('tradeCount', 0, 'identityHash', 'inj'),
              'performance', '{}'::jsonb,
              'risk', '{}'::jsonb,
              'sequences', '{}'::jsonb,
              'segments', '[]'::jsonb,
              'findings', '[]'::jsonb,
              'sourceRange', jsonb_build_object('earliestTradeAt', null, 'latestTradeAt', null),
              'schemaVersion', 'prop-os-schema-v0'
            )
          );
          commit;
        `);
      } catch {
        failed = true;
      }
      assert.equal(failed, true, stage);
      const cur = psql(`
        select count(*)::text from public.prop_performance_intelligence_current
        where user_id = '${OWNER}'::uuid and scope_key = '${sk}' and input_revision = 'pi-rev-3:${stage}';
      `);
      assert.equal(cur, "0", stage);
      const completed = psql(`
        select count(*)::text from public.prop_performance_intelligence_calc
        where user_id = '${OWNER}'::uuid and scope_key = '${sk}' and state = 'completed'
          and snapshot_id in (
            select id from public.prop_performance_intelligence_snapshots
            where input_revision = 'pi-rev-3:${stage}'
          );
      `);
      assert.equal(completed, "0", stage);
      const receipt = psql(`
        select count(*)::text from public.prop_os_command_receipts
        where user_id = '${OWNER}'::uuid and client_request_id = 'pireq-${stage}'
          and result_status = 'success';
      `);
      assert.equal(receipt, "0", stage);
    }
    // successful retry
    const ok = psql(`
      begin;
      select set_config('prop_os.fail_after', '', true);
      set local role prop_os_performance_intelligence_processor;
      select public.prop_os_cmd_complete_performance_intelligence(
        '${OWNER}'::uuid, '${sk}', 3,
        jsonb_build_object(
          'accountId', '${accId}',
          'inputRevision', 'pi-rev-3:ok',
          'status', 'current',
          'metricSpecVersion', 'pi-metric-spec-v0',
          'engineVersion', 'pi-engine-v0',
          'clientRequestId', 'pireq-ok-final',
          'scope', jsonb_build_object('kind','account','accountId','${accId}','includeArchivedChallenges',false),
          'datasetSummary', jsonb_build_object('tradeCount', 0, 'identityHash', 'ok'),
          'performance', '{}'::jsonb,
          'risk', '{}'::jsonb,
          'sequences', '{}'::jsonb,
          'segments', '[]'::jsonb,
          'findings', '[]'::jsonb,
          'sourceRange', jsonb_build_object('earliestTradeAt', null, 'latestTradeAt', null),
          'schemaVersion', 'prop-os-schema-v0'
        )
      );
      commit;
    `);
    assert.equal(parseJson(ok).kind, "success");
    const parity = psql(`
      select public.prop_os_pi_projection_parity('${OWNER}'::uuid)::text;
    `);
    assert.ok(parity.includes('"kind":"parity"') || parity.includes('\\"kind\\":\\"parity\\"') || parseJson(parity).kind === "parity");
  });

  check("cross-user snapshot read denied under RLS", () => {
    psql(`
      begin;
      set local role service_role;
      insert into public.prop_performance_intelligence_snapshots (
        user_id, account_id, scope_kind, scope_key, scope_json, assignment_revision,
        input_revision, metric_spec_version, engine_version, status, dataset_summary,
        performance, risk, sequences, segments, findings, identity_hash, source_trade_count
      ) values (
        '${OTHER}'::uuid, '${accId}'::uuid, 'account', 'other-scope', '{}'::jsonb, 1,
        'pi-rev-1:other', 'pi-metric-spec-v0', 'pi-engine-v0', 'current',
        '{"tradeCount":0,"identityHash":"o"}'::jsonb,
        '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, 'other', 0
      );
      commit;
    `);
    const cntRaw = asAuth(
      OWNER,
      `select count(*)::text from public.prop_performance_intelligence_snapshots where user_id = '${OTHER}'::uuid;`,
    );
    const cnt = cntRaw
      .split("\n")
      .map((l) => l.trim())
      .find((l) => /^\d+$/.test(l));
    assert.equal(cnt, "0", cntRaw);
  });

  check("service-role credentials not in app bundle", () => {
    const scanPaths = [
      "App.tsx",
      "src/propPass/gatewayClient.ts",
      "src/propPass/commandGateway.ts",
      "src/propPass/PerformanceIntelligenceInternalPanel.tsx",
      "src/propOs/intelligence/index.ts",
    ];
    for (const rel of scanPaths) {
      const full = path.join(ROOT, rel);
      if (!fs.existsSync(full)) continue;
      const body = fs.readFileSync(full, "utf8");
      assert.equal(/SUPABASE_SERVICE_ROLE|service_role\s*[:=]/.test(body), false, rel);
    }
  });

  check("direct DML on PI tables denied for authenticated (note)", () => {
    let denied = false;
    try {
      asAuth(
        OWNER,
        `update public.prop_performance_intelligence_calc set state = 'failed' where user_id = '${OWNER}'::uuid;`,
      );
    } catch {
      denied = true;
    }
    assert.equal(denied, true);
  });

  console.log(`prop-pass-phase3a-pg-qa: PASS (${passed})`);
}

main();
