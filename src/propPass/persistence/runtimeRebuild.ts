import { calculateChallenge } from "../../propOs/engine";
import { tradingDayId } from "../../propOs/tradingDay";
import {
  mapAccountRow,
  mapChallengeRow,
  mapDomainEvents,
  mapRuleSnapshotRow,
} from "../../propOs/shadow/mappers";
import type {
  AccountEventRow,
  AccountRow,
  ChallengeRow,
  ExecutionRow,
  RuleSnapshotRow,
} from "../../propOs/shadow/types";
import type { DailyTradingPlanSnapshot, PersistedTimelineFact } from "../tradingOs/index";
import {
  PROP_PASS_CALCULATION_VERSION,
  calculatePropPassState,
  type ChallengeBreachFact,
  type ChallengeRules,
  type KillSwitchConfiguration,
  type KillSwitchInput,
  type PayoutReadinessInput,
  type PositionSizeProgressionInput,
  type PropPassCalculationPipelineOutput,
  type RiskRooms,
  type SafeWithdrawalInput,
  type ScalingRecommendationInput,
  type TradingRiskMode,
} from "../tradingOs/index";
import {
  evaluateCapitalPreservationEvidence,
  preservationInputFromEvaluation,
  type CapitalPreservationEvaluation,
  type PersistedTradeRiskFact,
} from "../tradingOs/preservationEvidence";
import type { PropPassKillSwitchSettings, PropPassLiveRiskSettings, PropPassRecoveryState } from "./contracts";

export type PropPassRuntimeRebuildBundle = Readonly<{
  accountRow: AccountRow;
  challengeRow: ChallengeRow;
  ruleSnapshotRow: RuleSnapshotRow;
  executions: ExecutionRow[];
  accountEvents: AccountEventRow[];
  asOfUtc: string;
  selectedMode: TradingRiskMode | null;
  currentDailyPlan: DailyTradingPlanSnapshot | null;
  persistedTimelineFacts: PersistedTimelineFact[];
  killSwitchSettings: PropPassKillSwitchSettings | null;
  liveRiskSettings: PropPassLiveRiskSettings | null;
  recoveryState: PropPassRecoveryState | null;
  /** Explicit planned/actual risk facts; never inferred from realized P&L. */
  tradeRiskFacts?: readonly PersistedTradeRiskFact[];
}>;

export type PropPassRuntimeRebuildResult = Readonly<{
  lifecycleStatus: string;
  ruleVersion: string;
  instrumentVersion: string | null;
  output: PropPassCalculationPipelineOutput;
}>;

/**
 * Trusted runtime rebuild from canonical persisted facts. This adapter never
 * invents trade risk, session state, instrument costs, or editable rules.
 * Missing facts intentionally keep the calculation in needs_input/Stop state.
 */
