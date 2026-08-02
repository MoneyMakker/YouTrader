import assert from "node:assert/strict";
import { processPropPassJournalEvent, type PropPassPersistenceAdapter } from "../src/propPass/persistence/index";
import { PROP_PASS_CALCULATION_VERSION } from "../src/propPass/tradingOs/calculationVersion";
import type { PropPassCalculationPipelineOutput } from "../src/propPass/tradingOs/pipelineContracts";
import { publishPropPassJournalMutation, subscribeToPropPassJournalMutations } from "../src/propPass/journalRefreshBus";

const event = { userId: "user", accountId: "account", challengeId: "challenge", eventKey: "account:trade:2:trade_edited", eventType: "trade_edited" as const, journalTradeId: null, tradeClientId: "trade", tradeRevision: 2, calculationVersion: PROP_PASS_CALCULATION_VERSION, priorEventKey: "account:trade:1:trade_assigned", inputDigest: "input" };
const output = { calculationVersion: PROP_PASS_CALCULATION_VERSION, status: "safe_to_take", journalApplication: { appliedTradeIds: ["trade"], duplicateTradeIds: [], latestTradeId: "trade", persistenceRequired: true } } as PropPassCalculationPipelineOutput;

function harness(claimKind: "claimed" | "already_applied" = "claimed") {
  const calls: string[] = [];
  const adapter = {
    claimJournalEvent: async () => { calls.push("claim"); return { kind: claimKind, eventId: "event", processingState: claimKind === "already_applied" ? "applied" : "pending", resultDigest: null }; },
    completeJournalEvent: async () => { calls.push("complete"); return "applied" as const; },
    failJournalEvent: async () => { calls.push("fail"); },
  } as unknown as PropPassPersistenceAdapter;
  return { calls, adapter };
}

const first = harness();
const applied = await processPropPassJournalEvent({ event, persistence: first.adapter, rebuild: async () => ({ stateRevision: 2, lifecycleStatus: "active", calculatedAt: "2026-08-02T15:00:00.000Z", versions: { calculationVersion: PROP_PASS_CALCULATION_VERSION, ruleVersion: "rules-v1", instrumentVersion: "instrument-v1" }, output }) });
assert.equal(applied.kind, "applied");
assert.deepEqual(first.calls, ["claim", "complete"]);

const replay = harness("already_applied");
assert.equal((await processPropPassJournalEvent({ event, persistence: replay.adapter, rebuild: async () => { throw new Error("must not rebuild"); } })).kind, "already_applied");
assert.deepEqual(replay.calls, ["claim"]);

const stale = harness();
await assert.rejects(() => processPropPassJournalEvent({ event, persistence: stale.adapter, rebuild: async () => ({ stateRevision: 1, lifecycleStatus: "active", calculatedAt: "2026-08-02T15:00:00.000Z", versions: { calculationVersion: PROP_PASS_CALCULATION_VERSION, ruleVersion: "rules-v1", instrumentVersion: null }, output }) }));
assert.deepEqual(stale.calls, ["claim", "fail"]);

const duplicate = harness();
await assert.rejects(() => processPropPassJournalEvent({ event, persistence: duplicate.adapter, rebuild: async () => ({ stateRevision: 2, lifecycleStatus: "active", calculatedAt: "2026-08-02T15:00:00.000Z", versions: { calculationVersion: PROP_PASS_CALCULATION_VERSION, ruleVersion: "rules-v1", instrumentVersion: null }, output: { ...output, journalApplication: { ...output.journalApplication, duplicateTradeIds: ["trade"] } } }) }));
assert.deepEqual(duplicate.calls, ["claim", "fail"]);

const mutations: string[] = [];
const unsubscribe = subscribeToPropPassJournalMutations((mutation) => mutations.push(`${mutation.kind}:${mutation.tradeClientId}`));
publishPropPassJournalMutation({ kind: "updated", tradeClientId: "trade", occurredAt: "2026-08-02T15:00:00.000Z" });
publishPropPassJournalMutation({ kind: "updated", tradeClientId: "", occurredAt: "invalid" });
unsubscribe();
publishPropPassJournalMutation({ kind: "deleted", tradeClientId: "trade", occurredAt: "2026-08-02T15:01:00.000Z" });
assert.deepEqual(mutations, ["updated:trade"]);

console.log("prop-pass-journal-sync-qa: PASS");
