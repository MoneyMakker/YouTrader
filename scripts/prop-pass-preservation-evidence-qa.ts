/**
 * Capital Preservation persisted evidence QA.
 * Covers withhold / insufficient / ready paths, profitable violator,
 * losing-but-compliant, edit/delete/duplicate/reload, isolation.
 */
import assert from "node:assert/strict";
import {
  evaluateCapitalPreservationEvidence,
  PRESERVATION_CALCULATION_VERSION,
  type CapitalPreservationEvidenceInput,
  type PersistedTradeRiskFact,
} from "../src/propPass/tradingOs/preservationEvidence";
import { rebuildPropPassRuntime } from "../src/propPass/persistence/runtimeRebuild";
import { PROP_PASS_CALCULATION_VERSION } from "../src/propPass/tradingOs/calculationVersion";
import type { DailyTradingPlanSnapshot } from "../src/propPass/tradingOs/dailyPlan";

const user = "00000000-0000-4000-8000-000000000021";
const otherUser = "00000000-0000-4000-8000-000000000099";
const account = "00000000-0000-4000-8000-000000000022";
const otherAccount = "00000000-0000-4000-8000-000000000023";
const challenge = "00000000-0000-4000-8000-000000000024";

const plan: DailyTradingPlanSnapshot = Object.freeze({
  calculationVersion: PROP_PASS_CALCULATION_VERSION,
  id: "plan-preservation-1",
  generatedAt: "2026-08-01T12:05:00.000Z",
  accountId: account,
  tradingDay: "2026-08-01",
  context: "live",
  mode: "calm",
  maximumRiskTodayMinor: 50_000,
  riskPerTradeMinor: 10_000,
  maximumTrades: 4,
  stopAfterLosses: 2,
  profitLockMinor: null,
  preferredInstrument: "MES",
  allowedSessionId: "rth",
  instrumentSpecificationVersion: "user-mes-v1",
  hardLimitSnapshot: {
    dailyLossRemainingMinor: 50_000,
    maximumLossRemainingMinor: 200_000,
    drawdownRemainingMinor: 200_000,
    configuredDailyRiskBudgetMinor: 50_000,
    configuredPerTradeRiskCapMinor: 10_000,
    weeklyLossRemainingMinor: 100_000,
  },
});

function baseInput(overrides: Partial<CapitalPreservationEvidenceInput> = {}): CapitalPreservationEvidenceInput {
  return {
    userId: user,
    accountId: account,
    context: "live",
    tradingDayId: "2026-08-01",
    currentEquityMinor: 5_000_000,
    equityHighMinor: 5_020_000,
    maximumDrawdownMinor: 200_000,
    dailyRiskBudgetMinor: 50_000,
    dailyRiskUsedMinor: 8_000,
    weeklyLossLimitMinor: 100_000,
    weeklyLossUsedMinor: 8_000,
    riskRooms: {
      dailyLossRemainingMinor: 42_000,
      maximumLossRemainingMinor: 180_000,
      drawdownRemainingMinor: 180_000,
      configuredDailyRiskBudgetMinor: 50_000,
      configuredPerTradeRiskCapMinor: 10_000,
      weeklyLossRemainingMinor: 92_000,
    },
    dailyPlan: plan,
    killSwitch: {
      configuration: {
        maximumDailyLossMinor: null,
        maximumWeeklyLossMinor: null,
        maximumTradeCount: null,
        consecutiveLossLimit: 2,
        cutoffMinuteLocal: null,
        stopAfterProfitLock: false,
        resetStrategy: "next_trading_day",
      },
      currentDailyLossMinor: 8_000,
      currentWeeklyLossMinor: 8_000,
      currentTradeCount: 1,
      consecutiveLosses: 1,
      currentMinuteLocal: null,
      profitLockStopActive: false,
      manualSessionLockRequested: false,
      manualSessionLockConfirmed: false,
      manualSessionLockReason: null,
      manualSessionLockExpiresAt: null,
    },
    recovery: {
      active: false,
      belowEquityHighBps: 40,
      normalRiskPerTradeMinor: 10_000,
      reducedRiskPerTradeMinor: 5_000,
      normalMaximumContracts: 2,
      reducedMaximumContracts: 1,
      activationReason: null,
      exitCriteria: [],
      exitProgress: { completedCompliantProfitableSessions: 0, requiredCompliantProfitableSessions: 3 },
      scalingDisabled: false,
      gamblerDisabled: false,
    },
    breach: null,
    activeExecutions: [{
      id: "exec-1",
      userId: user,
      accountId: account,
      tradeClientId: "trade-1",
      contracts: 1,
      occurredAt: "2026-08-01T15:00:00.000Z",
    }],
    tradeRiskFacts: [{
      tradeClientId: "trade-1",
      tradeRevision: 1,
      executionId: "exec-1",
      occurredAt: "2026-08-01T15:00:00.000Z",
      plannedRiskMinor: 8_000,
      actualRiskMinor: 8_000,
      contracts: 1,
      sessionId: "rth",
      voided: false,
      accountId: account,
      userId: user,
    }],
    timelineFacts: [],
    maximumContracts: 2,
    consecutiveLossLimit: 2,
    ...overrides,
  };
}

