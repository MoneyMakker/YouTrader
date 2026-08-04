/**
 * Persistence-adapter E2E for Journal ↔ Prop Pass save/edit/delete.
 * Mirrors SQL semantics from 20260802225538 (void prior execution once,
 * append replacement, delete voids without insert) and processor rebuild.
 * Not domain-only: claim → rebuild → complete → reload runtime state.
 */
import assert from "node:assert/strict";
import { hashPropOsCommandPayload } from "../src/propOs/commands/hash";
import {
  processPropPassJournalEvent,
  PropPassPersistenceError,
  type JournalPersistenceEvent,
  type PropPassPersistenceAdapter,
  type PropPassJournalRebuild,
} from "../src/propPass/persistence/index";
import { rebuildPropPassRuntime } from "../src/propPass/persistence/runtimeRebuild";
import { PROP_PASS_CALCULATION_VERSION } from "../src/propPass/tradingOs/calculationVersion";
import type { DailyTradingPlanSnapshot } from "../src/propPass/tradingOs/dailyPlan";
import type { ExecutionRow } from "../src/propOs/shadow/types";

const user = "00000000-0000-4000-8000-000000000011";
const otherUser = "00000000-0000-4000-8000-000000000099";
const account = "00000000-0000-4000-8000-000000000012";
const challenge = "00000000-0000-4000-8000-000000000013";
const tradeClientId = "trade-e2e-1";
const asOfUtc = "2026-08-02T16:00:00.000Z";

const frozenPlan: DailyTradingPlanSnapshot = Object.freeze({
  calculationVersion: PROP_PASS_CALCULATION_VERSION,
  id: "frozen-plan-2026-08-01",
  generatedAt: "2026-08-01T12:05:00.000Z",
  accountId: account,
  tradingDay: "2026-08-01",
  context: "challenge",
  mode: "balanced",
  maximumRiskTodayMinor: 20_000,
  riskPerTradeMinor: 10_000,
  maximumTrades: 3,
  stopAfterLosses: 2,
  profitLockMinor: null,
  preferredInstrument: "MES",
  allowedSessionId: "rth",
  instrumentSpecificationVersion: "user-mes-v1",
  hardLimitSnapshot: {
    dailyLossRemainingMinor: 100_000,
    maximumLossRemainingMinor: 200_000,
    drawdownRemainingMinor: 200_000,
    configuredDailyRiskBudgetMinor: 100_000,
    configuredPerTradeRiskCapMinor: 20_000,
  },
});

type StoredEvent = JournalPersistenceEvent & {
  processingState: "pending" | "applied" | "failed";
  resultDigest: string | null;
};

type Store = {
  executions: ExecutionRow[];
  events: Map<string, StoredEvent>;
  runtime: {
    stateRevision: number;
    lifecycleStatus: string;
    lastProcessedEventKey: string | null;
    calculatedAt: string;
    payloadDigest: string;
    payload: PropPassJournalRebuild["output"];
    versions: PropPassJournalRebuild["versions"];
  } | null;
  timelineKeys: Set<string>;
  frozenPlans: DailyTradingPlanSnapshot[];
};

function baseBundle(store: Store) {
  return {
    accountRow: {
      id: account,
      user_id: user,
      firm_key: "custom",
      label: "QA",
      account_size_minor: 5_000_000,
      currency: "USD",
      firm_timezone: "America/Chicago",
      status: "active",
      source: "user_created",
      schema_version: "prop-os-schema-v0",
    },
    challengeRow: {
      id: challenge,
      user_id: user,
      account_id: account,
      phase: "evaluation",
      status: "active",
      rule_set_version: "qa-rules",
      starting_balance_minor: 5_000_000,
      started_at: "2026-08-01T12:00:00.000Z",
      ended_at: null,
      reset_of_challenge_id: null,
      breach_locked: false,
      schema_version: "prop-os-schema-v0",
    },
    ruleSnapshotRow: {
      id: "rules",
      user_id: user,
      challenge_id: challenge,
      rule_set_version: "qa-rules",
      snapshot: {
        version: "qa-rules",
        firmKey: "custom",
        currency: "USD",
        firmTimezone: "America/Chicago",
        tradingDayRolloverHour: 17,
        profitTargetMinor: 300_000,
        dailyLossLimitMinor: 100_000,
        dailyLossBasis: "realized_only",
        dailyLossPolicyVersion: "daily-loss-v0",
        drawdown: { kind: "static", amountMinor: 200_000 },
        minimumTradingDays: 2,
      },
      template_key: null,
      template_version_at_capture: null,
      captured_at: "2026-08-01T12:00:00.000Z",
      schema_version: "prop-os-schema-v0",
    },
    executions: store.executions.map((row) => ({ ...row })),
    accountEvents: [],
    asOfUtc,
    selectedMode: "balanced" as const,
    currentDailyPlan: store.frozenPlans[0] ?? null,
    // Timeline keys are asserted on the adapter store; rebuild gets no invented facts.
    persistedTimelineFacts: [],
    killSwitchSettings: null,
    liveRiskSettings: null,
    recoveryState: null,
  };
}

