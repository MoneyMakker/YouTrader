/**
 * Phase 1D — live PostgreSQL integration for account management (psql bridge).
 */
import assert from "node:assert/strict";
import {
  AccountMgmtError,
  createAccountManagementService,
} from "../src/propOs/accounts/index";
import type { PropRuleSetSnapshot } from "../src/propOs/types";
import { psql, sqlLiteral } from "./prop-os-psql-bridge";
import {
  createPsqlAccountStore,
  ensureAuthUser,
  ensureInternalPrefsTable,
  fixtureUuid,
} from "./prop-os-accounts-pg-store";

const DB = process.env.PROP_OS_ACCOUNTS_DB ?? "prop_os_accounts1d";
const NOW = "2026-02-01T15:00:00.000Z";
const USER = fixtureUuid("user-1d-pg");
const USER_B = fixtureUuid("user-1d-pg-b");

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log(`  OK  ${name}`);
    });
}

function rules(version: string): PropRuleSetSnapshot {
  return {
    version,
    firmKey: "fixture-firm",
    currency: "USD",
    firmTimezone: "America/New_York",
    tradingDayRolloverHour: 0,
    profitTargetMinor: 300_000,
    dailyLossLimitMinor: 1_000_000,
    dailyLossBasis: "realized_only",
    dailyLossPolicyVersion: "daily-loss-v0",
    drawdown: { kind: "static", amountMinor: 200_000 },
    minimumTradingDays: 0,
  };
}

