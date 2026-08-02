import type {
  PropPassInsightsPresentation,
  PropPassTodaysPlanView,
  PropPassUiState,
  PropPassViewModel,
} from "../propPass/types";

export type StagingPropPassQaMode =
  | "none"
  | "healthy"
  | "caution"
  | "at_risk"
  | "passed"
  | "violated"
  | "insufficient_data"
  | "no_account"
  | "no_active_challenge"
  | "stale"
  | "offline_cached"
  | "backend_unavailable"
  | "loading"
  | "empty_plan"
  | "populated_plan"
  | "insights_current"
  | "insights_pending"
  | "insights_failed"
  | "non_allowlisted";

export type StagingPropPassPlanFixture = PropPassTodaysPlanView;
export type StagingPropPassInsightsMode = PropPassInsightsPresentation;

export type StagingPropPassQaPayload = {
  mode: StagingPropPassQaMode;
  /** When set, Prop Pass tab is forced hidden (non-allowlisted matrix). */
  forceHidePropPassTab: boolean;
  uiStateOverride: PropPassUiState | null;
  plan: StagingPropPassPlanFixture | null;
  insightsMode: StagingPropPassInsightsMode;
};

const STORAGE_KEY = "yt-qa-prop-pass-state-v1";

const ALL_MODES: StagingPropPassQaMode[] = [
  "none",
  "healthy",
  "caution",
  "at_risk",
  "passed",
  "violated",
  "insufficient_data",
  "no_account",
  "no_active_challenge",
  "stale",
  "offline_cached",
  "backend_unavailable",
  "loading",
  "empty_plan",
  "populated_plan",
  "insights_current",
  "insights_pending",
  "insights_failed",
  "non_allowlisted",
];

export function isStagingPropPassQaAllowed(
  env: Record<string, string | undefined> = typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {},
): boolean {
  const appEnv = (env.EXPO_PUBLIC_APP_ENV || env.APP_ENV || "").toLowerCase();
  return appEnv === "staging" || appEnv === "development";
}

export function parseStagingPropPassQaUrl(url: string): StagingPropPassQaMode | null {
  const raw = (url || "").trim().toLowerCase();
  if (!raw.startsWith("youtrader://qa/prop-pass-state")) return null;
  try {
    const mode = (new URL(raw).searchParams.get("mode") || "none") as StagingPropPassQaMode;
    return ALL_MODES.includes(mode) ? mode : null;
  } catch {
    return null;
  }
}

export const STAGING_PROP_PASS_QA_STORAGE_KEY = STORAGE_KEY;

const POPULATED_PLAN: StagingPropPassPlanFixture = {
  maxTrades: 2,
  dailyStopDisplay: "−$300",
  profitLockDisplay: "+$400",
  instrument: "MES",
  session: "New York AM",
  focus: "Take only A+ setups.",
  behavioralRule: "Stop after two consecutive losses.",
};

function money(minor: number, currency = "USD") {
  return { minor, currency };
}

function buffer(
  id: "daily_loss" | "trailing_drawdown" | "total_loss",
  labelKey: string,
  remainingMinor: number,
  limitMinor: number,
  status: "ok" | "warn" | "hard" | "unsupported",
) {
  const ratio = limitMinor === 0 ? null : Math.max(0, Math.min(1, remainingMinor / limitMinor));
  return {
    id,
    labelKey,
    remainingMinor,
    limitMinor,
    status,
    ratio,
    limitations: [] as string[],
    accessibilityKey:
      status === "hard" ? "propPass.a11y.bufferExhausted" : "propPass.a11y.bufferStatus",
  };
}

function baseModel(over: Partial<PropPassViewModel> = {}): PropPassViewModel {
  return {
    account: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      displayName: "Apex 50K",
      firmName: "Apex",
      accountSize: money(5000000),
      lifecycleStatus: "active",
    },
    challenge: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      attemptNumber: 1,
      status: "active",
      startedAt: "2026-07-01T12:00:00.000Z",
    },
    historicalAttempts: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "passed",
        startedAt: "2026-06-01T12:00:00.000Z",
      },
    ],
    assignedTradeCount: 8,
    progress: {
      currentBalance: money(5125000),
      profitTarget: money(300000),
      profitRemaining: money(175000),
    },
    buffers: {
      dailyLoss: buffer("daily_loss", "propPass.buffer.dailyLoss", 78000, 100000, "ok"),
      trailingDrawdown: buffer(
        "trailing_drawdown",
        "propPass.buffer.trailingDrawdown",
        142000,
        200000,
        "ok",
      ),
      totalLoss: buffer("total_loss", "propPass.buffer.totalLoss", 142000, 200000, "ok"),
    },
    readiness: {
      score: 74,
      confidence: "high",
      reasonCodes: [],
      lifecycleOverride: false,
    },
    rules: null,
    breachReasons: [],
    readinessDelta: null,
    readinessPrimaryDriver: null,
    daysTraded: null,
    tradeCountInSnapshot: null,
    tradingStats: null,
    dataQuality: { status: "ok", limitations: [] },
    freshness: {
      status: "current",
      calculatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
    ...over,
  };
}

