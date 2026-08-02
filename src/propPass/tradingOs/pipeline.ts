import { buildChallengeTimeline } from "./timeline";
import { calculateAllowedRisk } from "./domain";
import { createDailyTradingPlan } from "./dailyPlan";
import { assessSmartInterventions } from "./interventions";
import { evaluateKillSwitch } from "./killSwitch";
import { evaluateLiveAccount } from "./liveAccount";
import { calculatePayoutReadiness } from "./payout";
import { calculatePositionSize } from "./positionSizing";
import { assessPreTrade } from "./preTrade";
import { createDecisionReplay } from "./replay";
import { calculateLiveRiskMeter } from "./riskMeter";
import { evaluateChallengeLifecycle } from "./challenge";
import { calculateMaximumSafeWithdrawal } from "./withdrawal";
import {
  RISK_MODE_POLICIES,
  type AllowedRiskValues,
  type DecisionStatus,
  type InstrumentSpec,
  type TradingOsResult,
} from "./contracts";
import {
  PROP_PASS_CALCULATION_VERSION,
  type PropPassCalculationPipelineInput,
  type PropPassCalculationPipelineOutput,
  type PropPassCalculationTraceStep,
} from "./pipelineContracts";

const STATUS_PRIORITY: Record<DecisionStatus, number> = {
  safe_to_take: 0,
  risky: 1,
  rule_violation: 2,
  needs_input: 3,
  stop_trading: 4,
};

/**
 * Canonical, runtime-neutral Prop Pass orchestration. UI and persistence layers
 * consume this result; they do not independently derive risk recommendations.
 */