export function rebuildPropPassRuntime(
  bundle: PropPassRuntimeRebuildBundle,
): PropPassRuntimeRebuildResult {
  const account = mapAccountRow(bundle.accountRow);
  const legacyRules = mapRuleSnapshotRow(bundle.ruleSnapshotRow);
  const challenge = mapChallengeRow(bundle.challengeRow, legacyRules);
  const events = mapDomainEvents(bundle.executions, bundle.accountEvents);
  const engine = calculateChallenge({ challenge, events, asOfUtc: bundle.asOfUtc });
  const context: "challenge" | "live" = challenge.phase === "funded" ? "live" : "challenge";
  const challengeDailyRoom = engine.buffers.find((buffer) => buffer.id === "daily_loss")?.remainingMinor ?? null;
  const challengeDrawdownRoom = engine.buffers.find((buffer) => buffer.id === "drawdown")?.remainingMinor ?? null;
  const liveMetrics = context === "live"
    ? calculateLiveMetrics(bundle, legacyRules, engine.accountState.tradingDayId, engine.accountState.hwmMinor - engine.accountState.equityMinor)
    : null;
  const dailyRoom = liveMetrics?.dailyRoomMinor ?? challengeDailyRoom;
  const drawdownRoom = liveMetrics?.drawdownRoomMinor ?? challengeDrawdownRoom;
  const hardRoom = drawdownRoom;
  const rules = mapChallengeRules(legacyRules, bundle.ruleSnapshotRow.captured_at);
  const riskRooms: RiskRooms = {
    dailyLossRemainingMinor: dailyRoom,
    maximumLossRemainingMinor: hardRoom,
    drawdownRemainingMinor: drawdownRoom,
    configuredDailyRiskBudgetMinor: context === "live"
      ? bundle.liveRiskSettings?.rules.dailyRiskBudgetMinor ?? null
      : minimumKnown([dailyRoom, hardRoom]),
    configuredPerTradeRiskCapMinor: context === "live"
      ? bundle.liveRiskSettings?.rules.perTradeRiskCapMinor ?? null
      : minimumKnown([dailyRoom, hardRoom]),
    weeklyLossRemainingMinor: liveMetrics?.weeklyRoomMinor,
  };
  const applied = bundle.executions
    .filter((row) => !row.voided && row.challenge_id === challenge.id && row.trade_client_id)
    .map((row) => row.trade_client_id!)
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort();
  const latest = [...bundle.executions]
    .filter((row) => !row.voided && row.challenge_id === challenge.id && row.trade_client_id)
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))[0] ?? null;
  const breach = mapBreach(engine, riskRooms);
  const killSwitch = buildKillSwitchInput(bundle.killSwitchSettings, bundle.executions, engine.accountState.dayPnlMinor, bundle.asOfUtc);
  const currentEquity = engine.accountState.equityMinor;
  const dailyRiskUsedMinor = Math.max(0, -(engine.accountState.dayPnlMinor ?? 0));
  const ownedActiveExecutions = bundle.executions
    .filter((row) => !row.voided && row.user_id === account.userId && row.account_id === account.id)
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id ?? account.id,
      tradeClientId: row.trade_client_id,
      contracts: row.contracts,
      occurredAt: row.occurred_at,
    }));
  const ownedTradeRiskFacts = (bundle.tradeRiskFacts ?? []).filter(
    (fact) => !fact.voided && fact.userId === account.userId && fact.accountId === account.id,
  );
  const pipelineInputBase = {
    account: {
      contextType: context,
      accountId: account.id,
      startingBalanceMinor: challenge.startingBalanceMinor,
      currentBalanceMinor: currentEquity,
      currentEquityMinor: currentEquity,
      equityHighMinor: engine.accountState.hwmMinor,
      realizedPnlMinor: currentEquity - challenge.startingBalanceMinor,
      tradingDay: engine.accountState.tradingDayId,
      timezone: account.timezone,
    },
    accountContext: context,
    activeRules: {
      versionId: legacyRules.version,
      effectiveAt: bundle.ruleSnapshotRow.captured_at,
      challengeRules: context === "challenge" ? rules : null,
      // Funded accounts require an explicit Live rule payload. A challenge
      // snapshot is never silently reinterpreted as Live risk configuration.
      liveRules: context === "live" ? bundle.liveRiskSettings?.rules ?? null : null,
    },
    instrument: null,
    tradingDay: null,
    riskRooms,
    selectedMode: bundle.liveRiskSettings?.selectedMode ?? bundle.selectedMode ?? "balanced" as const,
    // Personal limits are opt-in. An absent row means no personal thresholds,
    // not permission to bypass the immutable account hard rooms.
    killSwitch,
    journal: {
      appliedTradeIds: applied,
      // Planned risk is not present in prop_executions. Do not substitute P&L.
      completedTrades: ownedTradeRiskFacts
        .filter((fact) => fact.actualRiskMinor != null)
        .map((fact) => ({
          id: fact.tradeClientId,
          occurredAt: fact.occurredAt,
          realizedPnlMinor: 0,
          riskMinor: fact.actualRiskMinor!,
          contracts: fact.contracts ?? 1,
          sessionId: fact.sessionId,
        })),
      dailyRiskUsedMinor,
      latestReplayTrade: latest
        ? {
            id: latest.trade_client_id!,
            riskMinor: ownedTradeRiskFacts.find((fact) => fact.tradeClientId === latest.trade_client_id)?.actualRiskMinor ?? null,
            realizedPnlMinor: latest.realized_pnl_minor,
            sequenceToday: null,
            ruleViolationId: breach?.tradeId === latest.trade_client_id ? breach.ruleId : null,
            dailyBufferAfterMinor: dailyRoom,
          }
        : null,
      persistedTimelineFacts: bundle.persistedTimelineFacts.filter((fact) => fact.accountId === account.id),
    },
    currentDailyPlan: bundle.currentDailyPlan,
    dailyPlanDraft: bundle.currentDailyPlan
      ? null
      : {
          snapshotId: `daily-plan:${account.id}:${engine.accountState.tradingDayId}`,
          generatedAt: bundle.asOfUtc,
          preferredInstrument: null,
          intendedSessionId: null,
          recentLossStreak: killSwitch.consecutiveLosses ?? 0,
        },
    proposedTradePlan: null,
    proposedInterventionTrade: null,
    profitLockReached: false,
    challengeFacts: context === "challenge"
      ? {
          completedTradingDays: engine.tradingStats.daysTraded,
          consistencyPassed: rules.consistencyRule ? null : true,
          breach,
          fundedAt: challenge.status === "funded" ? challenge.endedAtUtc ?? bundle.asOfUtc : null,
          archivedAt: account.status === "archived" ? bundle.asOfUtc : null,
        }
      : null,
    // Optional advanced inputs stay null until real facts exist — never invent
    // reserves, peaks, compliance scores, or scaling criteria.
    payout: null,
    withdrawal: null,
    scaling: null,
    progression: null,
    profitProtection: null,
    compliance: null,
    breachReplay: breach
      ? {
          tradeId: breach.tradeId,
          occurredAt: breach.occurredAt,
          ruleId: breach.ruleId,
          ruleValueMinor: null,
          accountValueBeforeMinor: null,
          accountValueAfterMinor: null,
          plannedRiskMinor: breach.plannedRiskMinor,
          actualRiskMinor: breach.actualRiskMinor,
          bufferBeforeMinor: breach.bufferBeforeMinor,
          actualContracts: null,
          recommendedContracts: null,
        }
      : null,
  };
  const draftOutput = calculatePropPassState({
    ...pipelineInputBase,
    liveFacts: context === "live" && bundle.liveRiskSettings
      ? {
          normalRiskPerTradeMinor: bundle.liveRiskSettings.normalRiskPerTradeMinor ?? null,
          normalMaximumContracts: bundle.liveRiskSettings.normalMaximumContracts ?? null,
          recoveryRiskBps: bundle.liveRiskSettings.recoveryRiskBps ?? null,
          minimumCompliantProfitableSessions: bundle.liveRiskSettings.minimumCompliantProfitableSessions ?? null,
          completedCompliantProfitableSessions: bundle.recoveryState?.state.exitProgress?.completedCompliantProfitableSessions ?? null,
          // Empty until evidence evaluation finishes — never fabricate.
          preservation: { components: {} },
        }
      : null,
    preservation: null,
  });
  const weeklyLimit = bundle.liveRiskSettings?.rules.weeklyLossLimitMinor ?? null;
  const weeklyRemaining = riskRooms.weeklyLossRemainingMinor;
  const weeklyUsed = weeklyLimit != null && weeklyRemaining != null
    ? Math.max(0, weeklyLimit - weeklyRemaining)
    : null;
  const preservationEvaluation = evaluateCapitalPreservationEvidence({
    userId: account.userId,
    accountId: account.id,
    context,
    tradingDayId: engine.accountState.tradingDayId,
    currentEquityMinor: currentEquity,
    equityHighMinor: engine.accountState.hwmMinor,
    maximumDrawdownMinor: context === "live"
      ? bundle.liveRiskSettings?.rules.maximumDrawdownMinor ?? null
      : legacyRules.drawdown.amountMinor,
    dailyRiskBudgetMinor: context === "live"
      ? bundle.liveRiskSettings?.rules.dailyRiskBudgetMinor ?? null
      : riskRooms.configuredDailyRiskBudgetMinor ?? null,
    dailyRiskUsedMinor,
    weeklyLossLimitMinor: weeklyLimit,
    weeklyLossUsedMinor: weeklyUsed,
    riskRooms,
    dailyPlan: draftOutput.dailyPlan.values,
    killSwitch,
    recovery: context === "live" ? bundle.recoveryState?.state ?? draftOutput.liveLifecycle?.values.recovery ?? null : null,
    breach,
    activeExecutions: ownedActiveExecutions,
    tradeRiskFacts: ownedTradeRiskFacts,
    timelineFacts: bundle.persistedTimelineFacts.filter((fact) => fact.accountId === account.id),
    maximumContracts: context === "live"
      ? bundle.liveRiskSettings?.normalMaximumContracts ?? null
      : rules.maximumContracts ?? legacyRules.maxContracts ?? null,
    consecutiveLossLimit: context === "live"
      ? bundle.liveRiskSettings?.rules.consecutiveLossLimit
        ?? bundle.killSwitchSettings?.configuration.consecutiveLossLimit
        ?? null
      : rules.stopAfterLosses
        ?? bundle.killSwitchSettings?.configuration.consecutiveLossLimit
        ?? draftOutput.dailyPlan.values?.stopAfterLosses
        ?? null,
  });
  const preservationComponents = preservationInputFromEvaluation(preservationEvaluation);
  const snapshotExtras = readSnapshotExtras(bundle.ruleSnapshotRow.snapshot);
  const enrichedOptionalInputs = buildOptionalPipelineInputs({
    context,
    currentEquity,
    startingBalanceMinor: challenge.startingBalanceMinor,
    equityHighMinor: engine.accountState.hwmMinor,
    realizedPnlMinor: currentEquity - challenge.startingBalanceMinor,
    completedTradingDays: engine.tradingStats.daysTraded,
    rules,
    snapshotExtras,
    riskRooms,
    liveRiskSettings: bundle.liveRiskSettings,
    recoveryState: bundle.recoveryState,
    draftOutput,
    asOfUtc: bundle.asOfUtc,
    priorPayoutsMinor: sumRecordedPayouts(
      bundle.persistedTimelineFacts.filter((fact) => fact.accountId === account.id),
    ),
  });
  const outputBase = calculatePropPassState({
    ...pipelineInputBase,
    ...enrichedOptionalInputs,
    liveFacts: context === "live" && bundle.liveRiskSettings
      ? {
          normalRiskPerTradeMinor: bundle.liveRiskSettings.normalRiskPerTradeMinor ?? null,
          normalMaximumContracts: bundle.liveRiskSettings.normalMaximumContracts ?? null,
          recoveryRiskBps: bundle.liveRiskSettings.recoveryRiskBps ?? null,
          minimumCompliantProfitableSessions: bundle.liveRiskSettings.minimumCompliantProfitableSessions ?? null,
          completedCompliantProfitableSessions: bundle.recoveryState?.state.exitProgress?.completedCompliantProfitableSessions ?? null,
          preservation: preservationComponents,
        }
      : null,
    preservation: preservationComponents,
  });
  const output: PropPassCalculationPipelineOutput = Object.freeze({
    ...outputBase,
    capitalPreservation: preservationEvaluation,
  });
  return {
    lifecycleStatus: context === "challenge"
      ? output.challengeLifecycle?.values.state ?? engine.status
      : output.liveLifecycle?.values.state ?? "needs_input",
    ruleVersion: legacyRules.version,
    instrumentVersion: null,
    output,
  };
}