// 1) no facts → score withheld
{
  const empty = evaluateCapitalPreservationEvidence(baseInput({
    tradingDayId: null,
    riskRooms: null,
    dailyPlan: null,
    killSwitch: null,
    recovery: null,
    activeExecutions: [],
    tradeRiskFacts: [],
    currentEquityMinor: null,
    equityHighMinor: null,
  }));
  assert.equal(empty.status, "needs_input");
  assert.equal(empty.score, null);
  assert.equal(empty.calculationVersion, PRESERVATION_CALCULATION_VERSION);
}

// 2) partial facts → insufficient evidence
{
  const partial = evaluateCapitalPreservationEvidence(baseInput({
    maximumContracts: null,
    tradeRiskFacts: [],
    activeExecutions: [{
      id: "exec-1",
      userId: user,
      accountId: account,
      tradeClientId: "trade-1",
      contracts: null,
      occurredAt: "2026-08-01T15:00:00.000Z",
    }],
  }));
  assert.equal(partial.status, "insufficient_evidence");
  assert.equal(partial.score, null);
  assert.ok(partial.missingInputs.some((item) => item.includes("preservation_")));
}

// 3) sufficient compliant facts → deterministic score
{
  const ready = evaluateCapitalPreservationEvidence(baseInput());
  assert.equal(ready.status, "ready");
  assert.ok(typeof ready.score === "number" && ready.score >= 70);
  assert.ok(ready.evidenceRefs.length > 0);
  const again = evaluateCapitalPreservationEvidence(baseInput());
  assert.equal(again.score, ready.score);
  assert.deepEqual(again.evidenceRefs, ready.evidenceRefs);
}

// 4) profitable violations → reduced score (hard rule 0)
{
  const violator = evaluateCapitalPreservationEvidence(baseInput({
    dailyRiskUsedMinor: 5_000,
    tradeRiskFacts: [{
      tradeClientId: "trade-win",
      tradeRevision: 1,
      executionId: "exec-win",
      occurredAt: "2026-08-01T15:00:00.000Z",
      plannedRiskMinor: 10_000,
      actualRiskMinor: 25_000,
      contracts: 1,
      sessionId: "rth",
      voided: false,
      accountId: account,
      userId: user,
    }],
    activeExecutions: [{
      id: "exec-win",
      userId: user,
      accountId: account,
      tradeClientId: "trade-win",
      contracts: 1,
      occurredAt: "2026-08-01T15:00:00.000Z",
    }],
  }));
  assert.equal(violator.status, "ready");
  assert.equal(violator.components.hard_rule_compliance, 0);
  const compliant = evaluateCapitalPreservationEvidence(baseInput());
  assert.ok((violator.score ?? 0) < (compliant.score ?? 0), "profitable over-risk must not score as strongly as compliant");
}

// 5) losing but compliant → preserved strong score
{
  const losing = evaluateCapitalPreservationEvidence(baseInput({
    dailyRiskUsedMinor: 8_000,
    currentEquityMinor: 4_980_000,
    tradeRiskFacts: [{
      tradeClientId: "trade-loss",
      tradeRevision: 1,
      executionId: "exec-loss",
      occurredAt: "2026-08-01T15:00:00.000Z",
      plannedRiskMinor: 8_000,
      actualRiskMinor: 8_000,
      contracts: 1,
      sessionId: "rth",
      voided: false,
      accountId: account,
      userId: user,
    }],
  }));
  assert.equal(losing.status, "ready");
  assert.ok((losing.score ?? 0) >= 70, "losing but plan-compliant may remain strong");
  assert.equal(losing.components.hard_rule_compliance, 100);
}