/** Mirror migration void-once + optional append semantics. */
function applyJournalMaterialChange(
  store: Store,
  input: {
    revision: number;
    eventType: "trade_saved" | "trade_edited" | "trade_deleted";
    pnlMinor: number;
    contracts: number;
    occurredAt: string;
  },
): { priorExecutionId: string | null; activeCount: number } {
  const prior = [...store.executions]
    .filter((row) => !row.voided && row.trade_client_id === tradeClientId)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0] ?? null;
  for (const row of store.executions) {
    if (!row.voided && row.trade_client_id === tradeClientId) row.voided = true;
  }
  if (input.eventType !== "trade_deleted") {
    const id = `journal:${challenge}:${tradeClientId}:${input.revision}`;
    if (!store.executions.some((row) => row.id === id)) {
      store.executions.push({
        id,
        user_id: user,
        challenge_id: challenge,
        account_id: account,
        trade_client_id: tradeClientId,
        occurred_at: input.occurredAt,
        broker_sequence: null,
        realized_pnl_minor: input.pnlMinor,
        fees_minor: 0,
        contracts: input.contracts,
        voided: false,
        corrects_event_id: prior?.id ?? null,
        source: "journal_sync",
        schema_version: "prop-os-schema-v0",
      });
    }
  }
  const activeCount = store.executions.filter((row) => !row.voided && row.trade_client_id === tradeClientId).length;
  return { priorExecutionId: prior?.id ?? null, activeCount };
}

function createStatefulAdapter(store: Store, ownerUserId = user): PropPassPersistenceAdapter {
  return {
    async listDailyPlans() {
      return store.frozenPlans.map((payload) => ({
        id: payload.id,
        accountId: account,
        challengeId: challenge,
        tradingDay: payload.tradingDay,
        versions: {
          calculationVersion: PROP_PASS_CALCULATION_VERSION,
          ruleVersion: "qa-rules",
          instrumentVersion: "user-mes-v1",
        },
        payloadDigest: "frozen-plan-digest",
        payload,
      }));
    },
    async listTimeline() {
      return [];
    },
    async listInstrumentVersions() {
      return [];
    },
    async listRuntimeStates() {
      const state = await this.getRuntimeState(account);
      return state ? [state] : [];
    },
    async getRuntimeState(accountId: string) {
      if (accountId !== account || !store.runtime) return null;
      return {
        accountId: account,
        challengeId: challenge,
        stateRevision: store.runtime.stateRevision,
        lifecycleStatus: store.runtime.lifecycleStatus,
        lastProcessedEventKey: store.runtime.lastProcessedEventKey,
        calculatedAt: store.runtime.calculatedAt,
        versions: store.runtime.versions,
        payloadDigest: store.runtime.payloadDigest,
        payload: store.runtime.payload,
      };
    },
    async appendDailyPlan() {
      throw new PropPassPersistenceError("forbidden", "read path");
    },
    async saveRecoveryModeState() {
      throw new PropPassPersistenceError("forbidden", "read path");
    },
    async claimJournalEvent(event: JournalPersistenceEvent) {
      if (event.userId !== ownerUserId) {
        throw new PropPassPersistenceError("forbidden", "cross-user claim denied");
      }
      const existing = store.events.get(event.eventKey);
      if (existing?.processingState === "applied") {
        return {
          kind: "already_applied" as const,
          eventId: event.eventKey,
          processingState: "applied" as const,
          resultDigest: existing.resultDigest,
        };
      }
      store.events.set(event.eventKey, {
        ...event,
        processingState: "pending",
        resultDigest: null,
      });
      return {
        kind: "claimed" as const,
        eventId: event.eventKey,
        processingState: "pending" as const,
        resultDigest: null,
      };
    },
    async completeJournalEvent(input) {
      const existing = store.events.get(input.eventKey);
      if (!existing) throw new PropPassPersistenceError("invalid_input", "unknown event");
      if (existing.processingState === "applied") return "already_applied";
      existing.processingState = "applied";
      existing.resultDigest = input.resultDigest;
      store.runtime = {
        stateRevision: input.stateRevision,
        lifecycleStatus: input.lifecycleStatus,
        lastProcessedEventKey: input.eventKey,
        calculatedAt: input.calculatedAt,
        payloadDigest: input.stateDigest,
        payload: input.state,
        versions: input.versions,
      };
      store.timelineKeys.add(`timeline:${input.eventKey}`);
      return "applied";
    },
    async failJournalEvent(eventKey: string) {
      const existing = store.events.get(eventKey);
      if (existing) existing.processingState = "failed";
    },
  } as unknown as PropPassPersistenceAdapter;
}

