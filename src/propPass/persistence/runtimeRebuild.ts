import { calculateChallenge } from "../../propOs/engine";
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
  type PropPassCalculationPipelineOutput,
  type RiskRooms,
  type TradingRiskMode,
} from "../tradingOs/index";

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
  killSwitchConfiguration: KillSwitchConfiguration | null;
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
  const context = challenge.phase === "funded" ? "live" : "challenge";
  const dailyRoom = engine.buffers.find((buffer) => buffer.id === "daily_loss")?.remainingMinor ?? null;
  const drawdownRoom = engine.buffers.find((buffer) => buffer.id === "drawdown")?.remainingMinor ?? null;
  const hardRoom = drawdownRoom;
  const rules = mapChallengeRules(legacyRules, bundle.ruleSnapshotRow.captured_at);
  const riskRooms: RiskRooms = {
    dailyLossRemainingMinor: dailyRoom,
    maximumLossRemainingMinor: hardRoom,
    drawdownRemainingMinor: drawdownRoom,
    configuredDailyRiskBudgetMinor: minimumKnown([dailyRoom, hardRoom]),
    configuredPerTradeRiskCapMinor: minimumKnown([dailyRoom, hardRoom]),
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
  const killSwitch = buildKillSwitchInput(bundle.killSwitchConfiguration, bundle.executions, engine.accountState.dayPnlMinor);
  const currentEquity = engine.accountState.equityMinor;
  const output = calculatePropPassState({
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
      liveRules: null,
    },
    instrument: null,
    tradingDay: null,
    riskRooms,
    selectedMode: bundle.selectedMode ?? "balanced",
    // Personal limits are opt-in. An absent row means no personal thresholds,
    // not permission to bypass the immutable account loss rooms.
    killSwitch,
    journal: {
      appliedTradeIds: applied,
      // Planned risk is not present in prop_executions. Do not substitute P&L.
      completedTrades: [],
      dailyRiskUsedMinor: Math.max(0, -(engine.accountState.dayPnlMinor ?? 0)),
      latestReplayTrade: latest
        ? {
            id: latest.trade_client_id!,
            riskMinor: null,
            realizedPnlMinor: latest.realized_pnl_minor,
            sequenceToday: null,
            ruleViolationId: breach?.tradeId === latest.id ? breach.ruleId : null,
            dailyBufferAfterMinor: dailyRoom,
          }
        : null,
      persistedTimelineFacts: bundle.persistedTimelineFacts,
    },
    currentDailyPlan: bundle.currentDailyPlan,
    dailyPlanDraft: bundle.currentDailyPlan
      ? null
      : {
          snapshotId: `daily-plan:${account.id}:${engine.accountState.tradingDayId}`,
          generatedAt: bundle.asOfUtc,
          preferredInstrument: null,
          intendedSessionId: null,
          recentLossStreak: 0,
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
    liveFacts: null,
    payout: null,
    withdrawal: null,
    scaling: null,
    progression: null,
    profitProtection: null,
    preservation: null,
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

export const PROP_PASS_RUNTIME_CALCULATION_VERSION = PROP_PASS_CALCULATION_VERSION;

function buildKillSwitchInput(
  configuration: KillSwitchConfiguration | null,
  executions: ExecutionRow[],
  dayPnlMinor: number,
): KillSwitchInput {
  const active = executions.filter((row) => !row.voided && row.realized_pnl_minor != null).sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
  let lossStreak = 0;
  for (const row of [...active].reverse()) { if ((row.realized_pnl_minor ?? 0) >= 0) break; lossStreak += 1; }
  return {
    configuration: configuration ?? {
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
    manualSessionLockRequested: false,
    manualSessionLockConfirmed: false,
  };
}