export function calculatePropPassState(input: PropPassCalculationPipelineInput): PropPassCalculationPipelineOutput {
  const trace: PropPassCalculationTraceStep[] = [];
  const missingInputs: string[] = [];
  const account = input.account;
  if (!account || input.accountContext !== account.contextType) missingInputs.push("account_context");
  trace.push(step(1, "account", account ? "safe_to_take" : "needs_input", null, {
    accountId: account?.accountId ?? null,
    context: input.accountContext,
  }, { accountValidated: Boolean(account && input.accountContext === account.contextType) }));

  const rules = input.activeRules;
  const activeRules = account?.contextType === "challenge" ? rules?.challengeRules : rules?.liveRules;
  if (!rules?.versionId || !activeRules) missingInputs.push("active_rule_version");
  trace.push(step(2, "rules", activeRules ? "safe_to_take" : "needs_input", rules?.versionId ?? null, {
    effectiveAt: rules?.effectiveAt ?? null,
  }, { rulesAvailable: Boolean(activeRules) }));

  const tradingDay = input.tradingDay;
  if (!tradingDay?.tradingDayId || account?.tradingDay !== tradingDay.tradingDayId) missingInputs.push("trading_day_context");
  trace.push(step(3, "trading_day", tradingDay ? "safe_to_take" : "needs_input", null, {
    tradingDayId: tradingDay?.tradingDayId ?? null,
    sessionId: tradingDay?.sessionId ?? null,
  }, { insideAllowedSession: tradingDay?.insideAllowedSession ?? null }));

  const instrument = input.instrument;
  if (input.proposedTradePlan && !instrument?.specificationVersion) missingInputs.push("instrument_specification_version");
  trace.push(step(4, "instrument", !input.proposedTradePlan || instrument ? "safe_to_take" : "needs_input", instrument?.specificationVersion ?? null, {
    symbol: instrument?.specification.symbol ?? null,
  }, { verified: Boolean(instrument) }));

  const rooms = input.riskRooms;
  if (!rooms) missingInputs.push("risk_rooms");
  trace.push(step(5, "hard_risk_rooms", rooms ? "safe_to_take" : "needs_input", rules?.versionId ?? null, {
    daily: rooms?.dailyLossRemainingMinor ?? null,
    maximum: rooms?.maximumLossRemainingMinor ?? null,
    drawdown: rooms?.drawdownRemainingMinor ?? null,
    weekly: rooms?.weeklyLossRemainingMinor ?? null,
  }, { complete: Boolean(rooms) }));

  const allowedRisk = account && rooms && activeRules
    ? completeAllowedRisk(calculateAllowedRisk(RISK_MODE_POLICIES[input.selectedMode], rooms, account.contextType))
    : emptyAllowedRisk();
  missingInputs.push(...allowedRisk.missingInputs);
  trace.push(step(6, "mode_limits", allowedRisk.status, rules?.versionId ?? null, {
    mode: input.selectedMode,
    safeBudgetMinor: allowedRisk.values.safeBudgetMinor,
  }, { allowedRiskMinor: allowedRisk.values.allowedRiskMinor }, [
    "allowedRisk = floor(min(hard rooms) × mode allocation bps ÷ 10000)",
  ], ["Risk allocation rounds down to currency minor units."]));

  const killSwitch = input.killSwitch ? evaluateKillSwitch(input.killSwitch) : null;
  if (!killSwitch) missingInputs.push("kill_switch_state");
  const liveLifecycle = account?.contextType === "live" && rooms && input.liveFacts && input.killSwitch
    ? evaluateLiveAccount({ ...input.liveFacts, account, rules: rules?.liveRules ?? null, riskRooms: rooms, killSwitch: input.killSwitch })
    : null;
  const dailyPlan = resolveDailyPlan(input);
  missingInputs.push(...dailyPlan.missingInputs);
  trace.push(step(7, "daily_plan", dailyPlan.status, PROP_PASS_CALCULATION_VERSION, {
    existingSnapshotId: input.currentDailyPlan?.id ?? null,
  }, {
    snapshotId: dailyPlan.values?.id ?? null,
    riskPerTradeMinor: dailyPlan.values?.riskPerTradeMinor ?? null,
  }));

  const preTrade = input.proposedTradePlan && rooms
    ? assessPreTrade({
      account,
      challengeRules: rules?.challengeRules ?? null,
      liveRules: rules?.liveRules ?? null,
      plan: withPipelineInstrument(input.proposedTradePlan, instrument?.specification ?? null),
      riskRooms: rooms,
      selectedMode: input.selectedMode,
      completedTradesToday: input.journal.completedTrades.length,
      consecutiveLosses: consecutiveLosses(input.journal.completedTrades),
      currentMinuteLocal: tradingDay?.currentMinuteLocal ?? null,
      insideAllowedSession: tradingDay?.insideAllowedSession ?? null,
      killSwitchActive: killSwitch?.values.active ?? true,
      profitLockReached: input.profitLockReached,
    })
    : null;
  if (preTrade) missingInputs.push(...preTrade.missingInputs);
  trace.push(step(8, "pre_trade", preTrade?.status ?? "needs_input", PROP_PASS_CALCULATION_VERSION, {
    plannedContracts: input.proposedTradePlan?.contracts ?? null,
  }, { plannedRiskMinor: preTrade?.values.totalPlannedRiskMinor ?? null }));

  const contractSize = input.proposedTradePlan
    ? calculatePositionSize({
      plan: withPipelineInstrument(input.proposedTradePlan, instrument?.specification ?? null),
      allowedRiskMinor: allowedRisk.values.allowedRiskMinor,
      propMaximumContracts: rules?.challengeRules?.maximumContracts ?? null,
    })
    : null;
  if (contractSize) missingInputs.push(...contractSize.missingInputs);
  trace.push(step(9, "contract_size", contractSize?.status ?? "needs_input", instrument?.specificationVersion ?? null, {
    allowedRiskMinor: allowedRisk.values.allowedRiskMinor,
  }, { recommendedContracts: contractSize?.values.recommendedContracts ?? null }, [
    "contracts = floor(allowed risk ÷ total loss per contract)",
  ], ["Contract count always rounds down."]));

  const plan = dailyPlan.values;
  const interventions = assessSmartInterventions({
    plan,
    completedTrades: [...input.journal.completedTrades],
    proposed: input.proposedInterventionTrade,
    selectedMode: input.selectedMode,
    safeBufferMinor: allowedRisk.values.safeBudgetMinor,
    insideAllowedSession: tradingDay?.insideAllowedSession ?? null,
    profitLockReached: input.profitLockReached,
    killSwitchActive: killSwitch?.values.active ?? true,
    recoveryModeActive: liveLifecycle?.values.recovery?.active ?? false,
    weeklyLossRemainingMinor: rooms?.weeklyLossRemainingMinor,
  });
  trace.push(step(10, "smart_intervention", interventions.some((item) => item.blocking) ? "stop_trading" : interventions.length ? "risky" : "safe_to_take", PROP_PASS_CALCULATION_VERSION, {
    completedTrades: input.journal.completedTrades.length,
  }, { interventionCount: interventions.length }));

  const duplicateTradeIds = duplicates(input.journal.appliedTradeIds);
  const journalApplication = {
    appliedTradeIds: [...new Set(input.journal.appliedTradeIds)].sort(),
    duplicateTradeIds,
    latestTradeId: input.journal.latestReplayTrade?.id ?? null,
    persistenceRequired: duplicateTradeIds.length === 0,
  } as const;
  if (duplicateTradeIds.length) missingInputs.push("duplicate_journal_trade_application");
  trace.push(step(11, "journal_application", duplicateTradeIds.length ? "needs_input" : "safe_to_take", PROP_PASS_CALCULATION_VERSION, {
    receivedTradeIds: input.journal.appliedTradeIds.length,
  }, { uniqueTradeIds: journalApplication.appliedTradeIds.length }));

  const decisionReplay = createDecisionReplay({ plan, trade: input.journal.latestReplayTrade });
  trace.push(step(12, "decision_replay", decisionReplay.verdict === "insufficient_data" ? "needs_input" : "safe_to_take", PROP_PASS_CALCULATION_VERSION, {
    tradeId: input.journal.latestReplayTrade?.id ?? null,
  }, { verdict: decisionReplay.verdict }));

  const challengeLifecycle = account?.contextType === "challenge" && rooms && input.challengeFacts
    ? evaluateChallengeLifecycle({ ...input.challengeFacts, account, rules: rules?.challengeRules ?? null, riskRooms: rooms, appliedJournalTradeIds: journalApplication.appliedTradeIds })
    : null;
  if (account?.contextType === "challenge" && !input.challengeFacts) missingInputs.push("challenge_lifecycle_facts");
  if (account?.contextType === "live" && !input.liveFacts) missingInputs.push("live_lifecycle_facts");
  const timeline = buildChallengeTimeline(input.journal.persistedTimelineFacts);
  const lifecycleStatus = challengeLifecycle?.status ?? liveLifecycle?.status ?? "needs_input";
  trace.push(step(13, "account_lifecycle", lifecycleStatus, rules?.versionId ?? null, {
    context: account?.contextType ?? null,
  }, {
    lifecycle: challengeLifecycle?.values.state ?? liveLifecycle?.values.state ?? null,
    timelineEvents: timeline.length,
  }));

  const riskMeter = calculateLiveRiskMeter({
    dailyRiskBudgetMinor: dailyPlan.values?.maximumRiskTodayMinor ?? rooms?.configuredDailyRiskBudgetMinor ?? null,
    dailyRiskUsedMinor: input.journal.dailyRiskUsedMinor,
    hardStopActive: killSwitch?.values.active ?? true,
    previousStatus: input.previousRiskHealth,
  });
  const payoutReadiness = input.payout ? calculatePayoutReadiness(input.payout) : null;
  const withdrawalReadiness = input.withdrawal ? calculateMaximumSafeWithdrawal(input.withdrawal) : null;
  const statuses: DecisionStatus[] = [allowedRisk.status, dailyPlan.status, riskMeter.status, lifecycleStatus];
  if (preTrade) statuses.push(preTrade.status);
  if (contractSize) statuses.push(contractSize.status);
  if (killSwitch) statuses.push(killSwitch.status);
  if (interventions.some((item) => item.blocking)) statuses.push("stop_trading");
  if (missingInputs.length) statuses.push("needs_input");

  return Object.freeze({
    calculationVersion: PROP_PASS_CALCULATION_VERSION,
    status: highestStatus(statuses),
    hardRiskRooms: rooms,
    allowedRisk,
    dailyPlan,
    riskMeter,
    preTrade,
    contractSize,
    interventions,
    journalApplication,
    decisionReplay,
    timeline,
    challengeLifecycle,
    liveLifecycle,
    payoutReadiness,
    withdrawalReadiness,
    missingInputs: [...new Set(missingInputs)],
    calculationTrace: trace,
  });
}

