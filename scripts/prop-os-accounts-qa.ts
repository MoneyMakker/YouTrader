/**
 * Phase 1D — memory + contract QA for internal account management.
 * App must not import this package.
 */
import assert from "node:assert/strict";
import {
  AccountMgmtError,
  createAccountManagementService,
  createMemoryAccountStore,
  toDbAssignmentState,
} from "../src/propOs/accounts/index";
import type { PropRuleSetSnapshot } from "../src/propOs/types";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log(`  OK  ${name}`);
    });
}

const NOW = "2026-01-10T12:00:00.000Z";
const USER = "user-1d";
const USER_B = "user-1d-other";

function baseRules(version = "rs-1d-v1"): PropRuleSetSnapshot {
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
    minimumTradingDays: 1,
  };
}

async function main() {
  console.log("prop-os-accounts-qa");

  await check("user without account → empty read model", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const rm = await svc.getAccountReadModel(USER, null);
    assert.equal(rm.account, null);
    assert.ok(rm.dataQuality.flags.includes("no_account"));
  });

  await check("create account + challenge + immutable rule snapshot", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const account = await svc.createPropAccount({
      userId: USER,
      label: "Eval 50k",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      nowUtc: NOW,
      id: "acc-1",
    });
    const { challenge, ruleSnapshot } = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules(),
      nowUtc: NOW,
      id: "ch-1",
      ruleSnapshotId: "rule-1",
    });
    assert.equal(challenge.status, "active");
    assert.equal(ruleSnapshot.ruleSetVersion, "rs-1d-v1");
    await assert.rejects(
      () =>
        svc.createRuleSnapshot({
          userId: USER,
          challengeId: challenge.id,
          ruleSnapshot: baseRules("rs-1d-v2"),
        }),
      (e: unknown) => e instanceof AccountMgmtError && e.failure === "conflict",
    );
  });

  await check("multiple accounts + default selection + archive clears default", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const a1 = await svc.createPropAccount({
      userId: USER,
      label: "A1",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: "acc-a1",
      nowUtc: NOW,
    });
    const a2 = await svc.createPropAccount({
      userId: USER,
      label: "A2",
      accountSizeMinor: 10_000_000,
      firmTimezone: "America/New_York",
      id: "acc-a2",
      nowUtc: NOW,
    });
    await svc.setDefaultAccount(USER, a2.id);
    let rm = await svc.getAccountReadModel(USER, null);
    assert.equal(rm.account?.id, a2.id);
    assert.equal(rm.defaultAccountId, a2.id);
    await svc.archiveAccount(USER, a2.id, NOW);
    assert.equal((await store.getDefaultAccountId(USER)), null);
    rm = await svc.getAccountReadModel(USER, a1.id);
    assert.equal(rm.account?.id, a1.id);
    assert.equal(rm.account?.status, "active");
  });

  await check("multiple active challenges + assignment conflict", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const account = await svc.createPropAccount({
      userId: USER,
      label: "Multi",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: "acc-m",
      nowUtc: NOW,
    });
    const c1 = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-m1"),
      id: "ch-m1",
      nowUtc: NOW,
    });
    const c2 = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-m2"),
      id: "ch-m2",
      nowUtc: NOW,
    });
    await svc.assignTrade({
      userId: USER,
      tradeClientId: "t1",
      challengeId: c1.challenge.id,
      state: "assigned_manual",
      actor: "user",
      reason: "manual",
      nowUtc: NOW,
    });
    await assert.rejects(
      () =>
        svc.assignTrade({
          userId: USER,
          tradeClientId: "t1",
          challengeId: c2.challenge.id,
          state: "assigned_manual",
          actor: "user",
          reason: "dup",
          nowUtc: NOW,
        }),
      (e: unknown) => e instanceof AccountMgmtError && e.failure === "duplicate_assignment",
    );
  });

  await check("breached + new attempt (resetOf); no revive", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const account = await svc.createPropAccount({
      userId: USER,
      label: "Reset",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: "acc-r",
      nowUtc: NOW,
    });
    const first = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-r1"),
      id: "ch-r1",
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
    await assert.rejects(
      () =>
        svc.transitionChallenge({
          userId: USER,
          challengeId: first.challenge.id,
          toStatus: "active",
          reasonCode: "revive",
          actor: "user",
          nowUtc: NOW,
        }),
      (e: unknown) => e instanceof AccountMgmtError && e.failure === "forbidden_transition",
    );
    const second = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-r2"),
      resetOfChallengeId: first.challenge.id,
      id: "ch-r2",
      nowUtc: "2026-01-11T12:00:00.000Z",
    });
    assert.equal(second.challenge.resetOfChallengeId, first.challenge.id);
    const rm = await svc.getAccountReadModel(USER, account.id);
    assert.equal(rm.activeChallenge?.id, second.challenge.id);
    assert.ok(rm.historicalAttempts.some((h) => h.id === first.challenge.id));
  });

  await check("passed → funded lifecycle", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const account = await svc.createPropAccount({
      userId: USER,
      label: "Pass",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: "acc-p",
      nowUtc: NOW,
    });
    const { challenge } = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-p1"),
      id: "ch-p1",
      nowUtc: NOW,
    });
    await svc.transitionChallenge({
      userId: USER,
      challengeId: challenge.id,
      toStatus: "passed",
      reasonCode: "profit_target",
      actor: "engine",
      nowUtc: NOW,
    });
    const funded = await svc.transitionChallenge({
      userId: USER,
      challengeId: challenge.id,
      toStatus: "funded",
      reasonCode: "firm_funded",
      actor: "admin_correction",
      nowUtc: NOW,
    });
    assert.equal(funded.challenge.status, "funded");
    assert.equal(funded.challenge.phase, "evaluation"); // phase change would be new attempt in product; status funded allowed
  });

  await check("manual assign / unassign provenance", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const account = await svc.createPropAccount({
      userId: USER,
      label: "Asg",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: "acc-asg",
      nowUtc: NOW,
    });
    const { challenge } = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-asg"),
      id: "ch-asg",
      nowUtc: NOW,
    });
    const assigned = await svc.assignTrade({
      userId: USER,
      tradeClientId: "legacy-1",
      challengeId: challenge.id,
      state: "assigned_manual",
      actor: "user",
      reason: "explicit_legacy",
      nowUtc: NOW,
    });
    assert.equal(assigned.state, "assigned_manual");
    assert.equal(toDbAssignmentState(assigned.state), "manual");
    assert.equal(assigned.provenance.previousState, null);
    const un = await svc.unassignTrade({
      userId: USER,
      tradeClientId: "legacy-1",
      actor: "user",
      reason: "undo",
      nowUtc: NOW,
    });
    assert.equal(un.state, "unassigned");
    assert.equal(un.challengeId, null);
    assert.equal(un.provenance.previousChallengeId, challenge.id);
  });

  await check("cross-user assignment rejected", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const account = await svc.createPropAccount({
      userId: USER,
      label: "X",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: "acc-x",
      nowUtc: NOW,
    });
    const { challenge } = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-x"),
      id: "ch-x",
      nowUtc: NOW,
    });
    await assert.rejects(
      () =>
        svc.assignTrade({
          userId: USER_B,
          tradeClientId: "t-x",
          challengeId: challenge.id,
          state: "assigned_manual",
          actor: "user",
          reason: "steal",
          nowUtc: NOW,
        }),
      (e: unknown) => e instanceof AccountMgmtError && e.failure === "ownership_mismatch",
    );
  });

  await check("invalid trade stored but not verified assignment", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const account = await svc.createPropAccount({
      userId: USER,
      label: "Inv",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: "acc-inv",
      nowUtc: NOW,
    });
    await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-inv"),
      id: "ch-inv",
      nowUtc: NOW,
    });
    const invalid = await svc.unassignTrade({
      userId: USER,
      tradeClientId: "bad-trade",
      actor: "admin_correction",
      reason: "corrupt_import",
      toState: "invalid",
      nowUtc: NOW,
    });
    assert.equal(invalid.state, "invalid");
    const rm = await svc.getAccountReadModel(USER, account.id);
    assert.ok(rm.dataQuality.flags.includes("invalid_trade"));
  });

  await check("template version update does not alter old snapshot", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const account = await svc.createPropAccount({
      userId: USER,
      label: "Tpl",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: "acc-tpl",
      nowUtc: NOW,
    });
    const old = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-tpl-v1"),
      templateKey: "firm-a",
      templateVersionAtCapture: "1.0.0",
      id: "ch-tpl-1",
      nowUtc: NOW,
    });
    const neu = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-tpl-v2"),
      templateKey: "firm-a",
      templateVersionAtCapture: "2.0.0",
      id: "ch-tpl-2",
      nowUtc: "2026-01-12T12:00:00.000Z",
    });
    const oldSnap = await store.getRuleSnapshot(old.challenge.id);
    const newSnap = await store.getRuleSnapshot(neu.challenge.id);
    assert.equal(oldSnap?.templateVersionAtCapture, "1.0.0");
    assert.equal(newSnap?.templateVersionAtCapture, "2.0.0");
    assert.equal(oldSnap?.snapshot.version, "rs-tpl-v1");
  });

  await check("read model latest snapshot + missing snapshot flag", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const account = await svc.createPropAccount({
      userId: USER,
      label: "Snap",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: "acc-snap",
      nowUtc: NOW,
    });
    const { challenge } = await svc.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-snap"),
      id: "ch-snap",
      nowUtc: NOW,
    });
    let rm = await svc.getAccountReadModel(USER, account.id);
    assert.ok(rm.dataQuality.flags.includes("no_shadow_snapshot"));
    await store.putEngineSnapshot?.({
      id: "eng-1",
      user_id: USER,
      challenge_id: challenge.id,
      calculation_version: "calc-spec-v0",
      rule_set_version: "rs-snap",
      input_revision: "shadow-rev:test",
      calculated_at: NOW,
      status: "active",
      payload: { runnerVersion: "shadow-runner-v0" },
      confidence: {
        sampleSize: 1,
        confidence: "low",
        confidencePolicyVersion: "confidence-policy-v0",
        limitations: [],
      },
      limitations: [],
      readiness_model_version: null,
      confidence_policy_version: "confidence-policy-v0",
      fixture_contract_version: null,
      backfill_version: null,
      migration_plan_version: null,
      schema_version: "prop-os-schema-v0",
      created_at: NOW,
    });
    rm = await svc.getAccountReadModel(USER, account.id);
    assert.ok(rm.latestShadowSnapshot);
    assert.equal(rm.latestShadowSnapshot?.input_revision, "shadow-rev:test");
  });

  await check("authenticated role denied writes", async () => {
    const store = createMemoryAccountStore().asRole("authenticated");
    const svc = createAccountManagementService(store);
    await assert.rejects(() =>
      svc.createPropAccount({
        userId: USER,
        label: "Nope",
        accountSizeMinor: 1,
        firmTimezone: "UTC",
        nowUtc: NOW,
      }),
    );
  });

  await check("dormant mode: no default does not break multi-account user", async () => {
    const store = createMemoryAccountStore();
    const svc = createAccountManagementService(store);
    const a1 = await svc.createPropAccount({
      userId: USER,
      label: "D1",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: "acc-d1",
      nowUtc: NOW,
    });
    await svc.createPropAccount({
      userId: USER,
      label: "D2",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      id: "acc-d2",
      nowUtc: NOW,
    });
    const none = await svc.getAccountReadModel(USER, null);
    assert.equal(none.account, null);
    const explicit = await svc.getAccountReadModel(USER, a1.id);
    assert.equal(explicit.account?.id, a1.id);
  });

  console.log(`prop-os-accounts-qa: PASS (${passed} checks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
