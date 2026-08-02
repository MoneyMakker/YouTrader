import assert from "node:assert/strict";
import {
  PropPassPersistenceError,
  createSupabasePropPassPersistenceAdapter,
  type PropPassPersistenceSupabaseClient,
} from "../src/propPass/persistence/index";
import { PROP_PASS_CALCULATION_VERSION } from "../src/propPass/tradingOs/calculationVersion";
import type { DailyTradingPlanSnapshot } from "../src/propPass/tradingOs/dailyPlan";

const userId = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const plan: DailyTradingPlanSnapshot = Object.freeze({
  calculationVersion: PROP_PASS_CALCULATION_VERSION, id: "plan-key", generatedAt: "2026-08-02T15:00:00.000Z",
  accountId, tradingDay: "2026-08-02", context: "challenge", mode: "balanced",
  maximumRiskTodayMinor: 10_000, riskPerTradeMinor: 2_000, maximumTrades: 3,
  stopAfterLosses: 2, profitLockMinor: null, preferredInstrument: "MES", allowedSessionId: "rth",
  instrumentSpecificationVersion: "user-mes-v1",
  hardLimitSnapshot: { dailyLossRemainingMinor: 10_000, maximumLossRemainingMinor: 10_000, drawdownRemainingMinor: 10_000, configuredDailyRiskBudgetMinor: 10_000, configuredPerTradeRiskCapMinor: 2_000 },
});

type RowMap = Record<string, Record<string, unknown>[]>;
function fakeClient(rows: RowMap, rpcResponses: Record<string, Record<string, unknown>> = {}) {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const upserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    from(table) {
      return {
        select() {
          let selected = [...(rows[table] ?? [])];
          const query = {
            eq(column: string, value: string) { selected = selected.filter((row) => row[column] === value); return query; },
            order(column: string, options?: { ascending?: boolean }) { selected.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (options?.ascending ? 1 : -1)); return query; },
            then(resolve: (value: { data: unknown; error: null }) => unknown) { return Promise.resolve(resolve({ data: selected, error: null })); },
          };
          return query;
        },
        insert(row) { inserts.push({ table, row }); return Promise.resolve({ data: null, error: null }); },
        upsert(row) { upserts.push({ table, row }); return Promise.resolve({ data: null, error: null }); },
      };
    },
    rpc(fn, args) { rpcCalls.push({ fn, args }); return Promise.resolve({ data: rpcResponses[fn] ?? { kind: "claimed", eventId: "event-1", processingState: "pending", resultDigest: null }, error: null }); },
  } as unknown as PropPassPersistenceSupabaseClient;
  return { client, inserts, upserts, rpcCalls };
}

const storedPlanRow = { id: "33333333-3333-4333-8333-333333333333", user_id: userId, account_id: accountId, challenge_id: null, trading_day: "2026-08-02", calculation_version: PROP_PASS_CALCULATION_VERSION, rule_version: "rules-v1", instrument_version: "user-mes-v1", payload_digest: "digest-plan", generated_at: plan.generatedAt, payload: plan };
const readHarness = fakeClient({ prop_daily_plan_snapshots: [storedPlanRow] });
const readOnly = createSupabasePropPassPersistenceAdapter({ client: readHarness.client, authenticatedUserId: userId });
assert.equal((await readOnly.listDailyPlans(accountId))[0].payload.id, "plan-key");

await assert.rejects(
  () => readOnly.appendDailyPlan({ id: String(storedPlanRow.id), accountId, challengeId: null, tradingDay: "2026-08-02", versions: { calculationVersion: PROP_PASS_CALCULATION_VERSION, ruleVersion: "rules-v1", instrumentVersion: "user-mes-v1" }, payloadDigest: "digest-plan", payload: plan }),
  (error: unknown) => error instanceof PropPassPersistenceError && error.code === "forbidden",
  "mobile/read adapter must never mutate",
);
assert.equal(readHarness.inserts.length, 0);

