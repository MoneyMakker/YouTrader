/**
 * Prop Pass UI contracts (Phase 2A). Outside propOs domain.
 */

export type PropPassMoney = {
  minor: number;
  currency: string;
  /** Display helper only — formatting stays in UI. */
  formatted?: string;
};

export type BufferViewModel = {
  id: "daily_loss" | "trailing_drawdown" | "total_loss";
  labelKey: string;
  remainingMinor: number | null;
  limitMinor: number | null;
  /** Semantic status from engine snapshot — not a UI color. */
  status: "ok" | "warn" | "hard" | "unsupported";
  ratio: number | null;
  limitations: string[];
  accessibilityKey: string;
};

export type ChallengeSummary = {
  id: string;
  status: string;
  startedAt: string;
  ruleSetVersion: string;
};

export type PropPassViewModel = {
  account: {
    id: string;
    displayName: string;
    firmName?: string;
    accountSize?: PropPassMoney;
    lifecycleStatus: string;
  };
  challenge: {
    id: string;
    attemptNumber: number;
    status: string;
    startedAt?: string;
  };
  /** Non-active attempts — display only; never auto-promoted. */
  historicalAttempts: Array<{
    id: string;
    status: string;
    startedAt: string;
  }>;
  assignedTradeCount: number;
  progress: {
    currentBalance?: PropPassMoney;
    profitTarget?: PropPassMoney;
    profitRemaining?: PropPassMoney;
  };
  buffers: {
    dailyLoss?: BufferViewModel;
    trailingDrawdown?: BufferViewModel;
    totalLoss?: BufferViewModel;
  };
  readiness: {
    score: number | null;
    confidence: string;
    reasonCodes: string[];
    lifecycleOverride: boolean;
  };
  dataQuality: {
    status: string;
    limitations: string[];
  };
  freshness: {
    status: "current" | "stale";
    calculatedAt?: string;
  };
};

export type PropPassUiState =
  | { kind: "disabled" }
  | { kind: "loading" }
  | { kind: "no_account" }
  | { kind: "no_active_challenge" }
  | { kind: "challenge_selection_required"; challenges: ChallengeSummary[]; accountId: string | null }
  | { kind: "missing_rule_snapshot" }
  | { kind: "no_shadow_snapshot" }
  | { kind: "stale_snapshot"; reasonCodes: string[] }
  | { kind: "incomplete_data"; reasonCodes: string[] }
  | { kind: "unsupported"; reasonCodes: string[] }
  | { kind: "integrity_error" }
  | { kind: "repository_unavailable" }
  | { kind: "available"; model: PropPassViewModel };

/** Optional execution-plan presentation (server or staging fixture). */
export type PropPassTodaysPlanView = {
  maxTrades: number;
  dailyStopDisplay: string;
  profitLockDisplay: string;
  instrument: string;
  session: string;
  focus: string;
  behavioralRule: string;
};

export type PropPassInsightsPresentation = "from_model" | "pending" | "failed" | "current";