function resolveDailyPlan(input: PropPassCalculationPipelineInput) {
  if (input.currentDailyPlan) return ok(input.currentDailyPlan);
  if (!input.dailyPlanDraft || !input.riskRooms) return missingDailyPlan();
  return createDailyTradingPlan({
    ...input.dailyPlanDraft,
    account: input.account,
    challengeRules: input.activeRules?.challengeRules ?? null,
    liveRules: input.activeRules?.liveRules ?? null,
    riskRooms: input.riskRooms,
    selectedMode: input.selectedMode,
    instrumentSpecificationVersion: input.instrument?.specificationVersion ?? null,
  });
}

function withPipelineInstrument(plan: PropPassCalculationPipelineInput["proposedTradePlan"], instrument: InstrumentSpec | null) {
  if (!plan) throw new Error("Trade plan is required");
  return { ...plan, instrument };
}

function completeAllowedRisk(value: ReturnType<typeof calculateAllowedRisk>): TradingOsResult<AllowedRiskValues> {
  const blocked = value.appliedHardLimits.some((limit) => limit.blocksTrading);
  return { ...value, status: blocked ? "stop_trading" : "safe_to_take", reasons: blocked ? ["hard_risk_room_unavailable"] : [], missingInputs: [], relatedRuleIds: [] };
}

