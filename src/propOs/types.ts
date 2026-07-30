/**
 * Prop OS domain types — Phase 0A/0B/0C specification surface.
 * Isolated from production app entry.
 */

export type MoneyMinor = number;

export type ConfidenceLevel = "insufficient" | "low" | "medium" | "high";

export type ConfidenceBlock = {
  sampleSize: number;
  confidence: ConfidenceLevel;
  confidencePolicyVersion: "confidence-policy-v0";
  limitations: string[];
};

export type ChallengeLifecycleStatus =
  | "active"
  | "at_risk"
  | "breached"
  | "passed"
  | "funded"
  | "reset"
  | "abandoned";

export type DrawdownKind = "static" | "trailingEndOfDay" | "trailingIntraday";

export type DailyLossBasis =
  | "realized_only"
  | "realized_plus_unrealized"
  | "starting_day_balance"
  | "prior_day_balance";

export type PropRuleSetSnapshot = {
  version: string;
  firmKey: string;
  currency: string;
  firmTimezone: string; // IANA
  /** Local hour [0-23] when trading day rolls (default 0). */
  tradingDayRolloverHour: number;
  profitTargetMinor: MoneyMinor;
  dailyLossLimitMinor?: MoneyMinor;
  dailyLossBasis: DailyLossBasis;
  dailyLossPolicyVersion: "daily-loss-v0";
  drawdown: {
    kind: DrawdownKind;
    amountMinor: MoneyMinor;
    /** Freeze trailing floor after profit target (optional). */
    stopTrailingAfterTarget?: boolean;
  };
  minimumTradingDays?: number;
  maxContracts?: number;
  /** If true, intraday trailing requires equity stream events. */
  intradayRequiresEquityStream?: boolean;
};

export type PropAccountFixture = {
  id: string;
  userId: string;
  firmKey: string;
  label: string;
  accountSizeMinor: MoneyMinor;
  currency: string;
  timezone: string;
  status: "active" | "archived" | "closed";
};

export type PropChallengeFixture = {
  id: string;
  accountId: string;
  phase: "evaluation" | "funded";
  status: ChallengeLifecycleStatus;
  ruleSetVersion: string;
  ruleSetSnapshot: PropRuleSetSnapshot;
  startingBalanceMinor: MoneyMinor;
  startedAtUtc: string;
  endedAtUtc?: string;
  resetOfChallengeId?: string;
  /** Sticky breach — once set, replay keeps breached unless correction/reset. */
  breachLocked?: boolean;
  breachReasons?: { code: string; at: string; tradeId?: string }[];
};

/** Canonical accounting event (fill-level or aggregated trade close). */
export type AccountingEvent =
  | {
      kind: "fill_close";
      id: string;
      challengeId: string | null; // null = unassigned
      accountId: string | null;
      occurredAtUtc: string;
      brokerSequence?: number;
      realizedPnlMinor?: MoneyMinor;
      feesMinor?: MoneyMinor | null;
      contracts?: number;
      voided?: boolean;
      correctsEventId?: string;
    }
  | {
      kind: "equity_mark";
      id: string;
      challengeId: string;
      occurredAtUtc: string;
      brokerSequence?: number;
      equityMinor: MoneyMinor;
    }
  | {
      kind: "day_boundary";
      id: string;
      challengeId: string;
      occurredAtUtc: string;
      tradingDayId: string;
    }
  | {
      kind: "challenge_reset";
      id: string;
      challengeId: string;
      occurredAtUtc: string;
      reason: string;
    }
  | {
      kind: "official_correction";
      id: string;
      challengeId: string;
      occurredAtUtc: string;
      clearsBreach: boolean;
      reason: string;
    };

export type BufferSlice = {
  id: "daily_loss" | "drawdown" | "target_distance" | "consistency" | "contracts";
  remainingMinor: MoneyMinor | null;
  limitMinor: MoneyMinor | null;
  status: "ok" | "warn" | "hard";
  limitations: string[];
};

export type ReadinessDriver = {
  factor: string;
  contribution: number;
  evidence: ConfidenceBlock & { value: number | string };
};

export type PropEngineResultV0 = {
  calculationVersion: "calc-spec-v0";
  ruleSetVersion: string;
  inputRevision: string;
  calculatedAt: string;
  bufferModelVersion: "buffer-v0";
  readinessModelVersion: "readiness-v0" | null;
  confidencePolicyVersion: "confidence-policy-v0";
  dailyLossPolicyVersion: "daily-loss-v0";
  dailyLossBasis: DailyLossBasis;

  challengeId: string;
  status: ChallengeLifecycleStatus;
  breachReasons: { code: string; at: string; tradeId?: string }[];

  accountState: {
    equityMinor: MoneyMinor;
    startingBalanceMinor: MoneyMinor;
    hwmMinor: MoneyMinor;
    drawdownFloorMinor: MoneyMinor;
    tradingDayId: string;
    dayPnlMinor: MoneyMinor;
    equitySource: "trade_only" | "equity_stream" | "incomplete";
  };

  buffers: BufferSlice[];

  readiness: null | {
    score: number;
    previousScore: number | null;
    delta: number | null;
    /**
     * Causal score-delta drivers only.
     * sum(contribution) must reconcile previousScore → score within
     * SCORE_DELTA_RECONCILIATION_TOLERANCE when delta != null and drivers non-empty.
     */
    drivers: ReadinessDriver[];
    /** Non-causal factor levels / failed reconciliation — not score drivers. */
    supportingEvidence: ReadinessDriver[];
    confidence: ConfidenceBlock;
    gate?: string;
    /** True when drivers reconcile score delta within tolerance. */
    driversReconciled?: boolean;
  };

  confidence: ConfidenceBlock;
  evidence: Array<ConfidenceBlock & { metricId: string; value: number | string }>;
  limitations: string[];
};

export type FixtureExpectation = {
  status: ChallengeLifecycleStatus;
  /** Exact score, null when withheld, or true when any finite score expected */
  readinessScore: number | null | true;
  readinessGate?: string;
  limitationsIncludes?: string[];
  limitationsExcludes?: string[];
  breachCodesIncludes?: string[];
  equityMinor?: MoneyMinor;
  hwmMinor?: MoneyMinor;
  drawdownFloorMinor?: MoneyMinor;
  dayPnlMinor?: MoneyMinor;
  equitySource?: PropEngineResultV0["accountState"]["equitySource"];
  dailyLossBasis?: DailyLossBasis;
  /** Require readiness.delta != null when previous score provided */
  expectScoreDelta?: boolean;
};
