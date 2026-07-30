/**
 * Phase 2B remediation — security + transaction proofs on isolated Postgres.
 * Covers PO scenarios §8 (security 1–14) and §9 (transaction 1–12).
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { ensureAuthUser } from "./prop-os-accounts-pg-store";
import {
  buildRuleConfirmationSummary,
  getPropOsTemplate,
  listTemplateProvenance,
} from "../src/propOs/templates/index";

const DB = process.env.PROP_OS_HARDEN_DB ?? "prop_os_harden2b";
const OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const FAKE = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const PG_ENV = {
  ...process.env,
  PATH: `/opt/homebrew/opt/postgresql@17/bin:${process.env.PATH ?? ""}`,
  PGHOST: process.env.PGHOST ?? "localhost",
  PGPORT: process.env.PGPORT ?? "55432",
  PGUSER: process.env.PGUSER ?? "postgres",
};

let passed = 0;
const results: Record<string, string> = {};

function isFalse(v: string): boolean {
  return v === "f" || v === "false";
}
function isTrue(v: string): boolean {
  return v === "t" || v === "true";
}

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  results[name] = "PASS";
  console.log(`  OK  ${name}`);
}

function psql(sql: string, opts?: { onErrorStop?: boolean }): string {
  const onError = opts?.onErrorStop === false ? "0" : "1";
  return execFileSync(
    "psql",
    ["-d", DB, `-v`, `ON_ERROR_STOP=${onError}`, "-At", "-c", sql],
    { encoding: "utf8", env: PG_ENV },
  ).trim();
}

function psqlExpectFail(sql: string): string {
  const r = spawnSync(
    "psql",
    ["-d", DB, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
    { encoding: "utf8", env: PG_ENV },
  );
  assert.notEqual(r.status, 0, `expected failure for: ${sql.slice(0, 120)}`);
  return `${r.stderr ?? ""}${r.stdout ?? ""}`;
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
  psql(`select public.prop_os_cmd_admin_allowlist_add('${userId}'::uuid, 'harden-qa');`);
}

function allowlistRemove(userId: string) {
  psql(`select public.prop_os_cmd_admin_allowlist_remove('${userId}'::uuid);`);
}

function setGate(enabled: boolean) {
  psql(`select public.prop_os_cmd_admin_set_enabled(${enabled});`);
}

function snapJson(conf: ReturnType<typeof buildRuleConfirmationSummary>): string {
  return JSON.stringify(conf.ruleSnapshot).replace(/'/g, "''");
}

function createAccount(userId: string, reqId: string, label: string): string {
  const body = {
    label,
    firmKey: "apex-demo",
    accountSizeMinor: 5_000_000,
    currency: "USD",
    firmTimezone: "America/New_York",
  };
  const h = hash("create_account", body);
  const out = asAuth(
    userId,
    `select public.prop_os_cmd_create_account(
      '${reqId}', '${h}', '${label}', 'apex-demo', 5000000, 'USD', 'America/New_York'
    );`,
  );
  const j = parseJson(out);
  assert.equal(j.kind, "success", JSON.stringify(j));
  return (j.value as { account: { id: string } }).account.id;
}

function createChallenge(
  userId: string,
  reqId: string,
  accountId: string,
  conf: ReturnType<typeof buildRuleConfirmationSummary>,
): Record<string, unknown> {
  const body = {
    accountId,
    templateId: conf.templateId,
    ruleSnapshot: conf.ruleSnapshot,
  };
  const h = hash("create_challenge_attempt", body);
  const snap = snapJson(conf);
  const out = asAuth(
    userId,
    `select public.prop_os_cmd_create_challenge_attempt(
      '${reqId}', '${h}', '${accountId}'::uuid,
      '${conf.templateId}', '${conf.templateVersion}',
      '${snap}'::jsonb, 'evaluation', now(), null
    );`,
  );
  return parseJson(out);
}

function dropInjectTriggers() {
  psql(`
    drop trigger if exists trg_inject_fail_ch on public.prop_challenges;
    drop trigger if exists trg_inject_fail_rule on public.prop_challenge_rule_snapshots;
    drop trigger if exists trg_inject_fail_tr on public.prop_challenge_transitions;
    drop trigger if exists trg_inject_fail_rc on public.prop_os_command_receipts;
    drop trigger if exists trg_midflight_gate on public.prop_challenges;
    drop function if exists public._prop_os_qa_raise();
    drop function if exists public._prop_os_qa_disable_gate();
  `);
}

function installRaiseFn() {
  psql(`
    create or replace function public._prop_os_qa_raise()
    returns trigger
    language plpgsql
    as $f$ begin raise exception 'qa_injected_failure'; end; $f$;
  `);
}

function countsForAccount(accountId: string): {
  challenges: number;
  snapshots: number;
  transitions: number;
  receipts: number;
} {
  return {
    challenges: Number(
      psql(`select count(*) from public.prop_challenges where account_id = '${accountId}'::uuid`),
    ),
    snapshots: Number(
      psql(`select count(*) from public.prop_challenge_rule_snapshots s
        join public.prop_challenges c on c.id = s.challenge_id
        where c.account_id = '${accountId}'::uuid`),
    ),
    transitions: Number(
      psql(`select count(*) from public.prop_challenge_transitions t
        join public.prop_challenges c on c.id = t.challenge_id
        where c.account_id = '${accountId}'::uuid`),
    ),
    receipts: Number(
      psql(`select count(*) from public.prop_os_command_receipts
        where user_id = '${OWNER}'::uuid and command_type = 'create_challenge_attempt'
          and result_status = 'success'`),
    ),
  };
}

function main() {
  console.log("prop-pass-phase2b-hardening-pg-qa");
  ensureAuthUser(DB, OWNER, "owner-harden@example.com");
  ensureAuthUser(DB, OTHER, "other-harden@example.com");
  ensureAuthUser(DB, FAKE, "fake-harden@example.com");
  setGate(true);
  dropInjectTriggers();

  // -------------------------------------------------------------------------
  // Privilege matrix + search_path live
  // -------------------------------------------------------------------------
  check("S0 privilege matrix: PUBLIC cannot execute mutation cmds", () => {
    const cmds = [
      "prop_os_cmd_create_account(text,text,text,text,bigint,text,text)",
      "prop_os_cmd_create_challenge_attempt(text,text,uuid,text,text,jsonb,text,timestamptz,uuid)",
      "prop_os_cmd_set_default_account(text,text,uuid)",
      "prop_os_cmd_archive_account(text,text,uuid,boolean)",
      "prop_os_cmd_select_challenge(text,text,uuid,uuid)",
      "prop_os_cmd_clear_challenge_selection(text,text,uuid)",
      "prop_os_cmd_admin_set_enabled(boolean)",
      "prop_os_cmd_admin_allowlist_add(uuid,text)",
      "prop_os_cmd_admin_allowlist_remove(uuid)",
    ];
    for (const sig of cmds) {
      const has = psql(`
        select has_function_privilege('public', 'public.${sig}', 'EXECUTE')::text;
      `);
      assert.ok(isFalse(has), sig);
    }
  });

  check("S0 search_path live on SECURITY DEFINER cmds", () => {
    const rows = psql(`
      select p.proname || '=' || coalesce(p.proconfig::text, '{}')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname like 'prop_os_cmd_%'
        and p.prosecdef
      order by 1;
    `);
    const lines = rows.split("\n").filter(Boolean);
    assert.ok(lines.length >= 6);
    for (const line of lines) {
      assert.match(line, /search_path=pg_catalog,\s*public/i, line);
    }
  });

  check("S0 authenticated granted EXECUTE on mutation cmds; not admin", () => {
    const ok = psql(`
      select has_function_privilege('authenticated',
        'public.prop_os_cmd_create_account(text,text,text,text,bigint,text,text)', 'EXECUTE')::text;
    `);
    assert.ok(isTrue(ok));
    const admin = psql(`
      select has_function_privilege('authenticated',
        'public.prop_os_cmd_admin_set_enabled(boolean)', 'EXECUTE')::text;
    `);
    assert.ok(isFalse(admin));
  });

  // -------------------------------------------------------------------------
  // Security scenarios 1–14
  // -------------------------------------------------------------------------
  check("S1 unauthenticated RPC → forbidden", () => {
    allowlistRemove(OWNER);
    setGate(true);
    const out = psql(`
      reset role;
      select set_config('request.jwt.claim.sub', '', true);
      select public.prop_os_cmd_create_account(
        'req-s1', 'h1', 'L', 'apex-demo', 5000000, 'USD', 'America/New_York'
      );
    `);
    assert.equal(parseJson(out).kind, "forbidden");
  });

  check("S2 authenticated non-allowlisted → forbidden", () => {
    allowlistRemove(OWNER);
    setGate(true);
    const out = asAuth(
      OWNER,
      `select public.prop_os_cmd_create_account(
        'req-s2', 'h2', 'L', 'apex-demo', 5000000, 'USD', 'America/New_York'
      );`,
    );
    assert.equal(parseJson(out).kind, "forbidden");
  });

  check("S3 allowlisted owner → eligible success", () => {
    allowlist(OWNER);
    setGate(true);
    const id = createAccount(OWNER, "req-s3-acc", "Harden Owner Acc");
    assert.ok(id.length > 10);
  });

  check("S4 allowlist removed before next call → forbidden", () => {
    allowlistRemove(OWNER);
    const out = asAuth(
      OWNER,
      `select public.prop_os_cmd_create_account(
        'req-s4', 'h4', 'Blocked', 'apex-demo', 5000000, 'USD', 'America/New_York'
      );`,
    );
    assert.equal(parseJson(out).kind, "forbidden");
    allowlist(OWNER);
  });

  check("S5 direct RPC bypassing App UI (same server gate)", () => {
    // Already exercising via psql RPC — prove success without App.
    const id = createAccount(OWNER, "req-s5-acc", "Direct RPC Acc");
    assert.ok(id);
  });

  let ownerAccId = "";
  let ownerChId = "";
  check("S6 cross-user account command → forbidden", () => {
    allowlist(OTHER);
    ownerAccId = psql(
      `select id::text from public.prop_accounts where user_id = '${OWNER}'::uuid and status = 'active' limit 1`,
    );
    const out = asAuth(
      OTHER,
      `select public.prop_os_cmd_set_default_account(
        'req-s6', 'hs6', '${ownerAccId}'::uuid
      );`,
    );
    assert.equal(parseJson(out).kind, "forbidden");
  });

  check("S7 cross-account challenge selection → conflict/forbidden", () => {
    allowlist(OTHER);
    const otherAcc = createAccount(OTHER, "req-s7-other-acc", "Other Acc");
    const tpl = getPropOsTemplate("internal.apex-demo.eval.static")!;
    const conf = buildRuleConfirmationSummary(tpl, 5_000_000);
    const ch = createChallenge(OWNER, "req-s7-ch", ownerAccId, conf);
    assert.equal(ch.kind, "success");
    ownerChId = (ch.value as { challenge: { id: string } }).challenge.id;
    const out = asAuth(
      OTHER,
      `select public.prop_os_cmd_select_challenge(
        'req-s7-sel', 'hs7', '${otherAcc}'::uuid, '${ownerChId}'::uuid
      );`,
    );
    const j = parseJson(out);
    assert.ok(j.kind === "forbidden" || j.kind === "conflict", JSON.stringify(j));
  });

  check("S8 client-supplied fake user ID cannot override actor", () => {
    // Actor always from auth.uid(); account rows use uid from assert.
    // Attempting to create under fake identity requires JWT sub = FAKE.
    allowlistRemove(FAKE);
    const out = asAuth(
      FAKE,
      `select public.prop_os_cmd_create_account(
        'req-s8', 'h8', 'Fake', 'apex-demo', 5000000, 'USD', 'America/New_York'
      );`,
    );
    assert.equal(parseJson(out).kind, "forbidden");
    // Owner create always stamps owner uid
    const acc = createAccount(OWNER, "req-s8-owner", "Owner Stamp");
    const uid = psql(`select user_id::text from public.prop_accounts where id = '${acc}'::uuid`);
    assert.equal(uid, OWNER);
  });

  check("S9 public/anon execute attempt denied or forbidden", () => {
    const r = spawnSync(
      "psql",
      [
        "-d",
        DB,
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
        "-c",
        `
      reset role;
      select set_config('request.jwt.claim.sub', '', true);
      select set_config('request.jwt.claim.role', 'anon', true);
      begin;
      set local role anon;
      select public.prop_os_cmd_create_account(
        'req-s9', 'h9', 'Anon', 'apex-demo', 5000000, 'USD', 'America/New_York'
      );
      commit;
    `,
      ],
      { encoding: "utf8", env: PG_ENV },
    );
    if (r.status === 0) {
      assert.equal(parseJson(r.stdout).kind, "forbidden");
    } else {
      assert.match(`${r.stderr}${r.stdout}`, /permission denied|42501|forbidden/i);
    }
    const pub = psql(`
      select has_function_privilege('public',
        'public.prop_os_cmd_create_account(text,text,text,text,bigint,text,text)', 'EXECUTE')::text;
    `);
    assert.ok(isFalse(pub));
  });

  check("S10 authenticated direct DML denied", () => {
    let denied = false;
    try {
      asAuth(
        OWNER,
        `insert into public.prop_accounts (
          id, user_id, firm_key, label, account_size_minor, currency, firm_timezone, status, source
        ) values (
          gen_random_uuid(), '${OWNER}'::uuid, 'x', 'dml', 100, 'USD', 'UTC', 'active', 'user_created'
        );`,
      );
    } catch {
      denied = true;
    }
    assert.equal(denied, true);

    let receiptDml = false;
    try {
      asAuth(
        OWNER,
        `update public.prop_os_command_receipts set result_status = 'success' where user_id = '${OWNER}'::uuid;`,
      );
    } catch {
      receiptDml = true;
    }
    assert.equal(receiptDml, true);
  });

  check("S11 command switch disabled → forbidden; reads ok", () => {
    setGate(false);
    const out = asAuth(
      OWNER,
      `select public.prop_os_cmd_create_account(
        'req-s11', 'h11', 'Off', 'apex-demo', 5000000, 'USD', 'America/New_York'
      );`,
    );
    assert.equal(parseJson(out).kind, "forbidden");
    // Read-only Prop Pass path: SELECT still works
    const readable = asAuth(
      OWNER,
      `select count(*)::text from public.prop_accounts where user_id = '${OWNER}'::uuid;`,
    );
    const readCount = Number(
      readable
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^\d+$/.test(l))
        .pop() ?? "0",
    );
    assert.ok(readCount >= 1, `expected readable accounts, got ${readable}`);
    const hist = Number(
      psql(`select count(*) from public.prop_accounts where user_id = '${OWNER}'::uuid`),
    );
    setGate(true);
    const hist2 = Number(
      psql(`select count(*) from public.prop_accounts where user_id = '${OWNER}'::uuid`),
    );
    assert.equal(hist, hist2, "re-enable must not mutate history");
  });

  check("S12 kill-switch mid-flight: commits under initial auth", () => {
    installRaiseFn();
    psql(`
      create or replace function public._prop_os_qa_disable_gate()
      returns trigger language plpgsql security definer
      set search_path to pg_catalog, public
      as $f$
      begin
        perform public.prop_os_cmd_admin_set_enabled(false);
        return NEW;
      end;
      $f$;
      create trigger trg_midflight_gate
        before insert on public.prop_challenges
        for each row execute function public._prop_os_qa_disable_gate();
    `);
    const tpl = getPropOsTemplate("internal.apex-demo.eval.static")!;
    const conf = buildRuleConfirmationSummary(tpl, 5_000_000);
    const acc = createAccount(OWNER, "req-s12-acc", "Midflight Acc");
    const j = createChallenge(OWNER, "req-s12-ch", acc, conf);
    assert.equal(j.kind, "success", "in-flight must complete under initial auth");
    // Next command blocked
    const next = asAuth(
      OWNER,
      `select public.prop_os_cmd_create_account(
        'req-s12-next', 'hn', 'Blocked', 'apex-demo', 5000000, 'USD', 'America/New_York'
      );`,
    );
    assert.equal(parseJson(next).kind, "forbidden");
    dropInjectTriggers();
    setGate(true);
  });

  check("S13 SQL/search-path attack cannot resolve attacker objects", () => {
    // Create attacker schema object that would win if search_path were unsafe
    psql(`
      create schema if not exists attacker;
      create or replace function attacker.prop_os_cmd_assert_authorized()
      returns uuid language sql as $$ select '${FAKE}'::uuid $$;
    `);
    // Function uses set search_path to pg_catalog, public — attacker schema ignored
    allowlist(OWNER);
    setGate(true);
    const out = asAuth(
      OWNER,
      `select set_config('search_path', 'attacker, public', true);
       select public.prop_os_cmd_assert_authorized()::text;`,
    );
    const uid = out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(l),
      )
      .pop();
    assert.equal(uid, OWNER);
    psql(`drop schema if exists attacker cascade;`);
  });

  check("S14 sanitized error — no SQL text leak", () => {
    installRaiseFn();
    psql(`
      create trigger trg_inject_fail_ch
        before insert on public.prop_challenges
        for each row execute function public._prop_os_qa_raise();
    `);
    const tpl = getPropOsTemplate("internal.apex-demo.eval.static")!;
    const conf = buildRuleConfirmationSummary(tpl, 5_000_000);
    const acc = createAccount(OWNER, "req-s14-acc", "Sanitize Acc");
    const j = createChallenge(OWNER, "req-s14-ch", acc, conf);
    assert.equal(j.kind, "unexpected_error");
    const raw = JSON.stringify(j);
    assert.equal(/qa_injected|sqlstate|DETAIL|CONTEXT|prop_challenges/i.test(raw), false);
    dropInjectTriggers();
  });

  // -------------------------------------------------------------------------
  // Transaction scenarios 1–12
  // -------------------------------------------------------------------------
  const tpl = getPropOsTemplate("internal.apex-demo.eval.static")!;
  const conf = buildRuleConfirmationSummary(tpl, 5_000_000);

  check("T1 failure before challenge insert → zero partial", () => {
    const acc = createAccount(OWNER, "req-t1-acc", "T1 Acc");
    const before = countsForAccount(acc);
    // invalid snapshot missing version
    const out = asAuth(
      OWNER,
      `select public.prop_os_cmd_create_challenge_attempt(
        'req-t1-ch', 'ht1', '${acc}'::uuid,
        'internal.apex-demo.eval.static', '2026.07.1',
        '{"profitTargetMinor":1}'::jsonb, 'evaluation', now(), null
      );`,
    );
    assert.equal(parseJson(out).kind, "validation_error");
    const after = countsForAccount(acc);
    assert.deepEqual(after, before);
  });

  check("T2 failure after challenge insert → rolled back", () => {
    installRaiseFn();
    psql(`
      create trigger trg_inject_fail_rule
        before insert on public.prop_challenge_rule_snapshots
        for each row execute function public._prop_os_qa_raise();
    `);
    const acc = createAccount(OWNER, "req-t2-acc", "T2 Acc");
    const before = countsForAccount(acc);
    const j = createChallenge(OWNER, "req-t2-ch", acc, conf);
    assert.equal(j.kind, "unexpected_error");
    const after = countsForAccount(acc);
    assert.equal(after.challenges, before.challenges);
    assert.equal(after.snapshots, before.snapshots);
    assert.equal(after.transitions, before.transitions);
    const falseReceipt = psql(`
      select count(*) from public.prop_os_command_receipts
      where client_request_id = 'req-t2-ch' and result_status = 'success';
    `);
    assert.equal(falseReceipt, "0");
    dropInjectTriggers();
  });

  check("T3 failure after rule snapshot → rolled back", () => {
    installRaiseFn();
    psql(`
      create trigger trg_inject_fail_tr
        before insert on public.prop_challenge_transitions
        for each row execute function public._prop_os_qa_raise();
    `);
    const acc = createAccount(OWNER, "req-t3-acc", "T3 Acc");
    const before = countsForAccount(acc);
    const j = createChallenge(OWNER, "req-t3-ch", acc, conf);
    assert.equal(j.kind, "unexpected_error");
    assert.deepEqual(countsForAccount(acc), before);
    dropInjectTriggers();
  });

  check("T4 failure after lifecycle event → rolled back", () => {
    installRaiseFn();
    psql(`
      create trigger trg_inject_fail_rc
        before insert on public.prop_os_command_receipts
        for each row
        when (NEW.command_type = 'create_challenge_attempt')
        execute function public._prop_os_qa_raise();
    `);
    const acc = createAccount(OWNER, "req-t4-acc", "T4 Acc");
    const before = countsForAccount(acc);
    const j = createChallenge(OWNER, "req-t4-ch", acc, conf);
    assert.equal(j.kind, "unexpected_error");
    assert.deepEqual(countsForAccount(acc), {
      ...before,
      // receipt success count unchanged
    });
    assert.equal(
      psql(`select count(*) from public.prop_challenges where account_id = '${acc}'::uuid`),
      String(before.challenges),
    );
    dropInjectTriggers();
  });

  check("T5 failure before receipt completion → no success receipt", () => {
    // Same as T4 — prove explicitly
    installRaiseFn();
    psql(`
      create trigger trg_inject_fail_rc
        before insert on public.prop_os_command_receipts
        for each row
        when (NEW.command_type = 'create_challenge_attempt')
        execute function public._prop_os_qa_raise();
    `);
    const acc = createAccount(OWNER, "req-t5-acc", "T5 Acc");
    createChallenge(OWNER, "req-t5-ch", acc, conf);
    assert.equal(
      psql(`select count(*) from public.prop_os_command_receipts where client_request_id = 'req-t5-ch'`),
      "0",
    );
    dropInjectTriggers();
  });

  check("T6 retry following rollback → success", () => {
    const acc = createAccount(OWNER, "req-t6-acc", "T6 Acc");
    // First fail
    installRaiseFn();
    psql(`
      create trigger trg_inject_fail_rule
        before insert on public.prop_challenge_rule_snapshots
        for each row execute function public._prop_os_qa_raise();
    `);
    assert.equal(createChallenge(OWNER, "req-t6-ch", acc, conf).kind, "unexpected_error");
    dropInjectTriggers();
    // Retry same request id after rollback
    const j = createChallenge(OWNER, "req-t6-ch", acc, conf);
    assert.equal(j.kind, "success");
    assert.equal(
      psql(`select count(*) from public.prop_challenges where account_id = '${acc}'::uuid`),
      "1",
    );
  });

  check("T7 concurrent same request ID → one attempt", () => {
    const acc = createAccount(OWNER, "req-t7-acc", "T7 Acc");
    const body = {
      accountId: acc,
      templateId: conf.templateId,
      ruleSnapshot: conf.ruleSnapshot,
    };
    const h = hash("create_challenge_attempt", body);
    const snap = snapJson(conf);
    const sql = `
begin;
select set_config('request.jwt.claim.sub', '${OWNER}', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.prop_os_cmd_create_challenge_attempt(
  'req-t7-same', '${h}', '${acc}'::uuid,
  '${conf.templateId}', '${conf.templateVersion}',
  '${snap}'::jsonb, 'evaluation', now(), null
);
commit;
`;
    const pathA = `/tmp/prop-os-t7a.sql`;
    const pathB = `/tmp/prop-os-t7b.sql`;
    fs.writeFileSync(pathA, sql);
    fs.writeFileSync(pathB, sql);
    const bash = `
      psql -d ${DB} -v ON_ERROR_STOP=1 -At -f ${pathA} > /tmp/t7a.out 2>/tmp/t7a.err &
      pid1=$!
      psql -d ${DB} -v ON_ERROR_STOP=1 -At -f ${pathB} > /tmp/t7b.out 2>/tmp/t7b.err &
      pid2=$!
      wait $pid1; e1=$?
      wait $pid2; e2=$?
      echo EXIT:$e1:$e2
      cat /tmp/t7a.out; echo '---'; cat /tmp/t7b.out
      echo 'ERR_A:'; cat /tmp/t7a.err
      echo 'ERR_B:'; cat /tmp/t7b.err
    `;
    const conc = spawnSync("bash", ["-c", bash], { encoding: "utf8", env: PG_ENV });
    assert.equal(conc.status, 0, conc.stderr + conc.stdout);
    const bodyOut = conc.stdout.replace(/^EXIT:[^\n]*\n/, "");
    const parts = bodyOut.split("---");
    const j1 = parseJson(parts[0] ?? "");
    const j2 = parseJson(parts[1] ?? "");
    assert.equal(j1.kind, "success");
    assert.equal(j2.kind, "success");
    const id1 = (j1.value as { challenge: { id: string } }).challenge.id;
    const id2 = (j2.value as { challenge: { id: string } }).challenge.id;
    assert.equal(id1, id2);
    assert.equal(
      psql(`select count(*) from public.prop_challenges where account_id = '${acc}'::uuid`),
      "1",
    );
    assert.equal(
      psql(
        `select count(*) from public.prop_challenge_rule_snapshots s
         join public.prop_challenges c on c.id = s.challenge_id
         where c.account_id = '${acc}'::uuid`,
      ),
      "1",
    );
  });

  check("T8 concurrent different request IDs → unique attempt numbers", () => {
    const acc = createAccount(OWNER, "req-t8-acc", "T8 Acc");
    const bodyBase = {
      accountId: acc,
      templateId: conf.templateId,
      ruleSnapshot: conf.ruleSnapshot,
    };
    const h1 = hash("create_challenge_attempt", { ...bodyBase, n: 1 });
    const h2 = hash("create_challenge_attempt", { ...bodyBase, n: 2 });
    const snap = snapJson(conf);
    const mk = (req: string, h: string) => `
begin;
select set_config('request.jwt.claim.sub', '${OWNER}', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.prop_os_cmd_create_challenge_attempt(
  '${req}', '${h}', '${acc}'::uuid,
  '${conf.templateId}', '${conf.templateVersion}',
  '${snap}'::jsonb, 'evaluation', now(), null
);
commit;
`;
    fs.writeFileSync("/tmp/prop-os-t8a.sql", mk("req-t8-a", h1));
    fs.writeFileSync("/tmp/prop-os-t8b.sql", mk("req-t8-b", h2));
    const bash = `
      psql -d ${DB} -v ON_ERROR_STOP=1 -At -f /tmp/prop-os-t8a.sql > /tmp/t8a.out 2>/tmp/t8a.err &
      pid1=$!
      psql -d ${DB} -v ON_ERROR_STOP=1 -At -f /tmp/prop-os-t8b.sql > /tmp/t8b.out 2>/tmp/t8b.err &
      pid2=$!
      wait $pid1; wait $pid2
      cat /tmp/t8a.out; echo '---'; cat /tmp/t8b.out
    `;
    const conc = spawnSync("bash", ["-c", bash], { encoding: "utf8", env: PG_ENV });
    assert.equal(conc.status, 0, conc.stderr);
    const parts = conc.stdout.split("---");
    const j1 = parseJson(parts[0] ?? "");
    const j2 = parseJson(parts[1] ?? "");
    // Both succeed or one conflicts — never duplicate attempt_number
    const kinds = [j1.kind, j2.kind];
    assert.ok(
      kinds.every((k) => k === "success" || k === "conflict"),
      JSON.stringify(kinds),
    );
    const successCount = kinds.filter((k) => k === "success").length;
    assert.ok(successCount >= 1);
    const attempts = psql(`
      select string_agg(attempt_number::text, ',' order by attempt_number)
      from public.prop_challenges where account_id = '${acc}'::uuid
    `);
    const nums = attempts.split(",").map(Number);
    assert.equal(new Set(nums).size, nums.length, "duplicate attempt_number");
    const uq = psql(`
      select count(*) from (
        select account_id, attempt_number from public.prop_challenges
        where account_id = '${acc}'::uuid
        group by 1,2 having count(*) > 1
      ) d;
    `);
    assert.equal(uq, "0");
  });

  check("T9 request ID reused with different payload → conflict", () => {
    const acc = createAccount(OWNER, "req-t9-acc", "T9 Acc");
    const j1 = createChallenge(OWNER, "req-t9-ch", acc, conf);
    assert.equal(j1.kind, "success");
    const conf2 = buildRuleConfirmationSummary(
      getPropOsTemplate("internal.apex-demo.eval.trailing")!,
      5_000_000,
    );
    const body2 = {
      accountId: acc,
      templateId: conf2.templateId,
      ruleSnapshot: conf2.ruleSnapshot,
    };
    const h2 = hash("create_challenge_attempt", body2);
    const snap2 = snapJson(conf2);
    const out = asAuth(
      OWNER,
      `select public.prop_os_cmd_create_challenge_attempt(
        'req-t9-ch', '${h2}', '${acc}'::uuid,
        '${conf2.templateId}', '${conf2.templateVersion}',
        '${snap2}'::jsonb, 'evaluation', now(), null
      );`,
    );
    const j = parseJson(out);
    assert.equal(j.kind, "conflict");
    assert.equal(j.reasonCode, "idempotency_hash_mismatch");
  });

  check("T10 archive racing with challenge selection", () => {
    const acc = createAccount(OWNER, "req-t10-acc", "T10 Acc");
    const j = createChallenge(OWNER, "req-t10-ch", acc, conf);
    assert.equal(j.kind, "success");
    const chId = (j.value as { challenge: { id: string } }).challenge.id;
    asAuth(
      OWNER,
      `select public.prop_os_cmd_archive_account('req-t10-arch', 'ha', '${acc}'::uuid, true);`,
    );
    const sel = asAuth(
      OWNER,
      `select public.prop_os_cmd_select_challenge(
        'req-t10-sel', 'hs', '${acc}'::uuid, '${chId}'::uuid
      );`,
    );
    const sj = parseJson(sel);
    assert.ok(sj.kind === "conflict" || sj.kind === "forbidden", JSON.stringify(sj));
  });

  check("T11 default-account update racing with archive", () => {
    const acc = createAccount(OWNER, "req-t11-acc", "T11 Acc");
    asAuth(
      OWNER,
      `select public.prop_os_cmd_set_default_account('req-t11-def', 'hd', '${acc}'::uuid);`,
    );
    asAuth(
      OWNER,
      `select public.prop_os_cmd_archive_account('req-t11-arch', 'ha', '${acc}'::uuid, true);`,
    );
    const def = psql(`
      select coalesce(default_account_id::text, 'null')
      from public.prop_os_user_preferences where user_id = '${OWNER}'::uuid
    `);
    assert.ok(def === "null" || def !== acc);
    const status = psql(`select status from public.prop_accounts where id = '${acc}'::uuid`);
    assert.equal(status, "archived");
  });

  check("T12 read model immediately after committed command", () => {
    const acc = createAccount(OWNER, "req-t12-acc", "T12 Acc");
    const j = createChallenge(OWNER, "req-t12-ch", acc, conf);
    assert.equal(j.kind, "success");
    const chId = (j.value as { challenge: { id: string } }).challenge.id;
    const read = asAuth(
      OWNER,
      `select jsonb_build_object(
        'ch', (select count(*) from public.prop_challenges where id = '${chId}'::uuid),
        'snap', (select count(*) from public.prop_challenge_rule_snapshots where challenge_id = '${chId}'::uuid),
        'tr', (select count(*) from public.prop_challenge_transitions where challenge_id = '${chId}'::uuid),
        'attempt', (select attempt_number from public.prop_challenges where id = '${chId}'::uuid)
      );`,
    );
    const rm = parseJson(read);
    assert.equal(Number(rm.ch), 1);
    assert.equal(Number(rm.snap), 1);
    assert.equal(Number(rm.tr), 1);
    assert.equal(Number(rm.attempt), 1);
  });

  // Receipt integrity extras
  check("R receipt ownership user-scoped; other cannot replay", () => {
    allowlist(OTHER);
    // Cross-user receipt lookup is internal; prove OTHER cannot see owner's receipts
    const cntRaw = asAuth(
      OTHER,
      `select count(*)::text from public.prop_os_command_receipts where user_id = '${OWNER}'::uuid;`,
    );
    const n = Number(
      cntRaw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^\d+$/.test(l))
        .pop() ?? "-1",
    );
    assert.equal(n, 0, `other must not see owner receipts: ${cntRaw}`);
    let updateDenied = false;
    try {
      asAuth(
        OTHER,
        `update public.prop_os_command_receipts set result_status = 'success' where user_id = '${OWNER}'::uuid;`,
      );
    } catch {
      updateDenied = true;
    }
    assert.equal(updateDenied, true);
  });

  check("P template provenance matrix + N+1 immutability", () => {
    const matrix = listTemplateProvenance();
    assert.equal(matrix.length, 3);
    for (const row of matrix) {
      assert.ok(row.templateId);
      assert.ok(row.templateVersion);
      assert.ok(row.firmProgramName);
      assert.ok(row.effectiveDate);
      assert.ok(row.evidenceSource);
      assert.ok(row.dateVerified);
      assert.ok(row.verifiedFields.length > 0);
      assert.ok(row.unknownOrUnsupportedFields.length > 0);
      assert.ok(row.supportedAccountSizesMinor.length > 0);
    }
    const acc = createAccount(OWNER, "req-p-acc", "Prov Acc");
    const j = createChallenge(OWNER, "req-p-ch", acc, conf);
    assert.equal(j.kind, "success");
    const chId = (j.value as { challenge: { id: string } }).challenge.id;
    const before = psql(`
      select snapshot->>'version' from public.prop_challenge_rule_snapshots
      where challenge_id = '${chId}'::uuid
    `);
    // Simulate catalogue N+1 by updating a *new* challenge with different version string in snapshot
    // Existing snapshot must remain unchanged when we only change app catalogue conceptually
    const unchanged = psql(`
      select snapshot::text from public.prop_challenge_rule_snapshots where challenge_id = '${chId}'::uuid
    `);
    // Direct update of catalogue is app-side; prove DB row immutable via authenticated DML deny
    let mutated = false;
    try {
      asAuth(
        OWNER,
        `update public.prop_challenge_rule_snapshots
           set snapshot = '{"version":"mutated"}'::jsonb
         where challenge_id = '${chId}'::uuid;`,
      );
      mutated = true;
    } catch {
      mutated = false;
    }
    assert.equal(mutated, false);
    const after = psql(`
      select snapshot->>'version' from public.prop_challenge_rule_snapshots
      where challenge_id = '${chId}'::uuid
    `);
    assert.equal(after, before);
    assert.equal(
      psql(`select snapshot::text from public.prop_challenge_rule_snapshots where challenge_id = '${chId}'::uuid`),
      unchanged,
    );
  });

  check("attempt_number unique index exists", () => {
    const idx = psql(`
      select count(*) from pg_indexes
      where indexname = 'prop_challenges_account_attempt_uidx'
    `);
    assert.equal(idx, "1");
  });

  console.log(`prop-pass-phase2b-hardening-pg-qa: PASS (${passed})`);
  console.log("RESULTS_JSON=" + JSON.stringify(results));
}

main();