const crossUser = fakeClient({ prop_daily_plan_snapshots: [{ ...storedPlanRow, user_id: "other-user" }] });
const crossAdapter = createSupabasePropPassPersistenceAdapter({ client: crossUser.client, authenticatedUserId: userId });
assert.equal((await crossAdapter.listDailyPlans(accountId)).length, 0, "owner filters are explicit even with RLS");

const trustedHarness = fakeClient({}, {
  prop_os_processor_claim_journal_event: { kind: "claimed", eventId: "event-1", processingState: "pending", resultDigest: null },
  prop_os_processor_complete_journal_event: { kind: "applied", stateRevision: 1 },
  prop_os_processor_fail_journal_event: { kind: "failed" },
});
const trusted = createSupabasePropPassPersistenceAdapter({ client: trustedHarness.client, authenticatedUserId: userId, trustedProcessorMutations: true });
await trusted.appendDailyPlan({ id: String(storedPlanRow.id), accountId, challengeId: null, tradingDay: "2026-08-02", versions: { calculationVersion: PROP_PASS_CALCULATION_VERSION, ruleVersion: "rules-v1", instrumentVersion: "user-mes-v1" }, payloadDigest: "digest-plan", payload: plan });
assert.equal(trustedHarness.inserts[0].row.user_id, userId);
assert.equal(trustedHarness.inserts[0].row.calculation_version, PROP_PASS_CALCULATION_VERSION);
await trusted.saveRecoveryModeState(accountId, { updatedAt: "2026-08-02T15:00:00.000Z", state: { active: true, belowEquityHighBps: 500, normalRiskPerTradeMinor: 2_000, reducedRiskPerTradeMinor: 1_000, normalMaximumContracts: 4, reducedMaximumContracts: 2, activationReason: "Configured drawdown threshold reached.", exitCriteria: ["Three compliant profitable sessions."], exitProgress: { completedCompliantProfitableSessions: 0, requiredCompliantProfitableSessions: 3 }, scalingDisabled: true, gamblerDisabled: true } });
assert.equal(trustedHarness.upserts[0].table, "prop_recovery_mode_states");
assert.equal(trustedHarness.upserts[0].row.updated_at, "2026-08-02T15:00:00.000Z");

const claim = await trusted.claimJournalEvent({ userId, accountId, challengeId: null, eventKey: `${accountId}:trade-1:1:trade_saved`, eventType: "trade_saved", journalTradeId: null, tradeClientId: "trade-1", tradeRevision: 1, calculationVersion: PROP_PASS_CALCULATION_VERSION, priorEventKey: null, inputDigest: "input-digest" });
assert.equal(claim.kind, "claimed");
assert.equal(trustedHarness.rpcCalls[0].fn, "prop_os_processor_claim_journal_event");

const state = { calculationVersion: PROP_PASS_CALCULATION_VERSION, status: "safe_to_take" } as Parameters<typeof trusted.completeJournalEvent>[0]["state"];
assert.equal(await trusted.completeJournalEvent({ eventKey: `${accountId}:trade-1:1:trade_saved`, resultDigest: "result-digest", stateRevision: 1, lifecycleStatus: "active", calculatedAt: "2026-08-02T15:01:00.000Z", versions: { calculationVersion: PROP_PASS_CALCULATION_VERSION, ruleVersion: "rules-v1", instrumentVersion: "user-mes-v1" }, stateDigest: "state-digest", state }), "applied");

await assert.rejects(
  () => trusted.claimJournalEvent({ userId: "other-user", accountId, challengeId: null, eventKey: "bad", eventType: "trade_saved", journalTradeId: null, tradeClientId: "trade-1", tradeRevision: 1, calculationVersion: PROP_PASS_CALCULATION_VERSION, priorEventKey: null, inputDigest: "digest" }),
  (error: unknown) => error instanceof PropPassPersistenceError && error.code === "forbidden",
);

console.log("prop-pass-persistence-adapter-qa: PASS");
