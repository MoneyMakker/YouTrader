import assert from "node:assert/strict";
import {
  PROP_PASS_CALCULATION_VERSION,
  calculatePropPassState,
  type PropPassCalculationPipelineInput,
} from "../src/propPass/tradingOs/index";

const account = {
  contextType: "challenge" as const,
  accountId: "pipeline-account",
  startingBalanceMinor: 5_000_000,
  currentBalanceMinor: 5_010_000,
  currentEquityMinor: 5_010_000,
  equityHighMinor: 5_010_000,
  realizedPnlMinor: 10_000,
  tradingDay: "2026-08-02",
  timezone: "America/New_York",
};
const rules = {
  id: "pipeline-rules",
  effectiveDate: "2026-08-02",
  templateVersion: "1",
  profitTargetMinor: 100_000,
  minimumTradingDays: 3,
  maximumContracts: 5,
  stopAfterLosses: 2,
};
const riskRooms = {
  dailyLossRemainingMinor: 30_000,
  maximumLossRemainingMinor: 40_000,
  drawdownRemainingMinor: 20_000,
  configuredDailyRiskBudgetMinor: 30_000,
  configuredPerTradeRiskCapMinor: 20_000,
};
const instrument = {
  symbol: "QA-MICRO",
  name: "QA micro instrument",
  category: "futures" as const,
  exchange: "QA",
  currency: "USD",
  tickSize: 0.25,
  tickValueMinor: 125,
  pointValueMinor: 500,
  maximumSupportedContracts: 10,
  roundTripCommissionMinor: 0,
  defaultSlippageTicks: 0,
  source: "user_configured" as const,
  verifiedAt: "2026-08-02T00:00:00.000Z",
};

const input: PropPassCalculationPipelineInput = {
  account,
  accountContext: "challenge",
  activeRules: { versionId: "rule-v1", effectiveAt: "2026-08-02T00:00:00.000Z", challengeRules: rules, liveRules: null },
  instrument: { specificationVersion: "instrument-v1", effectiveAt: "2026-08-02T00:00:00.000Z", specification: instrument },
  tradingDay: {
    tradingDayId: "2026-08-02", sessionId: "rth", sessionStatus: "open", currentMinuteLocal: 600, insideAllowedSession: true,
    currentTradingDayStartUtc: "2026-08-02T04:00:00.000Z", currentTradingDayEndUtc: "2026-08-03T04:00:00.000Z",
    currentWeekStartUtc: "2026-07-27T04:00:00.000Z", currentWeekEndUtc: "2026-08-03T04:00:00.000Z", weekStartTradingDayId: "2026-07-27",
    dailyResetDue: false, weeklyResetDue: false, cutoffReached: false, manualSessionLockActive: false,
    accountTimezone: "America/New_York", exchangeTimezone: "America/New_York",
  },
  riskRooms,
  selectedMode: "balanced",
  killSwitch: {
    configuration: { maximumDailyLossMinor: null, maximumWeeklyLossMinor: null, maximumTradeCount: null, consecutiveLossLimit: null, cutoffMinuteLocal: null, stopAfterProfitLock: false, resetStrategy: "next_trading_day" },
    currentDailyLossMinor: 0,
    currentWeeklyLossMinor: 0,
    currentTradeCount: 1,
    consecutiveLosses: 0,
    currentMinuteLocal: 600,
    profitLockStopActive: false,
    manualSessionLockRequested: false,
    manualSessionLockConfirmed: false,
  },
  journal: {
    appliedTradeIds: ["trade-1"],
    completedTrades: [{ id: "trade-1", occurredAt: "2026-08-02T14:00:00.000Z", realizedPnlMinor: -2_000, riskMinor: 2_000, contracts: 1 }],
    dailyRiskUsedMinor: 2_000,
    latestReplayTrade: { id: "trade-1", riskMinor: 2_000, realizedPnlMinor: -2_000, sequenceToday: 1, dailyBufferAfterMinor: 28_000 },
    persistedTimelineFacts: [],
  },
  currentDailyPlan: null,
  dailyPlanDraft: { snapshotId: "plan-1", generatedAt: "2026-08-02T13:00:00.000Z", preferredInstrument: "QA-MICRO", intendedSessionId: "rth", recentLossStreak: 0 },
  proposedTradePlan: { instrument: null, direction: "long", stopDistance: 1, stopUnit: "points", contracts: 2, setup: "verified setup", intendedSessionId: "rth", intendedRiskMinor: 1_000, plannedEntryTime: "2026-08-02T15:00:00.000Z" },
  proposedInterventionTrade: { id: "proposed", occurredAt: "2026-08-02T15:00:00.000Z", realizedPnlMinor: 0, riskMinor: 1_000, contracts: 2 },
  profitLockReached: false,
  challengeFacts: { completedTradingDays: 1, consistencyPassed: true, breach: null, fundedAt: null, archivedAt: null },
  liveFacts: null,
  payout: null,
  withdrawal: null,
};

const output = calculatePropPassState(input);
assert.equal(output.calculationVersion, PROP_PASS_CALCULATION_VERSION);
assert.equal(output.dailyPlan.values?.calculationVersion, PROP_PASS_CALCULATION_VERSION);
assert.equal(output.allowedRisk.values.allowedRiskMinor, 4_500);
assert.equal(output.contractSize?.values.recommendedContracts, 5);
assert.equal(output.preTrade?.status, "safe_to_take");
assert.equal(output.decisionReplay.verdict, "good_decision");
assert.equal(output.challengeLifecycle?.values.state, "active");
assert.deepEqual(output.calculationTrace.map((item) => item.order), Array.from({ length: 13 }, (_, index) => index + 1));
assert.equal(output.journalApplication.persistenceRequired, true);

const duplicate = calculatePropPassState({ ...input, journal: { ...input.journal, appliedTradeIds: ["trade-1", "trade-1"] } });
assert.deepEqual(duplicate.journalApplication.duplicateTradeIds, ["trade-1"]);
assert.ok(duplicate.missingInputs.includes("duplicate_journal_trade_application"));
assert.equal(duplicate.status, "needs_input");

const stopped = calculatePropPassState({ ...input, riskRooms: { ...riskRooms, dailyLossRemainingMinor: 0 } });
assert.equal(stopped.allowedRisk.values.allowedRiskMinor, 0);
assert.equal(stopped.preTrade?.status, "stop_trading");
assert.equal(stopped.contractSize?.values.recommendedContracts, 0);

console.log("prop-pass-calculation-pipeline-qa: PASS");