export type { CapitalPreservationEvaluation };

function mapChallengeRules(
  rules: ReturnType<typeof mapRuleSnapshotRow>,
  capturedAt: string,
): ChallengeRules {
  return {
    id: rules.version,
    effectiveDate: capturedAt,
    templateVersion: rules.version,
    profitTargetMinor: rules.profitTargetMinor,
    dailyLossLimitMinor: rules.dailyLossLimitMinor,
    maximumLossLimitMinor: rules.drawdown.amountMinor,
    drawdownType: rules.drawdown.kind === "static" ? "static" : "trailing",
    drawdownCalculation: rules.drawdown.kind === "trailingEndOfDay" ? "end_of_day" : "intraday",
    minimumTradingDays: rules.minimumTradingDays,
    maximumContracts: rules.maxContracts,
  };
}

function mapBreach(
  engine: ReturnType<typeof calculateChallenge>,
  rooms: RiskRooms,
): ChallengeBreachFact | null {
  const fact = engine.breachReasons[0];
  if (!fact) return null;
  const room = fact.code === "daily_loss" ? rooms.dailyLossRemainingMinor : rooms.drawdownRemainingMinor;
  return {
    ruleId: fact.code,
    tradeId: fact.tradeId ?? null,
    occurredAt: fact.at,
    plannedRiskMinor: null,
    actualRiskMinor: null,
    bufferBeforeMinor: null,
    bufferAfterMinor: room,
  };
}

