import type {
  ChallengeTimelineEvent,
  DailyTradingPlanSnapshot,
  DecisionReplay,
  InstrumentSpecificationVersion,
  KillSwitchConfiguration,
  LiveRiskRules,
  PayoutReadinessInput,
  PositionSizeProgressionValues,
  PreTradeValues,
  PropPassCalculationPipelineOutput,
  RecoveryModeValues,
  SafeWithdrawalInput,
  SmartIntervention,
  TradingOsResult,
} from "../tradingOs/index";

export type PropPassPersistenceErrorCode =
  | "forbidden"
  | "invalid_input"
  | "invalid_row"
  | "conflict"
  | "repository_unavailable";

export class PropPassPersistenceError extends Error {
  constructor(public readonly code: PropPassPersistenceErrorCode, message: string) {
    super(message);
    this.name = "PropPassPersistenceError";
  }
}

export type PersistenceVersions = Readonly<{
  calculationVersion: string;
  ruleVersion: string;
  instrumentVersion: string | null;
}>;

export type PersistedDailyPlan = Readonly<{
  id: string;
  accountId: string;
  challengeId: string | null;
  tradingDay: string;
  versions: PersistenceVersions;
  payloadDigest: string;
  payload: DailyTradingPlanSnapshot;
}>;

export type PersistedDecisionReplay = Readonly<{
  id: string;
  accountId: string;
  challengeId: string | null;
  replayKey: string;
  tradeClientId: string;
  tradeRevision: number;
  planSnapshotId: string;
  versions: PersistenceVersions;
  payloadDigest: string;
  payload: DecisionReplay;
}>;

export type PersistedPreTradeAssessment = Readonly<{
  id: string;
  accountId: string;
  challengeId: string | null;
  assessmentKey: string;
  planSnapshotId: string;
  versions: PersistenceVersions;
  payloadDigest: string;
  payload: TradingOsResult<PreTradeValues>;
}>;

export type PersistedInterventionEvent = Readonly<{
  id: string;
  accountId: string;
  challengeId: string | null;
  eventKey: string;
  tradeClientId: string | null;
  ruleId: string | null;
  planSnapshotId: string | null;
  versions: PersistenceVersions;
  payload: SmartIntervention;
}>;

export type PersistedInterventionOverride = Readonly<{
  id: string;
  accountId: string;
  challengeId: string | null;
  interventionEventId: string;
  overrideKey: string;
  confirmationText: string;
  confirmedAt: string;
}>;

export type PersistedTimelineEvent = Readonly<{
  id: string;
  accountId: string;
  challengeId: string | null;
  eventKey: string;
  planSnapshotId: string | null;
  versions: PersistenceVersions;
  payload: ChallengeTimelineEvent;
}>;

export type PropPassLiveRiskSettings = Readonly<{
  rules: LiveRiskRules;
  configuredAt: string;
  selectedMode?: "calm" | "balanced" | "gambler";
  /** Explicit locale-independent trading week boundary. 0 Sunday, 1 Monday. */
  weekStartsOn?: 0 | 1;
  normalRiskPerTradeMinor?: number;
  normalMaximumContracts?: number;
  recoveryRiskBps?: number;
  minimumCompliantProfitableSessions?: number;
}>;
export type PropPassPayoutWithdrawalSettings = Readonly<{ payout: PayoutReadinessInput | null; withdrawal: SafeWithdrawalInput | null; configuredAt: string }>;
export type PropPassKillSwitchSettings = Readonly<{
  configuration: KillSwitchConfiguration;
  configuredAt: string;
  manualSessionLockRequested?: boolean;
  manualSessionLockConfirmed?: boolean;
  manualSessionLockActivatedAt?: string | null;
  manualSessionLockReason?: string | null;
  manualSessionLockExpiresAt?: string | null;
}>;
export type PropPassRecoveryState = Readonly<{ state: RecoveryModeValues; updatedAt: string }>;

export type PersistedRuntimeState = Readonly<{
  accountId: string;
  challengeId: string | null;
  stateRevision: number;
  lifecycleStatus: string;
  lastProcessedEventKey: string | null;
  calculatedAt: string;
  versions: PersistenceVersions;
  payloadDigest: string;
  payload: PropPassCalculationPipelineOutput;
}>;

export type JournalPersistenceEvent = Readonly<{
  userId: string;
  accountId: string;
  challengeId: string | null;
  eventKey: string;
  eventType: "trade_saved" | "trade_edited" | "trade_deleted" | "trade_assigned" | "trade_unassigned" | "settings_changed";
  journalTradeId: string | null;
  tradeClientId: string;
  tradeRevision: number;
  calculationVersion: string;
  priorEventKey: string | null;
  inputDigest: string;
}>;

export type JournalEventClaim = Readonly<{
  kind: "claimed" | "already_applied";
  eventId: string;
  processingState: "pending" | "applied" | "superseded" | "failed";
  resultDigest: string | null;
}>;

export type CompleteJournalEvent = Readonly<{
  eventKey: string;
  resultDigest: string;
  stateRevision: number;
  lifecycleStatus: string;
  calculatedAt: string;
  versions: PersistenceVersions;
  stateDigest: string;
  state: PropPassCalculationPipelineOutput;
}>;

export interface PropPassPersistenceReadAdapter {
  listDailyPlans(accountId: string): Promise<PersistedDailyPlan[]>;
  listTimeline(accountId: string): Promise<ChallengeTimelineEvent[]>;
  listInstrumentVersions(accountId: string, symbol: string): Promise<InstrumentSpecificationVersion[]>;
  getRuntimeState(accountId: string): Promise<PersistedRuntimeState | null>;
}

export interface PropPassPersistenceWriteAdapter {
  appendDailyPlan(input: PersistedDailyPlan): Promise<void>;
  appendPreTradeAssessment(input: PersistedPreTradeAssessment): Promise<void>;
  appendIntervention(input: PersistedInterventionEvent): Promise<void>;
  appendInterventionOverride(input: PersistedInterventionOverride): Promise<void>;
  appendTimeline(input: PersistedTimelineEvent): Promise<void>;
  appendDecisionReplay(input: PersistedDecisionReplay): Promise<void>;
  appendInstrumentVersion(accountId: string, input: InstrumentSpecificationVersion): Promise<void>;
  saveLiveRiskSettings(accountId: string, input: PropPassLiveRiskSettings): Promise<void>;
  savePayoutWithdrawalSettings(accountId: string, input: PropPassPayoutWithdrawalSettings): Promise<void>;
  saveKillSwitchSettings(accountId: string, input: PropPassKillSwitchSettings): Promise<void>;
  saveRecoveryModeState(accountId: string, input: PropPassRecoveryState): Promise<void>;
  appendPositionProgression(input: Readonly<{ id: string; accountId: string; eventKey: string; occurredAt: string; payload: PositionSizeProgressionValues }>): Promise<void>;
  claimJournalEvent(input: JournalPersistenceEvent): Promise<JournalEventClaim>;
  completeJournalEvent(input: CompleteJournalEvent): Promise<"applied" | "already_applied">;
  failJournalEvent(eventKey: string, resultDigest: string): Promise<void>;
}

export type PropPassPersistenceAdapter = PropPassPersistenceReadAdapter & PropPassPersistenceWriteAdapter;