function emptyAllowedRisk(): TradingOsResult<AllowedRiskValues> {
  return { values: { safeBudgetMinor: null, modeSuggestedRiskMinor: null, allowedRiskMinor: 0 }, status: "needs_input", reasons: ["hard_risk_inputs_missing"], missingInputs: ["risk_rooms_or_rules"], appliedHardLimits: [], relatedRuleIds: [] };
}

function ok<T>(values: T): TradingOsResult<T> { return { values, status: "safe_to_take", reasons: [], missingInputs: [], appliedHardLimits: [], relatedRuleIds: [] }; }
function missingDailyPlan() { return { ...ok(null), status: "needs_input" as const, reasons: ["daily_plan_missing"], missingInputs: ["daily_plan_snapshot_or_draft"] }; }
function highestStatus(statuses: DecisionStatus[]): DecisionStatus { return statuses.reduce((current, next) => STATUS_PRIORITY[next] > STATUS_PRIORITY[current] ? next : current, "safe_to_take"); }
function consecutiveLosses(trades: PropPassCalculationPipelineInput["journal"]["completedTrades"]): number { let count = 0; for (const trade of [...trades].reverse()) { if (trade.realizedPnlMinor >= 0) break; count += 1; } return count; }
function duplicates(values: string[]): string[] { const seen = new Set<string>(); const found = new Set<string>(); for (const value of values) { if (seen.has(value)) found.add(value); seen.add(value); } return [...found].sort(); }
function step(order: number, stage: PropPassCalculationTraceStep["stage"], status: DecisionStatus, sourceVersion: string | null, inputs: PropPassCalculationTraceStep["inputs"], outputs: PropPassCalculationTraceStep["outputs"], arithmetic: string[] = [], rounding: string[] = []): PropPassCalculationTraceStep { return Object.freeze({ order, stage, status, sourceVersion, inputs: Object.freeze(inputs), outputs: Object.freeze(outputs), arithmetic, rounding }); }