function minimumKnown(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => Number.isSafeInteger(value));
  return present.length ? Math.max(0, Math.min(...present)) : null;
}

function calculateLiveMetrics(
  bundle: PropPassRuntimeRebuildBundle,
  legacyRules: ReturnType<typeof mapRuleSnapshotRow>,
  currentTradingDay: string,
  currentDrawdownMinor: number,
): { dailyRoomMinor: number | null; weeklyRoomMinor: number | null; drawdownRoomMinor: number | null } {
  const rules = bundle.liveRiskSettings?.rules;
  if (!rules) return { dailyRoomMinor: null, weeklyRoomMinor: null, drawdownRoomMinor: null };
  const active = bundle.executions.filter((row) => !row.voided && row.realized_pnl_minor != null);
  const dayPnl = active
    .filter((row) => tradingDayId(row.occurred_at, legacyRules.firmTimezone, legacyRules.tradingDayRolloverHour) === currentTradingDay)
    .reduce((sum, row) => sum + (row.realized_pnl_minor ?? 0) - (row.fees_minor ?? 0), 0);
  const dailyRoomMinor = rules.dailyRiskBudgetMinor == null
    ? null
    : Math.max(0, rules.dailyRiskBudgetMinor - Math.max(0, -dayPnl));
  const drawdownRoomMinor = rules.maximumDrawdownMinor == null
    ? null
    : Math.max(0, rules.maximumDrawdownMinor - Math.max(0, currentDrawdownMinor));
  const weekStartsOn = bundle.liveRiskSettings?.weekStartsOn;
  let weeklyRoomMinor: number | null = null;
  if (rules.weeklyLossLimitMinor != null && weekStartsOn != null) {
    const weekStart = startOfWeek(currentTradingDay, weekStartsOn);
    const weeklyPnl = active.filter((row) => {
      const day = tradingDayId(row.occurred_at, legacyRules.firmTimezone, legacyRules.tradingDayRolloverHour);
      return day >= weekStart && day <= currentTradingDay;
    }).reduce((sum, row) => sum + (row.realized_pnl_minor ?? 0) - (row.fees_minor ?? 0), 0);
    weeklyRoomMinor = Math.max(0, rules.weeklyLossLimitMinor - Math.max(0, -weeklyPnl));
  }
  return { dailyRoomMinor, weeklyRoomMinor, drawdownRoomMinor };
}