function makeEvent(
  revision: number,
  eventType: JournalPersistenceEvent["eventType"],
  priorEventKey: string | null,
): JournalPersistenceEvent {
  return {
    userId: user,
    accountId: account,
    challengeId: challenge,
    eventKey: `${account}:${tradeClientId}:${revision}:${eventType}`,
    eventType,
    journalTradeId: "journal-row-1",
    tradeClientId,
    tradeRevision: revision,
    calculationVersion: PROP_PASS_CALCULATION_VERSION,
    priorEventKey,
    inputDigest: hashPropOsCommandPayload("prop_pass_journal_input", {
      tradeClientId,
      revision,
      eventType,
    }),
  };
}

async function processRevision(
  store: Store,
  adapter: PropPassPersistenceAdapter,
  input: {
    revision: number;
    eventType: "trade_saved" | "trade_edited" | "trade_deleted";
    pnlMinor: number;
    contracts: number;
    occurredAt: string;
    priorEventKey: string | null;
  },
) {
  const material = applyJournalMaterialChange(store, input);
  const event = makeEvent(input.revision, input.eventType, input.priorEventKey);
  const result = await processPropPassJournalEvent({
    event,
    persistence: adapter,
    rebuild: async () => {
      const rebuilt = rebuildPropPassRuntime(baseBundle(store));
      const priorRevision = store.runtime?.stateRevision ?? 0;
      return {
        stateRevision: Math.max(priorRevision + 1, input.revision),
        lifecycleStatus: rebuilt.lifecycleStatus,
        calculatedAt: asOfUtc,
        versions: {
          calculationVersion: rebuilt.output.calculationVersion,
          ruleVersion: rebuilt.ruleVersion,
          instrumentVersion: rebuilt.instrumentVersion,
        },
        output: rebuilt.output,
      };
    },
  });
  return { result, material, event };
}

const store: Store = {
  executions: [],
  events: new Map(),
  runtime: null,
  timelineKeys: new Set(),
  frozenPlans: [frozenPlan],
};
const adapter = createStatefulAdapter(store);

// SAVE
const save = await processRevision(store, adapter, {
  revision: 1,
  eventType: "trade_saved",
  pnlMinor: -20_000,
  contracts: 2,
  occurredAt: "2026-08-01T15:00:00.000Z",
  priorEventKey: null,
});
assert.equal(save.result.kind, "applied");
assert.equal(save.material.activeCount, 1);
assert.equal(store.runtime?.stateRevision, 1);
assert.deepEqual(store.runtime?.payload.journalApplication.appliedTradeIds, [tradeClientId]);
assert.equal(store.runtime?.payload.hardRiskRooms?.drawdownRemainingMinor, 180_000);
assert.equal((await adapter.listDailyPlans(account))[0].payload.id, frozenPlan.id, "frozen plan survives save");

