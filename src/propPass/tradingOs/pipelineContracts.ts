import type { ChallengeLifecycleInput, ChallengeLifecycleValues } from "./challenge";
import type {
  AccountContext,
  AllowedRiskValues,
  ChallengeRules,
  InstrumentSpec,
  LiveRiskRules,
  MoneyMinor,
  RiskHealth,
  RiskRooms,
  TradePlanInput,
  TradingOsResult,
  TradingRiskMode,
} from "./contracts";
import type { DailyPlanInput, DailyTradingPlanSnapshot } from "./dailyPlan";
import type { SmartIntervention, InterventionTradeFact } from "./interventions";
import type { KillSwitchInput, KillSwitchValues } from "./killSwitch";
import type { LiveAccountIntegrationInput, LiveAccountIntegrationValues } from "./liveAccount";
import type { PayoutReadinessInput, PayoutReadinessValues } from "./payout";
import type { PositionSizingValues } from "./positionSizing";
import type { PreTradeValues } from "./preTrade";
import type { DecisionReplay, DecisionReplayInput } from "./replay";
import type { LiveRiskMeterValues } from "./riskMeter";
import type { ChallengeTimelineEvent, PersistedTimelineFact } from "./timeline";
import type { SafeWithdrawalInput, SafeWithdrawalValues } from "./withdrawal";
import { PROP_PASS_CALCULATION_VERSION } from "./calculationVersion";
import type { TradingTimeContext } from "../../propOs/tradingTime";

export { PROP_PASS_CALCULATION_VERSION } from "./calculationVersion";

export type PropPassActiveRuleVersion = Readonly<{
  versionId: string;
  effectiveAt: string;
  challengeRules: ChallengeRules | null;
  liveRules: LiveRiskRules | null;
}>;

export type PropPassInstrumentVersion = Readonly<{
  specificationVersion: string;
  effectiveAt: string;
  specification: InstrumentSpec;
}>;

export type PropPassTradingDayContext = TradingTimeContext;

export type PropPassJournalState = Readonly<{
  appliedTradeIds: string[];
  completedTrades: InterventionTradeFact[];
  dailyRiskUsedMinor: MoneyMinor | null;
  latestReplayTrade: DecisionReplayInput["trade"];
  persistedTimelineFacts: PersistedTimelineFact[];
}>;

export type PropPassDailyPlanDraft = Pick<
  DailyPlanInput,
  "snapshotId" | "generatedAt" | "preferredInstrument" | "intendedSessionId" | "recentLossStreak"
>;

export type PropPassChallengeFacts = Omit<
  ChallengeLifecycleInput,
  "account" | "rules" | "riskRooms" | "appliedJournalTradeIds"
>;

export type PropPassLiveFacts = Omit<
  LiveAccountIntegrationInput,
  "account" | "rules" | "riskRooms" | "killSwitch"
>;

export type PropPassCalculationPipelineInput = Readonly<{
  account: AccountContext | null;
  accountContext: AccountContext["contextType"] | null;
  activeRules: PropPassActiveRuleVersion | null;
  instrument: PropPassInstrumentVersion | null;
  tradingDay: PropPassTradingDayContext | null;
  riskRooms: RiskRooms | null;
  selectedMode: TradingRiskMode;
  killSwitch: KillSwitchInput | null;
  journal: PropPassJournalState;
  currentDailyPlan: DailyTradingPlanSnapshot | null;
  dailyPlanDraft: PropPassDailyPlanDraft | null;
  proposedTradePlan: TradePlanInput | null;
  proposedInterventionTrade: InterventionTradeFact | null;
  profitLockReached: boolean;
  previousRiskHealth?: RiskHealth | null;
  challengeFacts: PropPassChallengeFacts | null;
  liveFacts: PropPassLiveFacts | null;
  payout: PayoutReadinessInput | null;
  withdrawal: SafeWithdrawalInput | null;
}>;

export type PropPassCalculationTraceStep = Readonly<{
  order: number;
  stage:
    | "account"
    | "rules"
    | "trading_day"
    | "instrument"
    | "hard_risk_rooms"
    | "mode_limits"
    | "daily_plan"
    | "pre_trade"
    | "contract_size"
    | "smart_intervention"
    | "journal_application"
    | "decision_replay"
    | "account_lifecycle";
  status: TradingOsResult<unknown>["status"];
  sourceVersion: string | null;
  inputs: Readonly<Record<string, string | number | boolean | null>>;
  outputs: Readonly<Record<string, string | number | boolean | null>>;
  arithmetic: string[];
  rounding: string[];
}>;

export type PropPassJournalApplication = Readonly<{
  appliedTradeIds: string[];
  duplicateTradeIds: string[];
  latestTradeId: string | null;
  persistenceRequired: boolean;
}>;

export type PropPassCalculationPipelineOutput = Readonly<{
  calculationVersion: typeof PROP_PASS_CALCULATION_VERSION;
  status: TradingOsResult<unknown>["status"];
  hardRiskRooms: RiskRooms | null;
  allowedRisk: TradingOsResult<AllowedRiskValues>;
  dailyPlan: TradingOsResult<DailyTradingPlanSnapshot | null>;
  riskMeter: TradingOsResult<LiveRiskMeterValues>;
  preTrade: TradingOsResult<PreTradeValues> | null;
  contractSize: TradingOsResult<PositionSizingValues> | null;
  interventions: SmartIntervention[];
  journalApplication: PropPassJournalApplication;
  decisionReplay: DecisionReplay;
  timeline: ChallengeTimelineEvent[];
  challengeLifecycle: TradingOsResult<ChallengeLifecycleValues> | null;
  liveLifecycle: TradingOsResult<LiveAccountIntegrationValues> | null;
  payoutReadiness: TradingOsResult<PayoutReadinessValues> | null;
  withdrawalReadiness: TradingOsResult<SafeWithdrawalValues> | null;
  missingInputs: string[];
  calculationTrace: PropPassCalculationTraceStep[];
}>;