function startOfWeek(day: string, weekStartsOn: 0 | 1): string {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date, 12));
  const delta = (value.getUTCDay() - weekStartsOn + 7) % 7;
  value.setUTCDate(value.getUTCDate() - delta);
  return value.toISOString().slice(0, 10);
}

export const PROP_PASS_RUNTIME_CALCULATION_VERSION = PROP_PASS_CALCULATION_VERSION;

type SnapshotExtras = Readonly<{
  payoutThresholdMinor: number | null;
  postPayoutReserveMinor: number | null;
  consistencyPassed: boolean | null;
}>;

function readSnapshotExtras(snapshot: unknown): SnapshotExtras {
  const snap = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
  const payoutThresholdMinor = typeof snap.payoutThresholdMinor === "number" && Number.isSafeInteger(snap.payoutThresholdMinor)
    ? snap.payoutThresholdMinor
    : null;
  const postPayoutReserveMinor = typeof snap.postPayoutReserveMinor === "number" && Number.isSafeInteger(snap.postPayoutReserveMinor)
    ? snap.postPayoutReserveMinor
    : null;
  const consistencyRule = snap.consistencyRule;
  const consistencyPassed = consistencyRule == null
    ? true
    : null;
  return { payoutThresholdMinor, postPayoutReserveMinor, consistencyPassed };
}

function sumRecordedPayouts(facts: readonly PersistedTimelineFact[]): number {
  return facts
    .filter((fact) => fact.type === "first_payout" || fact.type === "additional_payout")
    .reduce((sum, fact) => sum + (fact.valueMinor ?? 0), 0);
}

