import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  loadMultiAccountCommandCenter,
  matchesCommandCenterFilter,
  type CommandCenterSupabaseClient,
} from "../src/propPass/multiAccountCommandCenter";
import { PropPassPersistenceError } from "../src/propPass/persistence/index";
import { PROP_PASS_CALCULATION_VERSION } from "../src/propPass/tradingOs/index";

const userId = "11111111-1111-4111-8111-111111111111";
const challengeAccountId = "22222222-2222-4222-8222-222222222222";
const liveAccountId = "33333333-3333-4333-8333-333333333333";
const challengeId = "44444444-4444-4444-8444-444444444444";
const liveChallengeId = "55555555-5555-4555-8555-555555555555";
const root = path.resolve(import.meta.dirname, "..");
const result = (values: unknown, status = "safe_to_take") => ({
  status,
  values,
  reasons: [],
  missingInputs: [],
  appliedHardLimits: [],
  relatedRuleIds: [],
});

const livePayload = {
  calculationVersion: PROP_PASS_CALCULATION_VERSION,
  status: "stop_trading",
  hardRiskRooms: {
    dailyLossRemainingMinor: 7_500,
    maximumLossRemainingMinor: 20_000,
    drawdownRemainingMinor: 12_500,
    weeklyLossRemainingMinor: 30_000,
    configuredDailyRiskBudgetMinor: 10_000,
    configuredPerTradeRiskCapMinor: 2_000,
  },
  allowedRisk: result({ allowedRiskMinor: 0 }),
  dailyPlan: result({
    id: "live-plan",
    generatedAt: "2026-08-03T14:00:00.000Z",
    accountId: liveAccountId,
    tradingDay: "2026-08-03",
    context: "live",
    mode: "calm",
    maximumRiskTodayMinor: 10_000,
    riskPerTradeMinor: 2_000,
    maximumTrades: 3,
    stopAfterLosses: 2,
    profitLockMinor: null,
    preferredInstrument: null,
    allowedSessionId: null,
    calculationVersion: PROP_PASS_CALCULATION_VERSION,
    instrumentSpecificationVersion: null,
    hardLimitSnapshot: {},
  }),
  riskMeter: result({
    usedMinor: 2_500,
    remainingMinor: 7_500,
    usedRatio: 0.25,
    status: "stop_trading",
    enteredDanger: true,
    statusChanged: true,
  }, "stop_trading"),
  preTrade: null,
  contractSize: null,
  interventions: [{
    severity: "block",
    title: "Personal Kill Switch",
    explanation: "The persisted session lock is active.",
    evidence: "Server-confirmed lock.",
    consequence: "No additional risk.",
    recommendedAction: "End this trading session.",
    blocking: true,
    relatedTradeIds: [],
    relatedRuleId: "kill-switch",
  }],
  journalApplication: {
    appliedTradeIds: [],
    duplicateTradeIds: [],
    latestTradeId: null,
    persistenceRequired: false,
  },
  decisionReplay: {
    verdict: "insufficient_data",
    reason: "No trade.",
    mathematicalConsequence: "No inference.",
    nextAction: "Record a trade.",
  },
  timeline: [],
  challengeLifecycle: null,
  liveLifecycle: result({
    state: "stop_trading",
    currentEquityMinor: 5_125_000,
    equityHighMinor: 5_200_000,
    dailyRiskRemainingMinor: 7_500,
    weeklyLossRoomMinor: 30_000,
    liveRisk: null,
    recovery: { active: true },
    preservation: null,
    killSwitch: { active: true },
  }, "stop_trading"),
  payoutReadiness: null,
  withdrawalReadiness: result({
    recommendedMaximumWithdrawalMinor: 25_000,
    safetyFloorMinor: 5_000_000,
    reserveMinor: 10_000,
  }),
  scaling: null,
  positionProgression: null,
  profitProtection: null,
  compliance: null,
  survival: result({ hardRoomMinor: 12_500, dailyCapacity: 1, drawdownCapacity: 1, modes: [] }),
  breachReplay: result(null, "needs_input"),
  payoutPlanner: result({ scenarios: [] }, "needs_input"),
  whatIf: null,
  missingInputs: [],
  calculationTrace: [],
};

const rows = {
  prop_accounts: [
    { id: challengeAccountId, user_id: userId, firm_key: "Apex", label: "50K Evaluation", currency: "USD", status: "active" },
    { id: liveAccountId, user_id: userId, firm_key: "Topstep", label: "Live 50K", currency: "USD", status: "active" },
    { id: "other", user_id: "other-user", firm_key: null, label: "Private", currency: "USD", status: "active" },
  ],
  prop_challenges: [
    { id: challengeId, user_id: userId, account_id: challengeAccountId, phase: "evaluation", status: "active", updated_at: "2026-08-03T13:00:00.000Z" },
    { id: liveChallengeId, user_id: userId, account_id: liveAccountId, phase: "funded", status: "funded", updated_at: "2026-08-03T13:00:00.000Z" },
  ],
  prop_account_runtime_states: [{
    user_id: userId,
    account_id: liveAccountId,
    challenge_id: liveChallengeId,
    state_revision: 4,
    lifecycle_status: "stop_trading",
    last_processed_event_key: "event-4",
    calculated_at: "2026-08-03T14:00:00.000Z",
    calculation_version: PROP_PASS_CALCULATION_VERSION,
    rule_version: "live-rules-v1",
    instrument_version: null,
    payload_digest: "digest",
    payload: livePayload,
  }],
};