// Duplicate SAVE request
const saveDup = await processPropPassJournalEvent({
  event: makeEvent(1, "trade_saved", null),
  persistence: adapter,
  rebuild: async () => {
    throw new Error("must not rebuild on duplicate");
  },
});
assert.equal(saveDup.kind, "already_applied");
assert.equal(store.events.size, 1, "duplicate request must not invent a second event row");

// EDIT — prior voided once, new revision applied once, no duplicated P&L
const edit = await processRevision(store, adapter, {
  revision: 2,
  eventType: "trade_edited",
  pnlMinor: -10_000,
  contracts: 1,
  occurredAt: "2026-08-01T15:30:00.000Z",
  priorEventKey: save.event.eventKey,
});
assert.equal(edit.result.kind, "applied");
assert.equal(edit.material.activeCount, 1, "exactly one active execution after edit");
assert.equal(
  store.executions.filter((row) => row.trade_client_id === tradeClientId && row.voided).length,
  1,
  "previous revision voided exactly once",
);
assert.equal(store.runtime?.payload.hardRiskRooms?.drawdownRemainingMinor, 190_000);
assert.equal(store.timelineKeys.size, 2, "timeline keys are event-keyed (idempotent set)");
assert.equal((await adapter.listDailyPlans(account))[0].payload.id, frozenPlan.id, "frozen historical plan preserved on edit");

// DELETE — void active, no replacement insert, rooms restore
const del = await processRevision(store, adapter, {
  revision: 3,
  eventType: "trade_deleted",
  pnlMinor: 0,
  contracts: 0,
  occurredAt: "2026-08-01T16:00:00.000Z",
  priorEventKey: edit.event.eventKey,
});
assert.equal(del.result.kind, "applied");
assert.equal(del.material.activeCount, 0, "no active execution after delete");
assert.equal(store.executions.every((row) => row.voided || row.trade_client_id !== tradeClientId), true);
assert.deepEqual(store.runtime?.payload.journalApplication.appliedTradeIds, []);
assert.equal(store.runtime?.payload.hardRiskRooms?.drawdownRemainingMinor, 200_000, "delete reverses PnL impact");
assert.equal((await adapter.listDailyPlans(account))[0].payload.id, frozenPlan.id, "frozen plan preserved on delete");

// Reload / restart — persisted runtime survives
const reloaded = createStatefulAdapter(store);
const runtimeAfterReload = await reloaded.getRuntimeState(account);
assert.equal(runtimeAfterReload?.stateRevision, 3);
assert.equal(runtimeAfterReload?.lastProcessedEventKey, del.event.eventKey);
assert.deepEqual(runtimeAfterReload?.payload.journalApplication.appliedTradeIds, []);

// Repeated foreground refresh — already_applied, no orphan events
const refresh = await processPropPassJournalEvent({
  event: del.event,
  persistence: reloaded,
  rebuild: async () => {
    throw new Error("refresh must not rebuild");
  },
});
assert.equal(refresh.kind, "already_applied");
assert.equal(store.events.size, 3, "save/edit/delete only — no refresh clones");

// Cross-user denial
const foreign = createStatefulAdapter(store, otherUser);
await assert.rejects(
  () => foreign.claimJournalEvent(makeEvent(4, "trade_saved", null)),
  (error: unknown) => error instanceof PropPassPersistenceError && error.code === "forbidden",
);

// Multi-account isolation: second account store does not see first runtime
const otherAccountStore: Store = {
  executions: [],
  events: new Map(),
  runtime: null,
  timelineKeys: new Set(),
  frozenPlans: [{ ...frozenPlan, accountId: "00000000-0000-4000-8000-000000000022", id: "other-plan" }],
};
const otherAdapter = createStatefulAdapter(otherAccountStore);
assert.equal(await otherAdapter.getRuntimeState(account), null);

console.log("prop-pass-journal-sync-e2e-qa: PASS");