function buildOptionalPipelineInputs(input: {
  context: "challenge" | "live";
  currentEquity: number;
  startingBalanceMinor: number;
  equityHighMinor: number;
  realizedPnlMinor: number;
  completedTradingDays: number;
  rules: ChallengeRules;
  snapshotExtras: SnapshotExtras;
  riskRooms: RiskRooms;
  liveRiskSettings: PropPassLiveRiskSettings | null;
  recoveryState: PropPassRecoveryState | null;
  draftOutput: PropPassCalculationPipelineOutput;
  asOfUtc: string;
  priorPayoutsMinor: number;
}): {
  payout: PayoutReadinessInput | null;
  withdrawal: SafeWithdrawalInput | null;
  scaling: ScalingRecommendationInput | null;
  progression: PositionSizeProgressionInput | null;
  profitProtection: null;
  compliance: null;
} {
  const liveRules = input.liveRiskSettings?.rules;
  const recoveryActive = Boolean(
    input.draftOutput.liveLifecycle?.values.recovery?.active
    ?? input.recoveryState?.state.active,
  );
  const killActive = Boolean(input.draftOutput.killSwitch?.values.active);
  const allowedContracts = input.context === "live"
    ? input.liveRiskSettings?.normalMaximumContracts ?? null
    : input.rules.maximumContracts ?? null;
  const allowedRiskPerTradeMinor = input.context === "live"
    ? input.liveRiskSettings?.normalRiskPerTradeMinor ?? null
    : input.riskRooms.configuredPerTradeRiskCapMinor ?? null;
  const preservationScore = input.draftOutput.liveLifecycle?.values.preservation?.score ?? null;
  const currentDrawdownBps = input.equityHighMinor > 0
    ? Math.max(0, Math.floor(((input.equityHighMinor - input.currentEquity) * 10_000) / input.equityHighMinor))
    : null;
  const scaling: ScalingRecommendationInput | null = input.context === "live" && input.liveRiskSettings
    ? {
        currentRiskPerTradeMinor: input.liveRiskSettings.normalRiskPerTradeMinor ?? null,
        currentContracts: input.liveRiskSettings.normalMaximumContracts ?? null,
        maximumAllowedRiskPerTradeMinor: liveRules?.perTradeRiskCapMinor ?? null,
        maximumAllowedContracts: input.liveRiskSettings.normalMaximumContracts ?? null,
        userMaximumRiskPerTradeMinor: liveRules?.perTradeRiskCapMinor ?? null,
        // Risk step is user-configured; withhold until persisted.
        riskStepMinor: null,
        requiresNewEquityHigh: input.rules.scalingRule?.requiresNewEquityHigh ?? null,
        atNewEquityHigh: input.currentEquity >= input.equityHighMinor,
        minimumProfitableSessions: input.liveRiskSettings.minimumCompliantProfitableSessions
          ?? input.rules.scalingRule?.minimumProfitableSessions
          ?? null,
        completedCompliantProfitableSessions:
          input.recoveryState?.state.exitProgress?.completedCompliantProfitableSessions ?? null,
        currentDrawdownBps,
        maximumAcceptableDrawdownBps: liveRules?.recoveryModeThresholdBps ?? null,
        capitalPreservationScore: preservationScore,
        // Do not invent a minimum preservation gate.
        minimumPreservationScore: null,
        stablePositionSizing: null,
        recoveryModeActive: recoveryActive,
        killSwitchActive: killActive,
        weeklyRiskRoomPositive: input.riskRooms.weeklyLossRemainingMinor == null
          ? null
          : input.riskRooms.weeklyLossRemainingMinor > 0,
      }
    : null;

  const progression: PositionSizeProgressionInput | null =
    allowedContracts != null && allowedRiskPerTradeMinor != null
      ? {
          previousStage: null,
          allowedContracts,
          allowedRiskPerTradeMinor,
          recoveryModeActive: recoveryActive,
          killSwitchActive: killActive,
          reducedRiskRequired: recoveryActive,
          scalingEligible: false,
          scaleAlreadyApplied: false,
          occurredAt: input.asOfUtc,
          relatedRuleId: input.context === "live"
            ? input.liveRiskSettings?.rules.id ?? null
            : input.rules.id,
        }
      : null;

  const drawdownAmount = input.context === "live"
    ? liveRules?.maximumDrawdownMinor ?? null
    : input.rules.maximumLossLimitMinor ?? null;
  const staticFloor = drawdownAmount == null
    ? null
    : Math.max(0, input.startingBalanceMinor - drawdownAmount);
  const trailingFloor = drawdownAmount == null
    ? null
    : Math.max(0, input.equityHighMinor - drawdownAmount);

  const payout: PayoutReadinessInput | null = input.context === "challenge"
    ? {
        currentEquityMinor: input.currentEquity,
        startingBalanceMinor: input.startingBalanceMinor,
        eligibleProfitMinor: Math.max(0, input.realizedPnlMinor),
        completedTradingDays: input.completedTradingDays,
        minimumTradingDays: input.rules.minimumTradingDays ?? null,
        consistencyPassed: input.snapshotExtras.consistencyPassed,
        payoutThresholdMinor: input.snapshotExtras.payoutThresholdMinor,
        maximumLossFloorMinor: staticFloor,
        trailingDrawdownFloorMinor: trailingFloor,
        postPayoutReserveMinor: input.snapshotExtras.postPayoutReserveMinor,
      }
    : null;

  const withdrawal: SafeWithdrawalInput | null = input.context === "live" && liveRules
    ? {
        currentEquityMinor: input.currentEquity,
        equityHighMinor: input.equityHighMinor,
        realizedEligibleProfitMinor: Math.max(0, input.realizedPnlMinor),
        staticLossFloorMinor: staticFloor,
        trailingDrawdownFloorMinor: trailingFloor,
        postWithdrawalReserveMinor: liveRules.postWithdrawalReserveMinor ?? null,
        dailyRiskReserveMinor: liveRules.dailyRiskBudgetMinor ?? null,
        weeklyRiskReserveMinor: liveRules.weeklyLossLimitMinor ?? null,
        recoverySafetyReserveMinor: liveRules.postWithdrawalReserveMinor ?? null,
        recoveryModeActive: recoveryActive,
        priorWithdrawalsMinor: input.priorPayoutsMinor,
      }
    : null;

  return {
    payout,
    withdrawal,
    scaling,
    progression,
    // Peaks and lock thresholds are not persisted yet — withhold rather than invent.
    profitProtection: null,
    // Component compliance scores require dedicated persisted behavior facts.
    compliance: null,
  };
}