// 6) edit/delete recalculation — voided prior revision ignored; new revision once
{
  const prior: PersistedTradeRiskFact = {
    tradeClientId: "trade-1",
    tradeRevision: 1,
    executionId: "exec-1",
    occurredAt: "2026-08-01T15:00:00.000Z",
    plannedRiskMinor: 8_000,
    actualRiskMinor: 25_000,
    contracts: 3,
    sessionId: "rth",
    voided: true,
    accountId: account,
    userId: user,
  };
  const next: PersistedTradeRiskFact = {
    ...prior,
    tradeRevision: 2,
    executionId: "exec-2",
    actualRiskMinor: 8_000,
    contracts: 1,
    voided: false,
  };
  const afterEdit = evaluateCapitalPreservationEvidence(baseInput({
    tradeRiskFacts: [prior, next],
    activeExecutions: [{
      id: "exec-2",
      userId: user,
      accountId: account,
      tradeClientId: "trade-1",
      contracts: 1,
      occurredAt: "2026-08-01T15:00:00.000Z",
    }],
  }));
  assert.equal(afterEdit.status, "ready");
  assert.equal(afterEdit.components.hard_rule_compliance, 100);
  assert.equal(afterEdit.components.position_size_stability, 100);

  const afterDelete = evaluateCapitalPreservationEvidence(baseInput({
    tradeRiskFacts: [{ ...next, voided: true }],
    activeExecutions: [],
    dailyRiskUsedMinor: 0,
    weeklyLossUsedMinor: 0,
    killSwitch: {
      ...baseInput().killSwitch!,
      currentDailyLossMinor: 0,
      currentWeeklyLossMinor: 0,
      currentTradeCount: 0,
      consecutiveLosses: 0,
    },
  }));
  assert.equal(afterDelete.status, "ready");
  assert.equal(afterDelete.components.hard_rule_compliance, 100);
}

// 7) duplicate delivery identical
{
  const facts = baseInput().tradeRiskFacts;
  const once = evaluateCapitalPreservationEvidence(baseInput({ tradeRiskFacts: facts }));
  const dup = evaluateCapitalPreservationEvidence(baseInput({ tradeRiskFacts: [...facts, ...facts] }));
  assert.equal(dup.score, once.score);
  assert.deepEqual(dup.components, once.components);
}

// 8) reload identical
{
  const first = evaluateCapitalPreservationEvidence(baseInput());
  const second = evaluateCapitalPreservationEvidence(baseInput());
  assert.deepEqual(second, first);
}

// 9) cross-user denial — foreign facts ignored
{
  const foreign = evaluateCapitalPreservationEvidence(baseInput({
    activeExecutions: [{
      id: "exec-own",
      userId: user,
      accountId: account,
      tradeClientId: "trade-1",
      contracts: 1,
      occurredAt: "2026-08-01T15:00:00.000Z",
    }],
    tradeRiskFacts: [{
      tradeClientId: "trade-1",
      tradeRevision: 1,
      executionId: "exec-own",
      occurredAt: "2026-08-01T15:00:00.000Z",
      plannedRiskMinor: 8_000,
      actualRiskMinor: 8_000,
      contracts: 1,
      sessionId: "rth",
      voided: false,
      accountId: account,
      userId: user,
    }, {
      tradeClientId: "foreign",
      tradeRevision: 1,
      executionId: "exec-x",
      occurredAt: "2026-08-01T15:00:00.000Z",
      plannedRiskMinor: 8_000,
      actualRiskMinor: 50_000,
      contracts: 9,
      sessionId: "rth",
      voided: false,
      accountId: account,
      userId: otherUser,
    }],
  }));
  assert.equal(foreign.components.hard_rule_compliance, 100);
  assert.equal(foreign.components.position_size_stability, 100);
}

// 10) multi-account isolation
{
  const isolated = evaluateCapitalPreservationEvidence(baseInput({
    tradeRiskFacts: [{
      tradeClientId: "other-acc",
      tradeRevision: 1,
      executionId: "exec-o",
      occurredAt: "2026-08-01T15:00:00.000Z",
      plannedRiskMinor: 8_000,
      actualRiskMinor: 50_000,
      contracts: 9,
      sessionId: "rth",
      voided: false,
      accountId: otherAccount,
      userId: user,
    }, {
      tradeClientId: "trade-1",
      tradeRevision: 1,
      executionId: "exec-1",
      occurredAt: "2026-08-01T15:00:00.000Z",
      plannedRiskMinor: 8_000,
      actualRiskMinor: 8_000,
      contracts: 1,
      sessionId: "rth",
      voided: false,
      accountId: account,
      userId: user,
    }],
  }));
  assert.equal(isolated.components.hard_rule_compliance, 100);
}