async function main() {
  console.log("prop-os-accounts-pg-qa");
  console.log(`  db=${DB}`);

  ensureInternalPrefsTable(DB);
  ensureAuthUser(DB, USER, "accounts1d@shadow.local");
  ensureAuthUser(DB, USER_B, "accounts1d-b@shadow.local");

  const store = createPsqlAccountStore(DB);
  const svc = createAccountManagementService(store);

  await check("ownership isolation + account/challenge create", async () => {
    const account = await svc.createPropAccount({
      userId: USER,
      label: "PG Acc",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: fixtureUuid("acc-pg-1"),
      nowUtc: NOW,
      source: "import",
    });
    const { challenge, ruleSnapshot } = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: rules("rs-pg-1"),
      id: fixtureUuid("ch-pg-1"),
      ruleSnapshotId: fixtureUuid("rule-pg-1"),
      nowUtc: NOW,
    });
    assert.equal(challenge.userId, USER);
    assert.equal(ruleSnapshot.challengeId, challenge.id);

    await assert.rejects(
      () =>
        svc.createChallengeAttempt({
          userId: USER_B,
          accountId: account.id,
          ruleSnapshot: rules("rs-steal"),
          id: fixtureUuid("ch-steal"),
          nowUtc: NOW,
        }),
      (e: unknown) => e instanceof AccountMgmtError && e.failure === "ownership_mismatch",
    );
  });

  await check("assignment provenance + duplicate conflict on PG", async () => {
    const account = await svc.createPropAccount({
      userId: USER,
      label: "PG Asg",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: fixtureUuid("acc-pg-asg"),
      nowUtc: NOW,
      source: "import",
    });
    const c1 = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: rules("rs-pg-asg-1"),
      id: fixtureUuid("ch-pg-asg-1"),
      ruleSnapshotId: fixtureUuid("rule-pg-asg-1"),
      nowUtc: NOW,
    });
    const c2 = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: rules("rs-pg-asg-2"),
      id: fixtureUuid("ch-pg-asg-2"),
      ruleSnapshotId: fixtureUuid("rule-pg-asg-2"),
      nowUtc: NOW,
    });
    const asg = await svc.assignTrade({
      userId: USER,
      tradeClientId: "pg-trade-1",
      challengeId: c1.challenge.id,
      state: "assigned_manual",
      actor: "user",
      reason: "explicit",
      nowUtc: NOW,
    });
    assert.equal(asg.state, "assigned_manual");
    const dbState = psql(
      DB,
      `select assignment_state from public.prop_trade_assignments
       where user_id = ${sqlLiteral(USER)}::uuid and trade_client_id = 'pg-trade-1'`,
    );
    assert.equal(dbState, "manual");

    await assert.rejects(
      () =>
        svc.assignTrade({
          userId: USER,
          tradeClientId: "pg-trade-1",
          challengeId: c2.challenge.id,
          state: "assigned_manual",
          actor: "user",
          reason: "dup",
          nowUtc: NOW,
        }),
      (e: unknown) => e instanceof AccountMgmtError && e.failure === "duplicate_assignment",
    );
  });

  await check("lifecycle breach + new attempt; append-only rule snapshot", async () => {
    const account = await svc.createPropAccount({
      userId: USER,
      label: "PG Life",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: fixtureUuid("acc-pg-life"),
      nowUtc: NOW,
      source: "import",
    });
    const first = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: rules("rs-pg-life-1"),
      id: fixtureUuid("ch-pg-life-1"),
      ruleSnapshotId: fixtureUuid("rule-pg-life-1"),
      nowUtc: NOW,
    });
    await svc.transitionChallenge({
      userId: USER,
      challengeId: first.challenge.id,
      toStatus: "breached",
      reasonCode: "static_drawdown",
      actor: "engine",
      nowUtc: NOW,
    });
    const second = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: rules("rs-pg-life-2"),
      resetOfChallengeId: first.challenge.id,
      id: fixtureUuid("ch-pg-life-2"),
      ruleSnapshotId: fixtureUuid("rule-pg-life-2"),
      nowUtc: "2026-02-02T15:00:00.000Z",
    });
    assert.equal(second.challenge.resetOfChallengeId, first.challenge.id);

    let denied = false;
    try {
      psql(
        DB,
        `update public.prop_challenge_rule_snapshots
         set rule_set_version = 'hacked'
         where challenge_id = ${sqlLiteral(first.challenge.id)}::uuid`,
      );
    } catch {
      denied = true;
    }
    assert.ok(denied, "rule snapshot update must fail");
  });

  await check("default account + archive clears preference; auth DML denied", async () => {
    const account = await svc.createPropAccount({
      userId: USER,
      label: "PG Def",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: fixtureUuid("acc-pg-def"),
      nowUtc: NOW,
      source: "import",
    });
    await svc.setDefaultAccount(USER, account.id);
    assert.equal(await store.getDefaultAccountId(USER), account.id);
    await svc.archiveAccount(USER, account.id, NOW);
    assert.equal(await store.getDefaultAccountId(USER), null);

    let authDenied = false;
    try {
      psql(
        DB,
        `set role authenticated;
         insert into public.prop_accounts (
           id, user_id, label, account_size_minor, firm_timezone, status, source
         ) values (
           ${sqlLiteral(fixtureUuid("acc-auth-deny"))}::uuid,
           ${sqlLiteral(USER)}::uuid,
           'Nope', 100, 'UTC', 'active', 'import'
         );
         reset role;`,
      );
    } catch {
      authDenied = true;
    }
    assert.ok(authDenied);
  });

  await check("read model without shadow snapshot", async () => {
    const account = await svc.createPropAccount({
      userId: USER,
      label: "PG RM",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: fixtureUuid("acc-pg-rm"),
      nowUtc: NOW,
      source: "import",
    });
    await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: rules("rs-pg-rm"),
      id: fixtureUuid("ch-pg-rm"),
      ruleSnapshotId: fixtureUuid("rule-pg-rm"),
      nowUtc: NOW,
    });
    const rm = await svc.getAccountReadModel(USER, account.id);
    assert.ok(rm.account);
    assert.ok(rm.activeChallenge);
    assert.equal(rm.challengeSelectionState, "resolved");
    assert.ok(rm.ruleSnapshot);
    assert.equal(rm.latestShadowSnapshot, null);
    assert.ok(rm.dataQuality.flags.includes("no_shadow_snapshot"));
  });

  await check("PG: multiple active → selection_required; explicit select resolves", async () => {
    const account = await svc.createPropAccount({
      userId: USER,
      label: "PG SEL",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: fixtureUuid("acc-pg-sel"),
      nowUtc: NOW,
      source: "import",
    });
    const a = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: rules("rs-pg-sel-1"),
      id: fixtureUuid("ch-pg-sel-1"),
      ruleSnapshotId: fixtureUuid("rule-pg-sel-1"),
      nowUtc: NOW,
    });
    const b = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: rules("rs-pg-sel-2"),
      id: fixtureUuid("ch-pg-sel-2"),
      ruleSnapshotId: fixtureUuid("rule-pg-sel-2"),
      nowUtc: "2026-01-11T12:00:00.000Z",
    });
    let rm = await svc.getAccountReadModel(USER, account.id);
    assert.equal(rm.challengeSelectionState, "selection_required");
    assert.equal(rm.activeChallenge, null);
    assert.equal(rm.activeChallenges.length, 2);
    assert.equal(rm.ruleSnapshot, null);
    rm = await svc.getAccountReadModel(USER, account.id, {
      selectedChallengeId: b.challenge.id,
    });
    assert.equal(rm.challengeSelectionState, "resolved");
    assert.equal(rm.activeChallenge?.id, b.challenge.id);
    assert.equal(a.challenge.id !== b.challenge.id, true);
  });

  console.log(`prop-os-accounts-pg-qa: PASS (${passed} checks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