function buildKillSwitchInput(
  settings: PropPassKillSwitchSettings | null,
  executions: ExecutionRow[],
  dayPnlMinor: number,
  asOfUtc: string,
): KillSwitchInput {
  const active = executions.filter((row) => !row.voided && row.realized_pnl_minor != null).sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
  let lossStreak = 0;
  for (const row of [...active].reverse()) { if ((row.realized_pnl_minor ?? 0) >= 0) break; lossStreak += 1; }
  const lockExpiresAt = settings?.manualSessionLockExpiresAt;
  const lockExpiresAtMs = lockExpiresAt == null ? null : Date.parse(lockExpiresAt);
  const asOfMs = Date.parse(asOfUtc);
  const manualLockActive = Boolean(
    settings?.manualSessionLockConfirmed
    && (
      lockExpiresAtMs == null
      || Number.isNaN(lockExpiresAtMs)
      || Number.isNaN(asOfMs)
      || asOfMs < lockExpiresAtMs
    ),
  );
  return {
    configuration: settings?.configuration ?? {
      maximumDailyLossMinor: null,
      maximumWeeklyLossMinor: null,
      maximumTradeCount: null,
      consecutiveLossLimit: null,
      cutoffMinuteLocal: null,
      stopAfterProfitLock: false,
      resetStrategy: "next_trading_day",
    },
    currentDailyLossMinor: Math.max(0, -dayPnlMinor),
    currentWeeklyLossMinor: null,
    currentTradeCount: active.length,
    consecutiveLosses: lossStreak,
    currentMinuteLocal: null,
    profitLockStopActive: false,
    manualSessionLockRequested: manualLockActive,
    manualSessionLockConfirmed: manualLockActive,
    manualSessionLockReason: manualLockActive ? settings?.manualSessionLockReason ?? null : null,
    manualSessionLockExpiresAt: manualLockActive ? settings?.manualSessionLockExpiresAt ?? null : null,
  };
}