function fakeClient(source: Record<string, Record<string, unknown>[]>) {
  const ownerFilters: Array<{ table: string; column: string; value: string }> = [];
  const client = {
    from(table: string) {
      return {
        select() {
          let selected = [...(source[table] ?? [])];
          const query = {
            eq(column: string, value: string) {
              ownerFilters.push({ table, column, value });
              selected = selected.filter((row) => row[column] === value);
              return query;
            },
            order(column: string, options?: { ascending?: boolean }) {
              selected.sort((left, right) => String(left[column]).localeCompare(String(right[column])) * (options?.ascending ? 1 : -1));
              return query;
            },
            then(resolve: (value: { data: unknown; error: null }) => unknown) {
              return Promise.resolve(resolve({ data: selected, error: null }));
            },
          };
          return query;
        },
        insert: () => Promise.resolve({ data: null, error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
      };
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  } as unknown as CommandCenterSupabaseClient;
  return { client, ownerFilters };
}

const harness = fakeClient(rows);
const accounts = await loadMultiAccountCommandCenter(harness.client, userId);
assert.equal(accounts.length, 2);
assert.deepEqual(
  new Set(harness.ownerFilters.filter((filter) => filter.column === "user_id").map((filter) => filter.table)),
  new Set(["prop_accounts", "prop_challenges", "prop_account_runtime_states"]),
  "every read must include the authenticated owner filter",
);

const live = accounts.find((account) => account.accountId === liveAccountId)!;
const challenge = accounts.find((account) => account.accountId === challengeAccountId)!;
assert.equal(live.context, "live");
assert.equal(live.equityMinor, 5_125_000);
assert.equal(live.dailyRoomMinor, 7_500);
assert.equal(live.weeklyRoomMinor, 30_000);
assert.equal(live.drawdownRoomMinor, 12_500);
assert.equal(live.mode, "calm");
assert.equal(live.killSwitchActive, true);
assert.equal(live.recoveryActive, true);
assert.equal(live.nextAction, "End this trading session.");
assert.equal(challenge.context, "challenge");
assert.equal(challenge.equityMinor, null, "missing persisted equity must never be fabricated");
assert.equal(challenge.needsAttention, true, "an account without validated runtime needs attention");
assert.equal(matchesCommandCenterFilter(live, "stop_trading"), true);
assert.equal(matchesCommandCenterFilter(live, "recovery"), true);
assert.equal(matchesCommandCenterFilter(live, "payout_ready"), false, "Live withdrawal readiness is not mislabeled as payout readiness");
assert.equal(matchesCommandCenterFilter({ ...challenge, payoutReady: true }, "payout_ready"), true);
assert.equal(matchesCommandCenterFilter(challenge, "challenge"), true);

const invalid = fakeClient({
  ...rows,
  prop_accounts: [{ ...rows.prop_accounts[0], currency: "US" }],
  prop_challenges: [rows.prop_challenges[0]],
  prop_account_runtime_states: [],
});
await assert.rejects(
  () => loadMultiAccountCommandCenter(invalid.client, userId),
  (error: unknown) => error instanceof PropPassPersistenceError && error.code === "invalid_row",
  "malformed account data must fail closed",
);

const component = fs.readFileSync(path.join(root, "src/propPass/ui/PropPassMultiAccountCommandCenter.tsx"), "utf8");
const productionScreen = fs.readFileSync(path.join(root, "src/propPass/PropPassInternalScreen.tsx"), "utf8");
for (const filter of ["needs_attention", "healthy", "watch", "danger", "stop_trading", "payout_ready", "recovery", "challenge", "funded", "live"]) {
  assert.ok(component.includes(filter), `missing command center filter: ${filter}`);
}
assert.match(productionScreen, /<PropPassMultiAccountCommandCenter/);
assert.match(productionScreen, /onSelectAccount={selectAccount}/);
assert.match(component, /onSelectAccount/);
assert.match(component, /selectAccountA11y/);
assert.match(productionScreen, /setDefaultAccount/);
assert.match(component, /accessibilityLiveRegion/);
assert.match(component, /YdlSkeletonCard/);
assert.doesNotMatch(component, /#[A-Fa-f0-9]{6}/, "Command Center must use semantic YDL tokens");

console.log("prop-pass-multi-account-command-center-qa: PASS");