// Runtime rebuild wires evaluation into pipeline output
{
  const asOfUtc = "2026-08-02T16:00:00.000Z";
  const base = {
    accountRow: {
      id: account, user_id: user, firm_key: "custom", label: "QA", account_size_minor: 5_000_000,
      currency: "USD", firm_timezone: "America/Chicago", status: "active", source: "user_created", schema_version: "prop-os-schema-v0",
    },
    challengeRow: {
      id: challenge, user_id: user, account_id: account, phase: "funded", status: "funded",
      rule_set_version: "qa-rules", starting_balance_minor: 5_000_000, started_at: "2026-08-01T12:00:00.000Z",
      ended_at: null, reset_of_challenge_id: null, breach_locked: false, schema_version: "prop-os-schema-v0",
    },
    ruleSnapshotRow: {
      id: "rules", user_id: user, challenge_id: challenge, rule_set_version: "qa-rules",
      snapshot: {
        version: "qa-rules", firmKey: "custom", currency: "USD", firmTimezone: "America/Chicago",
        tradingDayRolloverHour: 17, profitTargetMinor: 300_000, dailyLossLimitMinor: 100_000,
        dailyLossBasis: "realized_only", dailyLossPolicyVersion: "daily-loss-v0",
        drawdown: { kind: "static", amountMinor: 200_000 }, minimumTradingDays: 2, maxContracts: 2,
      },
      template_key: null, template_version_at_capture: null, captured_at: "2026-08-01T12:00:00.000Z",
      schema_version: "prop-os-schema-v0",
    },
    executions: [{
      id: "exec-a", user_id: user, challenge_id: challenge, account_id: account, trade_client_id: "trade-a",
      occurred_at: "2026-08-01T15:00:00.000Z", broker_sequence: null, realized_pnl_minor: -8_000,
      fees_minor: 0, contracts: 1, voided: false, corrects_event_id: null, source: "journal_sync",
      schema_version: "prop-os-schema-v0",
    }],
    accountEvents: [],
    asOfUtc,
    selectedMode: "calm" as const,
    currentDailyPlan: { ...plan, context: "live" as const },
    persistedTimelineFacts: [],
    killSwitchSettings: null,
    liveRiskSettings: {
      configuredAt: asOfUtc, selectedMode: "calm" as const, weekStartsOn: 1 as const,
      normalRiskPerTradeMinor: 10_000, normalMaximumContracts: 2,
      recoveryRiskBps: 5_000, minimumCompliantProfitableSessions: 3,
      rules: {
        id: "live-v1", dailyRiskBudgetMinor: 50_000, weeklyLossLimitMinor: 100_000,
        maximumDrawdownMinor: 200_000, perTradeRiskCapMinor: 10_000, maximumTrades: 4,
        consecutiveLossLimit: 2, recoveryModeThresholdBps: 30,
      },
    },
    recoveryState: {
      state: {
        active: false, belowEquityHighBps: 0, normalRiskPerTradeMinor: 10_000,
        reducedRiskPerTradeMinor: 5_000, normalMaximumContracts: 2, reducedMaximumContracts: 1,
        activationReason: null, exitCriteria: [],
        exitProgress: { completedCompliantProfitableSessions: 1, requiredCompliantProfitableSessions: 3 },
        scalingDisabled: false, gamblerDisabled: false,
      },
      updatedAt: asOfUtc,
    },
    tradeRiskFacts: [{
      tradeClientId: "trade-a",
      tradeRevision: 1,
      executionId: "exec-a",
      occurredAt: "2026-08-01T15:00:00.000Z",
      plannedRiskMinor: 8_000,
      actualRiskMinor: 8_000,
      contracts: 1,
      sessionId: "rth",
      voided: false,
      accountId: account,
      userId: user,
    }],
  };
  const rebuilt = rebuildPropPassRuntime(base);
  assert.equal(rebuilt.output.capitalPreservation?.status, "ready");
  assert.ok(typeof rebuilt.output.capitalPreservation?.score === "number");
  assert.equal(rebuilt.output.liveLifecycle?.values.preservation?.score, rebuilt.output.capitalPreservation?.score);
  const withheld = rebuildPropPassRuntime({ ...base, tradeRiskFacts: [], currentDailyPlan: null, liveRiskSettings: { ...base.liveRiskSettings, normalMaximumContracts: undefined } });
  assert.notEqual(withheld.output.capitalPreservation?.status, "ready");
  assert.equal(withheld.output.liveLifecycle?.values.preservation?.score ?? null, null);
}

console.log("prop-pass-preservation-evidence-qa: PASS");
