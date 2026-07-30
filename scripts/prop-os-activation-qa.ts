/**
 * Phase 1E — Controlled Activation contract QA (memory + gateway).
 * Does not touch production. App.tsx must remain Prop OS free.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createAccountManagementService,
  createMemoryAccountStore,
} from "../src/propOs/accounts/index";
import {
  createMutableKillSwitch,
  createPropOsAppGateway,
  createPropOsReadService,
  DEFAULT_ACTIVATION_CONFIG,
  evaluateSnapshotFreshness,
  parseActivationMode,
  resolveActivationConfig,
  type PropOsActivationConfig,
} from "../src/propOs/activation/index";
import type { PropRuleSetSnapshot } from "../src/propOs/types";
import type { EngineSnapshotRow } from "../src/propOs/shadow/types";

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
const USER = "user-1e";
const USER_B = "user-1e-other";
const ROOT = path.resolve(import.meta.dirname, "..");

function baseRules(version = "rs-1e-v1"): PropRuleSetSnapshot {
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

function cfg(partial: Partial<PropOsActivationConfig>): PropOsActivationConfig {
  return { ...DEFAULT_ACTIVATION_CONFIG, ...partial };
}

function engineSnap(partial: Partial<EngineSnapshotRow> & { challenge_id: string }): EngineSnapshotRow {
  return {
    id: partial.id ?? "eng-1",
    user_id: partial.user_id ?? USER,
    challenge_id: partial.challenge_id,
    calculation_version: partial.calculation_version ?? "calc-spec-v0",
    rule_set_version: partial.rule_set_version ?? "rs-1e-v1",
    input_revision: partial.input_revision ?? "rev-1",
    calculated_at: partial.calculated_at ?? NOW,
    status: partial.status ?? "ok",
    payload: partial.payload ?? { accountState: {} },
    confidence: partial.confidence ?? {},
    limitations: partial.limitations ?? [],
    readiness_model_version: partial.readiness_model_version ?? null,
    confidence_policy_version: partial.confidence_policy_version ?? "confidence-policy-v0",
    fixture_contract_version: null,
    backfill_version: null,
    migration_plan_version: null,
    schema_version: partial.schema_version ?? "prop-os-schema-v0",
    created_at: partial.created_at ?? NOW,
  };
}

async function seedAccount(opts?: {
  withSnapshot?: boolean;
  incompleteIntraday?: boolean;
  twoActive?: boolean;
  archive?: boolean;
  badRule?: boolean;
}) {
  const store = createMemoryAccountStore();
  const accounts = createAccountManagementService(store);
  const account = await accounts.createPropAccount({
    userId: USER,
    label: "Eval",
    accountSizeMinor: 5_000_000,
    firmTimezone: "America/New_York",
    nowUtc: NOW,
    id: "acc-1e",
  });
  const { challenge } = await accounts.createChallengeAttempt({
    userId: USER,
    accountId: account.id,
    ruleSnapshot: opts?.badRule
      ? ({ version: "rs-1e-v1" } as PropRuleSetSnapshot)
      : baseRules(),
    nowUtc: NOW,
    id: "ch-1e",
    ruleSnapshotId: "rule-1e",
  });
  if (opts?.twoActive) {
    await accounts.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules("rs-1e-v2"),
      nowUtc: NOW,
      id: "ch-1e-b",
      ruleSnapshotId: "rule-1e-b",
    });
  }
  if (opts?.withSnapshot && store.putEngineSnapshot) {
    await store.putEngineSnapshot(
      engineSnap({
        challenge_id: challenge.id,
        input_revision: "rev-1",
      }),
    );
  }
  if (opts?.incompleteIntraday) {
    // Mark via data quality by creating invalid assignment flag path — use store flag on read model
    // Inject by putting a hard-quality assignment
    await accounts.assignTrade({
      userId: USER,
      tradeClientId: "t1",
      challengeId: challenge.id,
      state: "assigned_manual",
      actor: "user",
      reason: "test",
      dataQuality: "hard",
      nowUtc: NOW,
    });
  }
  if (opts?.archive) {
    await accounts.archiveAccount(USER, account.id, NOW);
  }
  return { store, accounts, account, challenge };
}

async function main() {
  console.log("prop-os-activation-qa");

  await check("1. activation missing → off", () => {
    const r = resolveActivationConfig(null);
    assert.equal(r.config.mode, "off");
    assert.ok(r.warnings.includes("config_missing"));
  });

  await check("2. invalid activation value → off", () => {
    assert.equal(parseActivationMode("public_production"), "off");
    assert.equal(parseActivationMode(""), "off");
    assert.equal(parseActivationMode(42), "off");
    const r = resolveActivationConfig({ mode: "prod_on" });
    assert.equal(r.config.mode, "off");
    assert.ok(r.warnings.includes("invalid_mode_coerced_off"));
  });

  await check("3. off mode makes zero Prop OS calls", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true });
    let accountCalls = 0;
    const wrapped = {
      ...accounts,
      getAccountReadModel: async (...args: Parameters<typeof accounts.getAccountReadModel>) => {
        accountCalls += 1;
        return accounts.getAccountReadModel(...args);
      },
      listActiveChallengesForAccount: async (
        ...args: Parameters<typeof accounts.listActiveChallengesForAccount>
      ) => {
        accountCalls += 1;
        return accounts.listActiveChallengesForAccount(...args);
      },
    };
    const svc = createPropOsReadService({
      config: cfg({ mode: "off" }),
      accounts: wrapped as typeof accounts,
    });
    const res = await svc.getActivatedReadModel({ userId: USER, accountId: "acc-1e" });
    assert.equal(res.ok, false);
    assert.equal(res.gate, "activation_off");
    assert.equal(accountCalls, 0);
    assert.equal(svc.getPropOsCallCount(), 0);

    const gw = createPropOsAppGateway({
      config: cfg({ mode: "off" }),
      accountsFactory: () => {
        throw new Error("factory_must_not_run_when_off");
      },
    });
    const peek = gw.peekAvailability(USER);
    assert.equal(peek.mode, "off");
    const gres = await gw.getActivatedReadModel({ userId: USER, accountId: null });
    assert.equal(gres.ok, false);
    assert.equal(gw.getPropOsCallCount(), 0);
  });

  await check("4. eligible internal user", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true });
    const svc = createPropOsReadService({
      config: cfg({
        mode: "internal_read_only",
        allowlistUserIds: [USER],
      }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({
      userId: USER,
      accountId: "acc-1e",
      currentInputRevision: "rev-1",
      nowUtc: NOW,
    });
    assert.equal(res.ok, true);
    assert.equal(res.gate, "available");
  });

  await check("5. ineligible user", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true });
    const svc = createPropOsReadService({
      config: cfg({
        mode: "internal_read_only",
        allowlistUserIds: [USER],
      }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({
      userId: USER_B,
      accountId: "acc-1e",
      currentInputRevision: "rev-1",
    });
    assert.equal(res.ok, false);
    assert.equal(res.gate, "ineligible");
  });

  await check("6. missing authenticated user", async () => {
    const { accounts } = await seedAccount();
    const svc = createPropOsReadService({
      config: cfg({ mode: "internal_read_only", allowlistUserIds: [USER] }),
      accounts,
    });
    const res = await svc.getActivatedReadModel({ userId: null, accountId: null });
    assert.equal(res.ok, false);
    assert.equal(res.gate, "missing_user");
  });

  await check("7. no Prop account", async () => {
    const store = createMemoryAccountStore();
    const accounts = createAccountManagementService(store);
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({ userId: USER, accountId: null });
    assert.equal(res.ok, false);
    assert.equal(res.gate, "no_account");
  });

  await check("8. one active challenge + available", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true });
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({
      userId: USER,
      accountId: "acc-1e",
      currentInputRevision: "rev-1",
      nowUtc: NOW,
    });
    assert.equal(res.ok, true);
    assert.equal(res.data?.readModel.activeChallenge?.id, "ch-1e");
  });

  await check("9. multiple active challenges", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true, twoActive: true });
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({
      userId: USER,
      accountId: "acc-1e",
      currentInputRevision: "rev-1",
    });
    assert.equal(res.ok, false);
    assert.equal(res.gate, "multiple_active_challenges");
  });

  await check("10. archived default account historically readable gate path", async () => {
    const { accounts, store, challenge } = await seedAccount({
      withSnapshot: true,
      archive: true,
    });
    // archive clears default; historical challenge remains
    assert.ok(store);
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({
      userId: USER,
      accountId: "acc-1e",
      currentInputRevision: "rev-1",
      nowUtc: NOW,
    });
    // archived with historical + snapshot → available (no active required)
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.data?.readModel.account?.status, "archived");
    assert.equal(challenge.id, "ch-1e");
  });

  await check("11. stale snapshot (max age)", () => {
    const f = evaluateSnapshotFreshness({
      snapshotInputRevision: "rev-1",
      currentInputRevision: "rev-1",
      calculationVersion: "calc-spec-v0",
      ruleSetVersion: "rs-1",
      currentRuleSetVersion: "rs-1",
      readinessModelVersion: null,
      confidencePolicyVersion: "confidence-policy-v0",
      calculatedAt: "2026-01-01T00:00:00.000Z",
      nowUtc: "2026-01-10T00:00:00.000Z",
      maxAgeMs: 1000,
      allowedCalculationVersions: ["calc-spec-v0"],
      allowedConfidencePolicyVersions: ["confidence-policy-v0"],
    });
    assert.equal(f.fresh, false);
    assert.ok(f.reasons.includes("max_age_exceeded"));
  });

  await check("12. mismatched input revision", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true });
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({
      userId: USER,
      accountId: "acc-1e",
      currentInputRevision: "rev-OTHER",
      nowUtc: NOW,
    });
    assert.equal(res.ok, false);
    assert.equal(res.gate, "stale_snapshot");
    assert.ok(res.reasonCodes.includes("input_revision_mismatch"));
  });

  await check("13. mismatched calculation version", async () => {
    const { accounts, store, challenge } = await seedAccount();
    await store.putEngineSnapshot?.(
      engineSnap({
        challenge_id: challenge.id,
        calculation_version: "calc-ancient",
      }),
    );
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({
      userId: USER,
      accountId: "acc-1e",
      currentInputRevision: "rev-1",
    });
    assert.equal(res.ok, false);
    assert.equal(res.gate, "unsupported_calculation");
  });

  await check("14. invalid rule snapshot", async () => {
    const store = createMemoryAccountStore();
    const accounts = createAccountManagementService(store);
    const account = await accounts.createPropAccount({
      userId: USER,
      label: "X",
      accountSizeMinor: 1_000_000,
      firmTimezone: "UTC",
      nowUtc: NOW,
      id: "acc-bad-rule",
    });
    // Bypass service validation by inserting via store after a valid create then mutating — use create then overwrite snapshot in memory
    const { challenge } = await accounts.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules(),
      nowUtc: NOW,
      id: "ch-bad",
    });
    const bad = await store.getRuleSnapshot(challenge.id);
    assert.ok(bad);
    // corrupt via re-insert pattern: memory store keeps one — mutate object
    delete (bad.snapshot as { version?: string }).version;
    await store.putEngineSnapshot?.(engineSnap({ challenge_id: challenge.id }));
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({
      userId: USER,
      accountId: account.id,
      currentInputRevision: "rev-1",
    });
    assert.equal(res.ok, false);
    assert.ok(
      res.gate === "incomplete_data" || res.reasonCodes.includes("invalid_rule_snapshot"),
      JSON.stringify(res),
    );
  });

  await check("15. incomplete intraday / hard data quality", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true, incompleteIntraday: true });
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({
      userId: USER,
      accountId: "acc-1e",
      currentInputRevision: "rev-1",
      nowUtc: NOW,
    });
    assert.equal(res.ok, false);
    assert.equal(res.gate, "incomplete_data");
  });

  await check("16. repository timeout", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true });
    const wrapped = {
      ...accounts,
      getAccountReadModel: async () => {
        throw new Error("repository timeout exceeded");
      },
    };
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts: wrapped as typeof accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({ userId: USER, accountId: "acc-1e" });
    assert.equal(res.gate, "repository_unavailable");
    assert.ok(res.reasonCodes.includes("repository_timeout"));
  });

  await check("17. repository exception", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true });
    const wrapped = {
      ...accounts,
      getAccountReadModel: async () => {
        throw new Error("boom");
      },
    };
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts: wrapped as typeof accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({ userId: USER, accountId: "acc-1e" });
    assert.equal(res.gate, "repository_unavailable");
    assert.ok(res.reasonCodes.includes("repository_exception"));
  });

  await check("18. schema version mismatch", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true });
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v999",
    });
    const res = await svc.getActivatedReadModel({ userId: USER, accountId: "acc-1e" });
    assert.equal(res.gate, "schema_incompatible");
  });

  await check("19. kill switch during active session", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true });
    const kill = createMutableKillSwitch(false);
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      killSwitch: kill,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const ok = await svc.getActivatedReadModel({
      userId: USER,
      accountId: "acc-1e",
      currentInputRevision: "rev-1",
      nowUtc: NOW,
    });
    assert.equal(ok.ok, true);
    kill.setActive(true);
    svc.resetCallCount();
    let calls = 0;
    const wrappedAccounts = {
      ...accounts,
      getAccountReadModel: async (...a: Parameters<typeof accounts.getAccountReadModel>) => {
        calls += 1;
        return accounts.getAccountReadModel(...a);
      },
    };
    const svc2 = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts: wrappedAccounts as typeof accounts,
      killSwitch: kill,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const off = await svc2.getActivatedReadModel({
      userId: USER,
      accountId: "acc-1e",
      currentInputRevision: "rev-1",
    });
    assert.equal(off.ok, false);
    assert.equal(off.gate, "activation_off");
    assert.equal(calls, 0);
  });

  await check("20. App restart with activation off", async () => {
    const gw = createPropOsAppGateway({
      env: {},
      accountsFactory: () => {
        throw new Error("must not construct");
      },
    });
    assert.equal(gw.peekAvailability(USER).mode, "off");
    const res = await gw.getActivatedReadModel({ userId: USER, accountId: null });
    assert.equal(res.gate, "activation_off");
  });

  await check("21. cross-user read rejection (ownership)", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true });
    // USER_B allowlisted but does not own account — ownership throws → repository_exception or ownership
    const svc = createPropOsReadService({
      config: cfg({
        mode: "staging_preview",
        allowlistUserIds: [USER, USER_B],
      }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({
      userId: USER_B,
      accountId: "acc-1e",
      currentInputRevision: "rev-1",
    });
    assert.equal(res.ok, false);
    assert.ok(
      res.gate === "repository_unavailable" || res.gate === "no_account",
      JSON.stringify(res),
    );
  });

  await check("22. authenticated write rejection contract (no mutate API)", () => {
    const gw = createPropOsAppGateway({ config: cfg({ mode: "off" }) });
    assert.equal("getActivatedReadModel" in gw, true);
    assert.equal("createPropAccount" in gw, false);
    assert.equal("assignTrade" in gw, false);
  });

  await check("23. service-role credential absence from App / activation bundle paths", () => {
    const app = fs.readFileSync(path.join(ROOT, "App.tsx"), "utf8");
    assert.equal(/propOs|SERVICE_ROLE|service_role/.test(app), false);
    const actDir = path.join(ROOT, "src/propOs/activation");
    for (const f of fs.readdirSync(actDir)) {
      if (!f.endsWith(".ts")) continue;
      const body = fs.readFileSync(path.join(actDir, f), "utf8");
      assert.equal(
        /SUPABASE_SERVICE_ROLE|service_role\s*=/.test(body),
        false,
        f,
      );
    }
  });

  await check("24. current App regression — Prop OS disconnected", () => {
    const app = fs.readFileSync(path.join(ROOT, "App.tsx"), "utf8");
    assert.equal(/from\s+['\"].*propOs/.test(app), false);
    const youPath = path.join(ROOT, "src/app/YouTraderApp.tsx");
    if (fs.existsSync(youPath)) {
      const you = fs.readFileSync(youPath, "utf8");
      assert.equal(/from\s+['\"].*propOs/.test(you), false);
    }
  });

  await check("shadow mode is App-invisible (zero account calls)", async () => {
    const { accounts } = await seedAccount({ withSnapshot: true });
    let calls = 0;
    const wrapped = {
      ...accounts,
      getAccountReadModel: async (...a: Parameters<typeof accounts.getAccountReadModel>) => {
        calls += 1;
        return accounts.getAccountReadModel(...a);
      },
    };
    const svc = createPropOsReadService({
      config: cfg({ mode: "shadow" }),
      accounts: wrapped as typeof accounts,
    });
    const res = await svc.getActivatedReadModel({ userId: USER, accountId: "acc-1e" });
    assert.equal(res.ok, false);
    assert.equal(calls, 0);
  });

  await check("time alone does not prove freshness", () => {
    const f = evaluateSnapshotFreshness({
      snapshotInputRevision: "old",
      currentInputRevision: "new",
      calculationVersion: "calc-spec-v0",
      ruleSetVersion: "rs-1",
      currentRuleSetVersion: "rs-1",
      readinessModelVersion: null,
      confidencePolicyVersion: "confidence-policy-v0",
      calculatedAt: NOW,
      nowUtc: NOW,
      maxAgeMs: null,
      allowedCalculationVersions: ["calc-spec-v0"],
      allowedConfidencePolicyVersions: ["confidence-policy-v0"],
    });
    assert.equal(f.fresh, false);
    assert.ok(f.reasons.includes("input_revision_mismatch"));
  });

  await check("no_shadow_snapshot gate", async () => {
    const { accounts } = await seedAccount({ withSnapshot: false });
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const res = await svc.getActivatedReadModel({
      userId: USER,
      accountId: "acc-1e",
      currentInputRevision: "rev-1",
    });
    assert.equal(res.gate, "no_shadow_snapshot");
  });

  console.log(`prop-os-activation-qa: PASS (${passed})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
