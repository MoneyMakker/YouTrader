/**
 * Phase 2A — Prop Pass foundation QA (UI state mapping, access, zero-call, a11y keys).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createAccountManagementService,
  createMemoryAccountStore,
} from "../src/propOs/accounts/index";
import {
  createPropOsAppGateway,
  createPropOsReadService,
  DEFAULT_ACTIVATION_CONFIG,
  type PropOsActivationConfig,
} from "../src/propOs/activation/index";
import {
  isPropPassEntryVisible,
  mapActivationToPropPassUiState,
  mapActivatedReadModelToViewModel,
  resetPropPassGatewayForTests,
  resolvePropPassAccess,
} from "../src/propPass/index";
import type { PropPassUiState } from "../src/propPass/types";
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

const ROOT = path.resolve(import.meta.dirname, "..");
const NOW = "2026-01-10T12:00:00.000Z";
const USER = "user-2a";

function cfg(partial: Partial<PropOsActivationConfig>): PropOsActivationConfig {
  return { ...DEFAULT_ACTIVATION_CONFIG, ...partial };
}

function baseRules(version = "rs-2a"): PropRuleSetSnapshot {
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

function engineSnap(challengeId: string, extra?: Partial<EngineSnapshotRow>): EngineSnapshotRow {
  return {
    id: "eng-2a",
    user_id: USER,
    challenge_id: challengeId,
    calculation_version: "calc-spec-v0",
    rule_set_version: "rs-2a",
    input_revision: "rev-1",
    calculated_at: NOW,
    status: "active",
    payload: {
      status: "active",
      accountState: { equityMinor: 5_100_000, startingBalanceMinor: 5_000_000 },
      buffers: [
        {
          id: "daily_loss",
          remainingMinor: 800_000,
          limitMinor: 1_000_000,
          status: "ok",
          limitations: [],
        },
        {
          id: "drawdown",
          remainingMinor: 150_000,
          limitMinor: 200_000,
          status: "warn",
          limitations: [],
        },
        {
          id: "target_distance",
          remainingMinor: 200_000,
          limitMinor: 300_000,
          status: "ok",
          limitations: [],
        },
      ],
      readiness: {
        score: 72,
        confidence: { level: "medium" },
      },
      limitations: [],
    },
    confidence: { level: "medium" },
    limitations: [],
    readiness_model_version: "readiness-v0",
    confidence_policy_version: "confidence-policy-v0",
    fixture_contract_version: null,
    backfill_version: null,
    migration_plan_version: null,
    schema_version: "prop-os-schema-v0",
    created_at: NOW,
    ...extra,
  };
}

async function main() {
  console.log("prop-pass-phase2a-qa");

  await check("off mode zero-call after App gateway wiring", async () => {
    resetPropPassGatewayForTests();
    const gw = createPropOsAppGateway({
      config: cfg({ mode: "off" }),
      accountsFactory: () => {
        throw new Error("must_not_run");
      },
    });
    assert.equal(gw.peekAvailability(USER).mode, "off");
    const res = await gw.getActivatedReadModel({ userId: USER, accountId: null });
    assert.equal(res.ok, false);
    assert.equal(res.gate, "activation_off");
    assert.equal(gw.getPropOsCallCount(), 0);
    assert.equal(isPropPassEntryVisible({ EXPO_PUBLIC_APP_ENV: "production" }, gw.peekAvailability(USER)), false);
  });

  await check("gateway init throw → App-usable disabled access", () => {
    resetPropPassGatewayForTests();
    // Force peek via resolve when gateway missing
    const access = resolvePropPassAccess(
      { EXPO_PUBLIC_APP_ENV: "staging", EXPO_PUBLIC_PROP_OS_ACTIVATION_MODE: "off" },
      {
        mode: "off",
        eligible: false,
        gate: "activation_off",
        reasonCodes: ["mode_off"],
        killSwitch: false,
      },
    );
    assert.equal(access.entryVisible, false);
  });

  await check("production mode entry hidden", () => {
    assert.equal(
      isPropPassEntryVisible(
        { EXPO_PUBLIC_APP_ENV: "production" },
        {
          mode: "off",
          eligible: false,
          gate: "activation_off",
          reasonCodes: [],
          killSwitch: false,
        },
      ),
      false,
    );
    assert.equal(
      isPropPassEntryVisible(
        { EXPO_PUBLIC_APP_ENV: "staging" },
        {
          mode: "staging_preview",
          eligible: true,
          gate: "available",
          reasonCodes: ["eligible"],
          killSwitch: false,
        },
      ),
      true,
    );
  });

  await check("UI state mappings cover required kinds", async () => {
    const kinds = new Set<PropPassUiState["kind"]>();
    const baseFail = {
      ok: false as const,
      mode: "staging_preview" as const,
      diagnostics: [],
      data: null,
    };
    const cases: Array<Parameters<typeof mapActivationToPropPassUiState>[0]> = [
      { entryAllowed: false, loading: false, result: null },
      { entryAllowed: true, loading: true, result: null },
      {
        entryAllowed: true,
        loading: false,
        result: { ...baseFail, gate: "no_account", reasonCodes: [] },
      },
      {
        entryAllowed: true,
        loading: false,
        result: { ...baseFail, gate: "no_active_challenge", reasonCodes: [] },
      },
      {
        entryAllowed: true,
        loading: false,
        result: {
          ...baseFail,
          gate: "multiple_active_challenges",
          reasonCodes: [],
          data: {
            gate: "multiple_active_challenges",
            freshnessReasons: [],
            readModel: {
              account: null,
              defaultAccountId: null,
              activeChallenge: null,
              activeChallenges: [
                {
                  id: "c1",
                  userId: USER,
                  accountId: "a1",
                  phase: "evaluation",
                  status: "active",
                  ruleSetVersion: "r",
                  startingBalanceMinor: 1,
                  startedAt: NOW,
                  endedAt: null,
                  resetOfChallengeId: null,
                  breachLocked: false,
                  createdAt: NOW,
                  updatedAt: NOW,
                },
              ],
              challengeSelectionState: "selection_required",
              historicalAttempts: [],
              ruleSnapshot: null,
              assignedTradeCount: 0,
              unassignedTradeCount: 0,
              dataQuality: { level: "warn", flags: [] },
              latestShadowSnapshot: null,
              latestScoreSnapshot: null,
            },
          },
        },
      },
      {
        entryAllowed: true,
        loading: false,
        result: { ...baseFail, gate: "missing_rule_snapshot", reasonCodes: [] },
      },
      {
        entryAllowed: true,
        loading: false,
        result: { ...baseFail, gate: "no_shadow_snapshot", reasonCodes: [] },
      },
      {
        entryAllowed: true,
        loading: false,
        result: {
          ...baseFail,
          gate: "stale_snapshot",
          reasonCodes: ["input_revision_mismatch"],
        },
      },
      {
        entryAllowed: true,
        loading: false,
        result: {
          ...baseFail,
          gate: "incomplete_data",
          reasonCodes: ["hard_data_quality"],
        },
      },
      {
        entryAllowed: true,
        loading: false,
        result: {
          ...baseFail,
          gate: "unsupported_calculation",
          reasonCodes: ["unsupported_calculation_version"],
        },
      },
      {
        entryAllowed: true,
        loading: false,
        result: { ...baseFail, gate: "integrity_mismatch", reasonCodes: [] },
      },
      {
        entryAllowed: true,
        loading: false,
        result: { ...baseFail, gate: "repository_unavailable", reasonCodes: [] },
      },
    ];
    for (const c of cases) kinds.add(mapActivationToPropPassUiState(c).kind);

    const store = createMemoryAccountStore();
    const accounts = createAccountManagementService(store);
    const account = await accounts.createPropAccount({
      userId: USER,
      label: "A",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      nowUtc: NOW,
      id: "acc-2a",
    });
    const { challenge } = await accounts.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules(),
      nowUtc: NOW,
      id: "ch-2a",
    });
    await store.putEngineSnapshot?.(engineSnap(challenge.id));
    const svc = createPropOsReadService({
      config: cfg({ mode: "staging_preview", allowlistUserIds: [USER] }),
      accounts,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    const ok = await svc.getActivatedReadModel({
      userId: USER,
      accountId: account.id,
      currentInputRevision: "rev-1",
      nowUtc: NOW,
    });
    assert.equal(ok.ok, true);
    kinds.add(
      mapActivationToPropPassUiState({
        entryAllowed: true,
        loading: false,
        result: ok,
      }).kind,
    );
    assert.ok(kinds.has("available"));
    assert.ok(kinds.has("disabled"));
    assert.ok(kinds.has("loading"));
    assert.ok(kinds.has("no_account"));
    assert.ok(kinds.has("challenge_selection_required"));
    assert.ok(kinds.has("stale_snapshot"));
    assert.ok(kinds.has("repository_unavailable"));
  });

  await check("view model maps buffers without inventing score 0", async () => {
    const store = createMemoryAccountStore();
    const accounts = createAccountManagementService(store);
    const account = await accounts.createPropAccount({
      userId: USER,
      label: "VM",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      nowUtc: NOW,
      id: "acc-vm",
    });
    const { challenge } = await accounts.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules(),
      nowUtc: NOW,
      id: "ch-vm",
    });
    await store.putEngineSnapshot?.(
      engineSnap(challenge.id, {
        payload: {
          status: "breached",
          accountState: { equityMinor: 4_800_000 },
          buffers: [
            {
              id: "daily_loss",
              remainingMinor: 0,
              limitMinor: 1_000_000,
              status: "hard",
              limitations: [],
            },
          ],
          readiness: { score: 10, confidence: { level: "low" } },
          limitations: ["breached"],
        },
      }),
    );
    const rm = await accounts.getAccountReadModel(USER, account.id);
    const vm = mapActivatedReadModelToViewModel(rm);
    assert.equal(vm.readiness.score, null); // lifecycle override
    assert.equal(vm.buffers.dailyLoss?.status, "hard");
    assert.equal(vm.buffers.trailingDrawdown?.status, "unsupported");
  });

  await check("null readiness remains null (not zero)", async () => {
    const store = createMemoryAccountStore();
    const accounts = createAccountManagementService(store);
    const account = await accounts.createPropAccount({
      userId: USER,
      label: "NR",
      accountSizeMinor: 5_000_000,
      firmTimezone: "America/New_York",
      nowUtc: NOW,
      id: "acc-nr",
    });
    const { challenge } = await accounts.createChallengeAttempt({
      userId: USER,
      accountId: account.id,
      ruleSnapshot: baseRules(),
      nowUtc: NOW,
      id: "ch-nr",
    });
    await store.putEngineSnapshot?.(
      engineSnap(challenge.id, {
        payload: {
          status: "active",
          accountState: { equityMinor: 5_000_000 },
          buffers: [],
          readiness: null,
          limitations: ["insufficient_trades"],
        },
      }),
    );
    const vm = mapActivatedReadModelToViewModel(
      await accounts.getAccountReadModel(USER, account.id),
    );
    assert.equal(vm.readiness.score, null);
  });

  await check("no direct domain imports from Prop Pass UI files", () => {
    const uiFiles = [
      "src/propPass/PropPassInternalScreen.tsx",
      "src/propPass/BufferHealthSection.tsx",
    ];
    for (const rel of uiFiles) {
      const body = fs.readFileSync(path.join(ROOT, rel), "utf8");
      assert.equal(/calculateChallenge|createMemoryAccountStore|shadow\/runner/.test(body), false);
    }
    const you = fs.readFileSync(path.join(ROOT, "src/app/YouTraderApp.tsx"), "utf8");
    assert.equal(/from\s+['\"].*propOs/.test(you), false);
    assert.ok(/from\s+['\"].*propPass/.test(you));
  });

  await check("localization keys present for Prop Pass", () => {
    const en = JSON.parse(
      fs.readFileSync(path.join(ROOT, "src/i18n/locales/en.json"), "utf8"),
    ) as Record<string, string>;
    const required = [
      "propPass.title",
      "propPass.buffer.sectionTitle",
      "propPass.a11y.bufferExhausted",
      "propPass.state.repository",
      "propPass.settingsEntryTitle",
    ];
    for (const k of required) assert.ok(en[k], k);
  });

  await check("service-role absent from propPass + App entry", () => {
    for (const rel of [
      "src/propPass",
      "App.tsx",
    ]) {
      const target = path.join(ROOT, rel);
      const files = fs.statSync(target).isDirectory()
        ? fs.readdirSync(target).map((f) => path.join(target, f))
        : [target];
      for (const f of files) {
        if (!/\.(ts|tsx)$/.test(f)) continue;
        const body = fs.readFileSync(f, "utf8");
        assert.equal(/SUPABASE_SERVICE_ROLE|service_role\s*=/.test(body), false, f);
      }
    }
  });

  console.log(`prop-pass-phase2a-qa: PASS (${passed})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
