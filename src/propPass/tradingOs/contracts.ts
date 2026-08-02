/**
 * Deterministic Prop Pass Trading OS contracts.
 *
 * This module is intentionally runtime-neutral: it accepts verified account,
 * Journal and editable-rule data, but never imports UI, Supabase, RevenueCat
 * or a broker. Money is always an integer in currency minor units.
 */

export type MoneyMinor = number;
export type TradingContextType = "challenge" | "live";
export type TradingRiskMode = "calm" | "balanced" | "gambler";
export type TradeDirection = "long" | "short";
export type StopUnit = "ticks" | "points";
export type DrawdownType = "static" | "trailing";
export type DrawdownCalculation = "intraday" | "end_of_day";
export type DecisionStatus =
  | "safe_to_take"
  | "risky"
  | "rule_violation"
  | "stop_trading"
  | "needs_input";
export type RiskHealth = "healthy" | "watch" | "danger" | "stop_trading";

export type HardLimitId =
  | "daily_loss"
  | "maximum_loss"
  | "drawdown"
  | "per_trade_risk"
  | "contract_limit"
  | "allowed_session"
  | "trade_count"
  | "consecutive_losses"
  | "profit_lock"
  | "weekly_loss"
  | "kill_switch";

export type AppliedHardLimit = {
  id: HardLimitId;
  label: string;
  limitMinor: MoneyMinor | null;
  remainingMinor: MoneyMinor | null;
  blocksTrading: boolean;
};

/** Every Trading OS calculation exposes its assumptions and hard caps. */
export type TradingOsResult<TValues> = {
  values: TValues;
  status: DecisionStatus;
  reasons: string[];
  missingInputs: string[];
  appliedHardLimits: AppliedHardLimit[];
  relatedRuleIds: string[];
};

export type AccountContext = {
  contextType: TradingContextType;
  accountId: string;
  startingBalanceMinor: MoneyMinor;
  currentBalanceMinor: MoneyMinor;
  currentEquityMinor: MoneyMinor;
  equityHighMinor: MoneyMinor;
  realizedPnlMinor: MoneyMinor;
  /** Present only when the connected data source supports it. */
  unrealizedPnlMinor?: MoneyMinor;
  tradingDay: string;
  timezone: string;
  preferredInstrument?: string;
};

export type AllowedSession = {
  id: string;
  label: string;
  startMinuteLocal: number;
  endMinuteLocal: number;
};

export type ChallengeRules = {
  id: string;
  effectiveDate: string;
  templateVersion: string;
  profitTargetMinor?: MoneyMinor;
  dailyLossLimitMinor?: MoneyMinor;
  maximumLossLimitMinor?: MoneyMinor;
  drawdownType?: DrawdownType;
  drawdownCalculation?: DrawdownCalculation;
  minimumTradingDays?: number;
  consistencyRule?: { maximumDailyProfitShare: number };
  payoutThresholdMinor?: MoneyMinor;
  payoutMinimumDays?: number;
  scalingRule?: { minimumProfitableSessions: number; requiresNewEquityHigh: boolean };
  maximumContracts?: number;
  allowedSessions?: AllowedSession[];
  profitLockMinor?: MoneyMinor;
  stopAfterLosses?: number;
};

export type LiveRiskRules = {
  id: string;
  dailyRiskBudgetMinor?: MoneyMinor;
  weeklyLossLimitMinor?: MoneyMinor;
  maximumDrawdownMinor?: MoneyMinor;
  perTradeRiskCapMinor?: MoneyMinor;
  maximumTrades?: number;
  consecutiveLossLimit?: number;
  cutoffMinuteLocal?: number;
  profitProtectionThresholdMinor?: MoneyMinor;
  recoveryModeThresholdBps?: number;
  postWithdrawalReserveMinor?: MoneyMinor;
};

export type InstrumentSpec = {
  symbol: string;
  name: string;
  category: "futures";
  exchange: string;
  currency: string;
  tickSize: number;
  tickValueMinor: MoneyMinor;
  pointValueMinor: MoneyMinor;
  roundTripCommissionMinor: MoneyMinor | null;
  defaultSlippageTicks: number | null;
  maximumSupportedContracts: number | null;
  /** The config source must be visible to rule editors; never infer a spec. */
  source: "user_configured" | "verified_catalogue";
  verifiedAt: string;
};

export type TradePlanInput = {
  instrument: InstrumentSpec | null;
  direction: TradeDirection | null;
  stopDistance: number | null;
  stopUnit: StopUnit | null;
  contracts: number | null;
  setup: string | null;
  intendedSessionId: string | null;
  intendedRiskMinor: MoneyMinor | null;
  intendedRewardMinor?: MoneyMinor | null;
  plannedEntryTime: string | null;
};

export type RiskRooms = {
  dailyLossRemainingMinor: MoneyMinor | null;
  maximumLossRemainingMinor: MoneyMinor | null;
  drawdownRemainingMinor: MoneyMinor | null;
  weeklyLossRemainingMinor?: MoneyMinor | null;
  configuredDailyRiskBudgetMinor?: MoneyMinor | null;
  configuredPerTradeRiskCapMinor?: MoneyMinor | null;
};

export type RiskModePolicy = {
  mode: TradingRiskMode;
  defaultAllocationBps: number;
  minimumAllocationBps: number;
  maximumAllocationBps: number;
};

export const RISK_MODE_POLICIES: Record<TradingRiskMode, RiskModePolicy> = {
  calm: { mode: "calm", minimumAllocationBps: 0, defaultAllocationBps: 1500, maximumAllocationBps: 2500 },
  balanced: { mode: "balanced", minimumAllocationBps: 1500, defaultAllocationBps: 2250, maximumAllocationBps: 3000 },
  gambler: { mode: "gambler", minimumAllocationBps: 2500, defaultAllocationBps: 5000, maximumAllocationBps: 10000 },
};

export type AllowedRiskValues = {
  safeBudgetMinor: MoneyMinor | null;
  modeSuggestedRiskMinor: MoneyMinor | null;
  allowedRiskMinor: MoneyMinor;
};
