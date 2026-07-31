/**
 * Phase 2A remediation — live authenticated vertical slice + RLS + provenance.
 * Isolated local Postgres only. Does NOT touch production.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  createPropOsAppGateway,
} from "../src/propOs/activation/index";
import {
  createAccountManagementService,
  createAuthenticatedPropOsReadStore,
} from "../src/propOs/accounts/index";
import {
  mapActivationToPropPassUiState,
  mapActivatedReadModelToViewModel,
  tryCreatePropPassAccountsFactory,
} from "../src/propPass/index";
import { createPsqlAuthenticatedPropOsReadTransport } from "./prop-os-authenticated-psql-transport";
import { ensureAuthUser } from "./prop-os-accounts-pg-store";
import type { PropPassUiState } from "../src/propPass/types";

const DB = process.env.PROP_OS_LIVE_SLICE_DB ?? "prop_os_live2a";
const OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ACC = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const ACC_INC = "cccccccc-cccc-cccc-cccc-cccccccccc01";
const ACC_INT = "cccccccc-cccc-cccc-cccc-cccccccccc02";
const CH_ACTIVE = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const CH_HIST = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const CH_INC = "dddddddd-dddd-dddd-dddd-dddddddddd01";
const CH_INT = "dddddddd-dddd-dddd-dddd-dddddddddd02";
const RULE = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const RULE_INC = "ffffffff-ffff-ffff-ffff-ffffffffff01";
const RULE_INT = "ffffffff-ffff-ffff-ffff-ffffffffff02";
const ENG = "99999999-9999-9999-9999-999999999991";
const ENG_INC = "99999999-9999-9999-9999-999999999993";
const ENG_INT = "99999999-9999-9999-9999-999999999994";
const SCORE = "99999999-9999-9999-9999-999999999992";
const NOW = "2026-01-10T12:00:00.000Z";
const ROOT = path.resolve(import.meta.dirname, "..");
const CAPTURE_DIR = path.join(ROOT, ".tmp/prop-pass-live-captures");

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log(`  OK  ${name}`);
    });
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

function seedLiveSlice(): void {
  ensureAuthUser(DB, OWNER, "owner-live2a@example.com");
  ensureAuthUser(DB, OTHER, "other-live2a@example.com");

  // Fresh isolated DB only (shell dropdb/createdb). Never DELETE immutable
  // engine/score/rule snapshots — immutability triggers must stay enforced.
  const existing = psql(`
    select count(*)::text from public.prop_engine_snapshots
    where id in ('${ENG}'::uuid, '${ENG_INC}'::uuid, '${ENG_INT}'::uuid)
  `);
  assert.equal(
    existing,
    "0",
    "Phase 2A live slice requires a fresh isolated database (re-run via prop-pass-live-vertical-slice-qa.sh)",
  );

  psql(`
    set role service_role;

    insert into public.prop_accounts (
      id, user_id, firm_key, label, account_size_minor, currency, firm_timezone,
      status, source, schema_version, created_at, archived_at, updated_at
    ) values (
      '${ACC}'::uuid, '${OWNER}'::uuid, 'apex-demo', 'Live Eval 50k', 5000000, 'USD',
      'America/New_York', 'active', 'user_created', 'prop-os-schema-v0',
      '${NOW}'::timestamptz, null, '${NOW}'::timestamptz
    );

    insert into public.prop_challenges (
      id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor,
      started_at, ended_at, reset_of_challenge_id, breach_locked, schema_version, created_at, updated_at
    ) values
    (
      '${CH_HIST}'::uuid, '${OWNER}'::uuid, '${ACC}'::uuid, 'evaluation', 'breached',
      'rs-live-hist', 5000000, '2025-12-01T12:00:00.000Z'::timestamptz,
      '2025-12-15T12:00:00.000Z'::timestamptz, null, true, 'prop-os-schema-v0',
      '2025-12-01T12:00:00.000Z'::timestamptz, '2025-12-15T12:00:00.000Z'::timestamptz
    ),
    (
      '${CH_ACTIVE}'::uuid, '${OWNER}'::uuid, '${ACC}'::uuid, 'evaluation', 'active',
      'rs-live-v1', 5000000, '${NOW}'::timestamptz, null, '${CH_HIST}'::uuid, false,
      'prop-os-schema-v0', '${NOW}'::timestamptz, '${NOW}'::timestamptz
    );

    insert into public.prop_challenge_rule_snapshots (
      id, user_id, challenge_id, rule_set_version, snapshot, template_key,
      template_version_at_capture, captured_at, schema_version
    ) values (
      '${RULE}'::uuid, '${OWNER}'::uuid, '${CH_ACTIVE}'::uuid, 'rs-live-v1',
      '{"version":"rs-live-v1","firmKey":"apex-demo","currency":"USD","firmTimezone":"America/New_York","tradingDayRolloverHour":0,"profitTargetMinor":300000,"dailyLossLimitMinor":1000000,"dailyLossBasis":"realized_only","dailyLossPolicyVersion":"daily-loss-v0","drawdown":{"kind":"static","amountMinor":200000},"minimumTradingDays":1}'::jsonb,
      'apex-demo', 't1', '${NOW}'::timestamptz, 'prop-os-schema-v0'
    );

    insert into public.prop_trade_assignments (
      id, user_id, trade_client_id, account_id, challenge_id, assignment_state,
      assigned_at, assigned_by, provenance, schema_version, created_at, updated_at
    ) values (
      gen_random_uuid(), '${OWNER}'::uuid, 'trade-live-1', '${ACC}'::uuid, '${CH_ACTIVE}'::uuid,
      'manual', '${NOW}'::timestamptz, 'user',
      '{"actor":"user","source":"manual","reason":"seed","at":"${NOW}","previousState":null,"previousChallengeId":null,"previousAccountId":null,"previousAssignmentId":null,"dataQuality":"ok","confidence":"high"}'::jsonb,
      'prop-os-schema-v0', '${NOW}'::timestamptz, '${NOW}'::timestamptz
    );

    insert into public.prop_engine_snapshots (
      id, user_id, challenge_id, calculation_version, rule_set_version, input_revision,
      calculated_at, status, payload, confidence, limitations,
      readiness_model_version, confidence_policy_version, schema_version, created_at
    ) values (
      '${ENG}'::uuid, '${OWNER}'::uuid, '${CH_ACTIVE}'::uuid, 'calc-spec-v0', 'rs-live-v1', 'rev-live-1',
      '${NOW}'::timestamptz, 'active',
      '{"status":"active","accountState":{"equityMinor":5100000,"startingBalanceMinor":5000000,"hwmMinor":5100000,"drawdownFloorMinor":4800000,"tradingDayId":"2026-01-10","dayPnlMinor":100000,"equitySource":"trade_only"},"buffers":[{"id":"daily_loss","remainingMinor":900000,"limitMinor":1000000,"status":"ok","limitations":[]},{"id":"drawdown","remainingMinor":180000,"limitMinor":200000,"status":"ok","limitations":[]},{"id":"target_distance","remainingMinor":200000,"limitMinor":300000,"status":"ok","limitations":[]}],"readiness":{"score":74,"confidence":{"level":"medium"},"drivers":[],"supportingEvidence":[]},"limitations":["demo_seed"]}'::jsonb,
      '{"level":"medium"}'::jsonb, '["demo_seed"]'::jsonb,
      'readiness-v0', 'confidence-policy-v0', 'prop-os-schema-v0', '${NOW}'::timestamptz
    );

    insert into public.prop_score_snapshots (
      id, user_id, challenge_id, calculation_version, rule_set_version, input_revision,
      calculated_at, status, payload, confidence, limitations,
      readiness_model_version, confidence_policy_version, schema_version, created_at
    ) values (
      '${SCORE}'::uuid, '${OWNER}'::uuid, '${CH_ACTIVE}'::uuid, 'calc-spec-v0', 'rs-live-v1', 'rev-live-1',
      '${NOW}'::timestamptz, 'active',
      '{"readiness":{"score":74},"publicScoreWithheld":false}'::jsonb,
      '{"level":"medium"}'::jsonb, '["demo_seed"]'::jsonb,
      'readiness-v0', 'confidence-policy-v0', 'prop-os-schema-v0', '${NOW}'::timestamptz
    );

    insert into public.prop_accounts (
      id, user_id, firm_key, label, account_size_minor, currency, firm_timezone,
      status, source, schema_version, created_at, archived_at, updated_at
    ) values
    (
      '${ACC_INC}'::uuid, '${OWNER}'::uuid, 'apex-demo', 'Incomplete Seed', 5000000, 'USD',
      'America/New_York', 'active', 'user_created', 'prop-os-schema-v0',
      '${NOW}'::timestamptz, null, '${NOW}'::timestamptz
    ),
    (
      '${ACC_INT}'::uuid, '${OWNER}'::uuid, 'apex-demo', 'Integrity Seed', 5000000, 'USD',
      'America/New_York', 'active', 'user_created', 'prop-os-schema-v0',
      '${NOW}'::timestamptz, null, '${NOW}'::timestamptz
    );

    insert into public.prop_challenges (
      id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor,
      started_at, ended_at, reset_of_challenge_id, breach_locked, schema_version, created_at, updated_at
    ) values
    (
      '${CH_INC}'::uuid, '${OWNER}'::uuid, '${ACC_INC}'::uuid, 'evaluation', 'active',
      'rs-live-inc', 5000000, '${NOW}'::timestamptz, null, null, false,
      'prop-os-schema-v0', '${NOW}'::timestamptz, '${NOW}'::timestamptz
    ),
    (
      '${CH_INT}'::uuid, '${OWNER}'::uuid, '${ACC_INT}'::uuid, 'evaluation', 'active',
      'rs-live-int', 5000000, '${NOW}'::timestamptz, null, null, false,
      'prop-os-schema-v0', '${NOW}'::timestamptz, '${NOW}'::timestamptz
    );

    insert into public.prop_challenge_rule_snapshots (
      id, user_id, challenge_id, rule_set_version, snapshot, template_key,
      template_version_at_capture, captured_at, schema_version
    ) values
    (
      '${RULE_INC}'::uuid, '${OWNER}'::uuid, '${CH_INC}'::uuid, 'rs-live-inc',
      '{"firmKey":"apex-demo"}'::jsonb,
      'apex-demo', 't1', '${NOW}'::timestamptz, 'prop-os-schema-v0'
    ),
    (
      '${RULE_INT}'::uuid, '${OWNER}'::uuid, '${CH_INT}'::uuid, 'rs-live-int',
      '{"version":"rs-live-int","firmKey":"apex-demo","currency":"USD","firmTimezone":"America/New_York","tradingDayRolloverHour":0,"profitTargetMinor":300000,"dailyLossLimitMinor":1000000,"dailyLossBasis":"realized_only","dailyLossPolicyVersion":"daily-loss-v0","drawdown":{"kind":"static","amountMinor":200000},"minimumTradingDays":1}'::jsonb,
      'apex-demo', 't1', '${NOW}'::timestamptz, 'prop-os-schema-v0'
    );

    insert into public.prop_engine_snapshots (
      id, user_id, challenge_id, calculation_version, rule_set_version, input_revision,
      calculated_at, status, payload, confidence, limitations,
      readiness_model_version, confidence_policy_version, schema_version, created_at
    ) values
    (
      '${ENG_INC}'::uuid, '${OWNER}'::uuid, '${CH_INC}'::uuid, 'calc-spec-v0', 'rs-live-inc', 'rev-live-1',
      '${NOW}'::timestamptz, 'active',
      '{"status":"active","accountState":{"equityMinor":5100000,"startingBalanceMinor":5000000,"hwmMinor":5100000,"drawdownFloorMinor":4800000,"tradingDayId":"2026-01-10","dayPnlMinor":100000,"equitySource":"trade_only"},"buffers":[],"readiness":{"score":10,"confidence":{"level":"low"},"drivers":[],"supportingEvidence":[]},"limitations":[]}'::jsonb,
      '{"level":"low"}'::jsonb, '[]'::jsonb,
      'readiness-v0', 'confidence-policy-v0', 'prop-os-schema-v0', '${NOW}'::timestamptz
    ),
    (
      '${ENG_INT}'::uuid, '${OWNER}'::uuid, '${CH_INT}'::uuid, 'calc-spec-v0', 'rs-live-int', 'rev-live-1',
      '${NOW}'::timestamptz, 'active',
      '{"status":"active","accountState":{"equityMinor":5100000,"startingBalanceMinor":5000000,"hwmMinor":5100000,"drawdownFloorMinor":4800000,"tradingDayId":"2026-01-10","dayPnlMinor":100000,"equitySource":"trade_only"},"buffers":[],"readiness":{"score":10,"confidence":{"level":"low"},"drivers":[],"supportingEvidence":[]},"limitations":[]}'::jsonb,
      '{"level":"low"}'::jsonb, '[]'::jsonb,
      'readiness-v0', 'confidence-policy-v0', 'prop-os-schema-INVALID', '${NOW}'::timestamptz
    );

    insert into public.prop_os_user_preferences (user_id, default_account_id, updated_at, schema_version)
    values ('${OWNER}'::uuid, '${ACC}'::uuid, '${NOW}'::timestamptz, 'prop-os-schema-v0');
    reset role;
  `);
}

function capture(name: string, state: PropPassUiState, extra?: Record<string, unknown>) {
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  const file = path.join(CAPTURE_DIR, `${name}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ capturedAt: new Date().toISOString(), kind: state.kind, state, ...extra }, null, 2),
  );
  console.log(`  CAPTURE  ${file}`);
}

function makeGateway(userId: string, envExtra: Record<string, string> = {}) {
  const env = {
    EXPO_PUBLIC_APP_ENV: "staging",
    EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE: "staging_preview",
    EXPO_PUBLIC_PROP_OS_ALLOWLIST: OWNER,
    EXPO_PUBLIC_PROP_OS_KILL_SWITCH: "false",
    ...envExtra,
  };
  const transport = createPsqlAuthenticatedPropOsReadTransport({ db: DB, userId });
  const factory = tryCreatePropPassAccountsFactory({ env, transport });
  assert.ok(factory, "accounts factory must be available in staging_preview");
  return createPropOsAppGateway({
    env,
    config: undefined,
    accountsFactory: factory,
    getSchemaVersion: async () => "prop-os-schema-v0",
  });
}

async function main() {
  console.log("prop-pass-live-vertical-slice-qa");
  assert.equal(
    psql(`select to_regclass('public.prop_os_user_preferences')`),
    "prop_os_user_preferences",
  );
  seedLiveSlice();

  await check("vertical slice → available via authenticated factory", async () => {
    const gw = makeGateway(OWNER);
    const res = await gw.getActivatedReadModel({
      userId: OWNER,
      accountId: ACC,
      currentInputRevision: "rev-live-1",
      nowUtc: NOW,
    });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.gate, "available");
    const ui = mapActivationToPropPassUiState({
      entryAllowed: true,
      loading: false,
      result: res,
    });
    assert.equal(ui.kind, "available");
    if (ui.kind !== "available") throw new Error("expected available");
    const vm = ui.model;
    assert.equal(vm.account.displayName, "Live Eval 50k");
    assert.equal(vm.account.firmName, "apex-demo");
    assert.equal(vm.challenge.id, CH_ACTIVE);
    assert.equal(vm.challenge.status, "active");
    assert.equal(vm.progress.currentBalance?.minor, 5_100_000);
    assert.equal(vm.progress.profitTarget?.minor, 300_000);
    assert.equal(vm.progress.profitRemaining?.minor, 200_000);
    assert.equal(vm.buffers.dailyLoss?.remainingMinor, 900_000);
    assert.equal(vm.buffers.trailingDrawdown?.remainingMinor, 180_000);
    assert.equal(vm.buffers.totalLoss?.remainingMinor, 180_000);
    assert.equal(vm.readiness.score, 74);
    assert.equal(vm.readiness.confidence, "medium");
    assert.ok(vm.dataQuality.limitations.includes("demo_seed") || vm.readiness.reasonCodes.includes("demo_seed"));
    assert.equal(vm.freshness.status, "current");
    assert.equal(vm.freshness.calculatedAt, NOW);

    const provenance = {
      accountName: { value: vm.account.displayName, source: "prop_accounts.label" },
      firm: { value: vm.account.firmName, source: "prop_accounts.firm_key" },
      challengeStatus: { value: vm.challenge.status, source: "prop_challenges.status" },
      attempt: {
        value: vm.challenge.attemptNumber,
        source: "historicalAttempts.length + 1 (metadata only)",
      },
      currentBalance: {
        value: vm.progress.currentBalance?.minor,
        source: "prop_engine_snapshots.payload.accountState.equityMinor",
      },
      profitTarget: {
        value: vm.progress.profitTarget?.minor,
        source: "prop_challenge_rule_snapshots.snapshot.profitTargetMinor",
      },
      profitRemaining: {
        value: vm.progress.profitRemaining?.minor,
        source: "prop_engine_snapshots.payload.buffers[target_distance].remainingMinor",
      },
      dailyLossBuffer: {
        value: vm.buffers.dailyLoss,
        source: "prop_engine_snapshots.payload.buffers[daily_loss]",
      },
      trailingDrawdownBuffer: {
        value: vm.buffers.trailingDrawdown,
        source: "prop_engine_snapshots.payload.buffers[drawdown]",
      },
      totalLossBuffer: {
        value: vm.buffers.totalLoss,
        source: "prop_engine_snapshots.payload.buffers[drawdown] (total_loss proxy)",
      },
      readinessScore: {
        value: vm.readiness.score,
        source: "prop_engine_snapshots.payload.readiness.score",
      },
      confidence: {
        value: vm.readiness.confidence,
        source: "prop_engine_snapshots.payload.readiness.confidence.level",
      },
      limitations: {
        value: vm.dataQuality.limitations,
        source: "prop_engine_snapshots.payload.limitations / limitations column",
      },
      calculatedAt: {
        value: vm.freshness.calculatedAt,
        source: "prop_engine_snapshots.calculated_at",
      },
      freshnessStatus: {
        value: vm.freshness.status,
        source: "activation freshness policy (revision+versions)",
      },
    };
    fs.mkdirSync(CAPTURE_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(CAPTURE_DIR, "field-provenance.json"),
      JSON.stringify(provenance, null, 2),
    );
    capture("available", ui, { provenance });
  });

  await check("RLS: owner reads own account; cross-user empty", async () => {
    const ownerTransport = createPsqlAuthenticatedPropOsReadTransport({
      db: DB,
      userId: OWNER,
    });
    const otherTransport = createPsqlAuthenticatedPropOsReadTransport({
      db: DB,
      userId: OTHER,
    });
    const own = await ownerTransport.selectRows("prop_accounts", { id: ACC });
    assert.equal(own.length, 1);
    const cross = await otherTransport.selectRows("prop_accounts", { id: ACC });
    assert.equal(cross.length, 0);
    const challenges = await ownerTransport.selectRows("prop_challenges", {
      account_id: ACC,
    });
    assert.ok(challenges.length >= 2);
    const snaps = await ownerTransport.selectRows("prop_engine_snapshots", {
      challenge_id: CH_ACTIVE,
    });
    assert.equal(snaps.length, 1);
  });

  await check("RLS: authenticated writes denied; preference not authorization", () => {
    let insertDenied = false;
    try {
      psql(`
        select set_config('request.jwt.claim.sub', '${OWNER}', true);
        set local role authenticated;
        insert into public.prop_engine_snapshots (
          id, user_id, challenge_id, calculation_version, rule_set_version, input_revision,
          calculated_at, status, payload, confidence, limitations,
          confidence_policy_version, schema_version, created_at
        ) values (
          gen_random_uuid(), '${OWNER}'::uuid, '${CH_ACTIVE}'::uuid,
          'calc-spec-v0', 'rs-live-v1', 'rev-x', now(), 'ok',
          '{}'::jsonb, '{}'::jsonb, '[]'::jsonb,
          'confidence-policy-v0', 'prop-os-schema-v0', now()
        );
      `);
    } catch {
      insertDenied = true;
    }
    assert.equal(insertDenied, true);

    let prefBypass = false;
    try {
      psql(`
        set role service_role;
        insert into public.prop_os_user_preferences (user_id, default_account_id)
        values ('${OTHER}'::uuid, '${ACC}'::uuid);
        reset role;
      `);
    } catch {
      prefBypass = true;
    }
    assert.equal(prefBypass, true);
  });

  await check("read-only store rejects mutations", async () => {
    const store = createAuthenticatedPropOsReadStore(
      createPsqlAuthenticatedPropOsReadTransport({ db: DB, userId: OWNER }),
    );
    await assert.rejects(() => store.insertAccount({} as never), /read-only/);
  });

  await check("App UI outcomes from live gateway", async () => {
    // no account user
    const emptyGw = makeGateway(OTHER, {
      EXPO_PUBLIC_PROP_OS_ALLOWLIST: `${OWNER},${OTHER}`,
    });
    const noAcc = await emptyGw.getActivatedReadModel({
      userId: OTHER,
      accountId: null,
      currentInputRevision: "rev-live-1",
      nowUtc: NOW,
    });
    const noAccUi = mapActivationToPropPassUiState({
      entryAllowed: true,
      loading: false,
      result: noAcc,
    });
    assert.equal(noAccUi.kind, "no_account");
    capture("no_account", noAccUi);

    // stale
    const gw = makeGateway(OWNER);
    const stale = await gw.getActivatedReadModel({
      userId: OWNER,
      accountId: ACC,
      currentInputRevision: "rev-OTHER",
      nowUtc: NOW,
    });
    const staleUi = mapActivationToPropPassUiState({
      entryAllowed: true,
      loading: false,
      result: stale,
    });
    assert.equal(staleUi.kind, "stale_snapshot");
    capture("stale_snapshot", staleUi);

    // off zero-call
    const offFactoryCalls = { n: 0 };
    const offGw = createPropOsAppGateway({
      env: { EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE: "off" },
      accountsFactory: () => {
        offFactoryCalls.n += 1;
        throw new Error("should_not_run");
      },
    });
    const offRes = await offGw.getActivatedReadModel({
      userId: OWNER,
      accountId: ACC,
    });
    assert.equal(offRes.gate, "activation_off");
    assert.equal(offFactoryCalls.n, 0);
    assert.equal(offGw.getPropOsCallCount(), 0);
    capture(
      "activation_off",
      mapActivationToPropPassUiState({
        entryAllowed: false,
        loading: false,
        result: offRes,
      }),
    );

    // cross-user selection never available
    const cross = await makeGateway(OTHER, {
      EXPO_PUBLIC_PROP_OS_ALLOWLIST: `${OWNER},${OTHER}`,
    }).getActivatedReadModel({
      userId: OTHER,
      accountId: ACC,
      selectedChallengeId: CH_ACTIVE,
      currentInputRevision: "rev-live-1",
      nowUtc: NOW,
    });
    assert.equal(cross.ok, false);
    assert.notEqual(
      mapActivationToPropPassUiState({
        entryAllowed: true,
        loading: false,
        result: cross,
      }).kind,
      "available",
    );
  });

  await check("multiple active → selection_required via authenticated path", async () => {
    psql(`
      set role service_role;
      insert into public.prop_challenges (
        id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor,
        started_at, ended_at, reset_of_challenge_id, breach_locked, schema_version, created_at, updated_at
      ) values (
        '12121212-1212-1212-1212-121212121212'::uuid, '${OWNER}'::uuid, '${ACC}'::uuid,
        'evaluation', 'active', 'rs-live-v2', 5000000, '2026-01-11T12:00:00.000Z'::timestamptz,
        null, null, false, 'prop-os-schema-v0', now(), now()
      );
      insert into public.prop_challenge_rule_snapshots (
        id, user_id, challenge_id, rule_set_version, snapshot, captured_at, schema_version
      ) values (
        gen_random_uuid(), '${OWNER}'::uuid, '12121212-1212-1212-1212-121212121212'::uuid,
        'rs-live-v2', '{"version":"rs-live-v2","firmKey":"apex-demo","currency":"USD","firmTimezone":"America/New_York","tradingDayRolloverHour":0,"profitTargetMinor":300000,"dailyLossLimitMinor":1000000,"dailyLossBasis":"realized_only","dailyLossPolicyVersion":"daily-loss-v0","drawdown":{"kind":"static","amountMinor":200000},"minimumTradingDays":1}'::jsonb,
        now(), 'prop-os-schema-v0'
      );
      reset role;
    `);
    const gw = makeGateway(OWNER);
    const res = await gw.getActivatedReadModel({
      userId: OWNER,
      accountId: ACC,
      currentInputRevision: "rev-live-1",
      nowUtc: NOW,
    });
    const ui = mapActivationToPropPassUiState({
      entryAllowed: true,
      loading: false,
      result: res,
    });
    assert.equal(ui.kind, "challenge_selection_required");
    capture("challenge_selection_required", ui);
  });

  await check("incomplete_data + integrity_error via authenticated path", async () => {
    const gw = makeGateway(OWNER);
    const incompleteRes = await gw.getActivatedReadModel({
      userId: OWNER,
      accountId: ACC_INC,
      currentInputRevision: "rev-live-1",
      nowUtc: NOW,
    });
    const incompleteUi = mapActivationToPropPassUiState({
      entryAllowed: true,
      loading: false,
      result: incompleteRes,
    });
    assert.equal(incompleteUi.kind, "incomplete_data");
    capture("incomplete_data", incompleteUi);

    const integrityRes = await gw.getActivatedReadModel({
      userId: OWNER,
      accountId: ACC_INT,
      currentInputRevision: "rev-live-1",
      nowUtc: NOW,
    });
    const integrityUi = mapActivationToPropPassUiState({
      entryAllowed: true,
      loading: false,
      result: integrityRes,
    });
    assert.equal(integrityUi.kind, "integrity_error");
    capture("integrity_error", integrityUi);
  });

  await check("repository_unavailable when transport throws", async () => {
    const env = {
      EXPO_PUBLIC_APP_ENV: "staging",
      EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE: "staging_preview",
      EXPO_PUBLIC_PROP_OS_ALLOWLIST: OWNER,
    };
    const factory = tryCreatePropPassAccountsFactory({
      env,
      transport: {
        selectRows: async () => {
          throw new Error("repository timeout exceeded");
        },
      },
    });
    assert.ok(factory);
    const gw = createPropOsAppGateway({
      env,
      accountsFactory: factory!,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await gw.getActivatedReadModel({
      userId: OWNER,
      accountId: ACC,
    });
    const ui = mapActivationToPropPassUiState({
      entryAllowed: true,
      loading: false,
      result: res,
    });
    assert.equal(ui.kind, "repository_unavailable");
    capture("repository_unavailable", ui);
  });

  await check("App split regression — shell preserved", () => {
    const app = fs.readFileSync(path.join(ROOT, "App.tsx"), "utf8");
    assert.ok(/export\s+\{\s*default\s*\}\s+from\s+['\"]\.\/src\/app\/YouTraderApp['\"]/.test(app));
    assert.equal(/from\s+['\"].*propOs/.test(app), false);
    const you = fs.readFileSync(path.join(ROOT, "src/app/YouTraderApp.tsx"), "utf8");
    assert.ok(/function SettingsScreen/.test(you));
    assert.ok(/TabButton|setTab|\"journal\"/.test(you));
    assert.ok(/Purchases\.|react-native-purchases/.test(you));
    assert.ok(/configureNotificationHandler|Notifications|SmartNotifications/.test(you));
    assert.ok(/initAppI18n|changeAppLanguage|useTranslation|\bt\(/.test(you));
    assert.ok(/from\s+['\"]\.\.\/propPass['\"]/.test(you) || /from\s+['\"]\.\.\/propPass\//.test(you));
    assert.equal(/from\s+['\"].*propOs/.test(you), false);
    assert.ok(/propPassEntryVisible|PropPassInternalScreen/.test(you));
  });

  await check("service-role absent from App + propPass + authenticated store", () => {
    for (const rel of [
      "App.tsx",
      "src/propPass",
      "src/propOs/accounts/authenticatedReadStore.ts",
      "src/propOs/accounts/authenticatedReadTransport.ts",
    ]) {
      const target = path.join(ROOT, rel);
      const files = fs.statSync(target).isDirectory()
        ? fs.readdirSync(target).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => path.join(target, f))
        : [target];
      for (const f of files) {
        const body = fs.readFileSync(f, "utf8");
        assert.equal(/SUPABASE_SERVICE_ROLE|service_role\s*=/.test(body), false, f);
      }
    }
  });

  console.log(`prop-pass-live-vertical-slice-qa: PASS (${passed})`);
  console.log(`captures=${CAPTURE_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