/** Pure fixture builder — Node-testable, no network. */
export function resolveStagingPropPassQa(mode: StagingPropPassQaMode): StagingPropPassQaPayload {
  if (mode === "none") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: null,
      plan: null,
      insightsMode: "from_model",
    };
  }
  if (mode === "non_allowlisted") {
    return {
      mode,
      forceHidePropPassTab: true,
      uiStateOverride: { kind: "disabled" },
      plan: null,
      insightsMode: "from_model",
    };
  }
  if (mode === "loading") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: { kind: "loading" },
      plan: null,
      insightsMode: "from_model",
    };
  }
  if (mode === "no_account") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: { kind: "no_account" },
      plan: null,
      insightsMode: "from_model",
    };
  }
  if (mode === "no_active_challenge") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: { kind: "no_active_challenge" },
      plan: null,
      insightsMode: "from_model",
    };
  }
  if (mode === "backend_unavailable") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: { kind: "repository_unavailable" },
      plan: null,
      insightsMode: "from_model",
    };
  }
  if (mode === "stale") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: { kind: "stale_snapshot", reasonCodes: ["snapshot_age"] },
      plan: null,
      insightsMode: "from_model",
    };
  }

  if (mode === "healthy" || mode === "insights_current" || mode === "populated_plan") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: { kind: "available", model: baseModel() },
      plan: mode === "populated_plan" || mode === "healthy" ? POPULATED_PLAN : POPULATED_PLAN,
      insightsMode: mode === "insights_current" ? "current" : "from_model",
    };
  }

  if (mode === "empty_plan") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: {
        kind: "available",
        model: baseModel({ assignedTradeCount: 0 }),
      },
      plan: null,
      insightsMode: "from_model",
    };
  }

  if (mode === "caution") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: {
        kind: "available",
        model: baseModel({
          buffers: {
            dailyLoss: buffer("daily_loss", "propPass.buffer.dailyLoss", 24000, 100000, "warn"),
            trailingDrawdown: buffer(
              "trailing_drawdown",
              "propPass.buffer.trailingDrawdown",
              110000,
              200000,
              "ok",
            ),
            totalLoss: buffer("total_loss", "propPass.buffer.totalLoss", 110000, 200000, "ok"),
          },
          progress: {
            currentBalance: money(5080000),
            profitTarget: money(300000),
            profitRemaining: money(220000),
          },
        }),
      },
      plan: POPULATED_PLAN,
      insightsMode: "from_model",
    };
  }

  if (mode === "at_risk") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: {
        kind: "available",
        model: baseModel({
          buffers: {
            dailyLoss: buffer("daily_loss", "propPass.buffer.dailyLoss", 8000, 100000, "hard"),
            trailingDrawdown: buffer(
              "trailing_drawdown",
              "propPass.buffer.trailingDrawdown",
              45000,
              200000,
              "warn",
            ),
            totalLoss: buffer("total_loss", "propPass.buffer.totalLoss", 45000, 200000, "warn"),
          },
          progress: {
            currentBalance: money(5010000),
            profitTarget: money(300000),
            profitRemaining: money(290000),
          },
        }),
      },
      plan: {
        ...POPULATED_PLAN,
        maxTrades: 1,
        focus: "Protect the account.",
        behavioralRule: "Stop trading for the day.",
      },
      insightsMode: "from_model",
    };
  }

  if (mode === "passed") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: {
        kind: "available",
        model: baseModel({
          challenge: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            attemptNumber: 1,
            status: "passed",
            startedAt: "2026-07-01T12:00:00.000Z",
          },
          progress: {
            currentBalance: money(5300000),
            profitTarget: money(300000),
            profitRemaining: money(0),
          },
          readiness: {
            score: null,
            confidence: "high",
            reasonCodes: ["lifecycle_passed"],
            lifecycleOverride: true,
          },
        }),
      },
      plan: POPULATED_PLAN,
      insightsMode: "from_model",
    };
  }

  if (mode === "violated") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: {
        kind: "available",
        model: baseModel({
          challenge: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            attemptNumber: 1,
            status: "breached",
            startedAt: "2026-07-01T12:00:00.000Z",
          },
          buffers: {
            dailyLoss: buffer("daily_loss", "propPass.buffer.dailyLoss", 0, 100000, "hard"),
            trailingDrawdown: buffer(
              "trailing_drawdown",
              "propPass.buffer.trailingDrawdown",
              0,
              200000,
              "hard",
            ),
            totalLoss: buffer("total_loss", "propPass.buffer.totalLoss", 0, 200000, "hard"),
          },
          readiness: {
            score: null,
            confidence: "high",
            reasonCodes: ["lifecycle_breached"],
            lifecycleOverride: true,
          },
        }),
      },
      plan: null,
      insightsMode: "from_model",
    };
  }

  if (mode === "insufficient_data") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: {
        kind: "available",
        model: baseModel({
          assignedTradeCount: 1,
          progress: {},
          buffers: {},
          readiness: {
            score: null,
            confidence: "unknown",
            reasonCodes: ["insufficient_sample"],
            lifecycleOverride: false,
          },
        }),
      },
      plan: null,
      insightsMode: "from_model",
    };
  }

  if (mode === "offline_cached") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: {
        kind: "available",
        model: baseModel({
          freshness: {
            status: "stale",
            calculatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          },
        }),
      },
      plan: POPULATED_PLAN,
      insightsMode: "from_model",
    };
  }

  if (mode === "insights_pending") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: { kind: "available", model: baseModel() },
      plan: POPULATED_PLAN,
      insightsMode: "pending",
    };
  }

  if (mode === "insights_failed") {
    return {
      mode,
      forceHidePropPassTab: false,
      uiStateOverride: { kind: "available", model: baseModel() },
      plan: POPULATED_PLAN,
      insightsMode: "failed",
    };
  }

  return {
    mode: "none",
    forceHidePropPassTab: false,
    uiStateOverride: null,
    plan: null,
    insightsMode: "from_model",
  };
}
