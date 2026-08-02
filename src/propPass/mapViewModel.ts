import type { AccountReadModel } from "../propOs/accounts/types";
import type { BufferSlice } from "../propOs/types";
import type { BufferViewModel, PropPassMoney, PropPassViewModel } from "./types";

/**
 * Map activated AccountReadModel → UI view model.
 * Must not recalculate financial values — snapshot payloads only.
 */
export function mapActivatedReadModelToViewModel(
  readModel: AccountReadModel,
): PropPassViewModel {
  const account = readModel.account!;
  const challenge = readModel.activeChallenge!;
  const engine = readModel.latestShadowSnapshot;
  const payload = (engine?.payload ?? {}) as Record<string, unknown>;
  const accountState = (payload.accountState ?? {}) as Record<string, unknown>;
  const buffers = Array.isArray(payload.buffers)
    ? (payload.buffers as BufferSlice[])
    : [];
  const readiness = payload.readiness as
    | null
    | {
        score?: number;
        delta?: number | null;
        drivers?: Array<{ factor?: string; label?: string; contribution?: number }>;
        confidence?: { level?: string };
        gate?: string;
      }
    | undefined;
  const tradingStats = payload.tradingStats as
    | {
        daysTraded?: number;
        tradeCount?: number;
        disciplineStreakDays?: number;
        bestDisciplineStreakDays?: number;
        ruleViolations?: number;
      }
    | undefined;
  const breachReasons = Array.isArray(payload.breachReasons)
    ? (payload.breachReasons as Array<{ code: string; at: string; tradeId?: string }>)
    : [];
  const limitations = Array.isArray(payload.limitations)
    ? (payload.limitations as string[])
    : Array.isArray(engine?.limitations)
      ? (engine!.limitations as string[])
      : [];

  const currency =
    readModel.ruleSnapshot?.snapshot.currency ?? account.currency ?? "USD";
  const profitTargetMinor = readModel.ruleSnapshot?.snapshot.profitTargetMinor;
  const equityMinor =
    typeof accountState.equityMinor === "number" ? accountState.equityMinor : null;
  const targetDistance = buffers.find((b) => b.id === "target_distance");
  const profitRemaining =
    targetDistance?.remainingMinor != null ? targetDistance.remainingMinor : null;

  // attemptNumber: count historical + 1 when resolved
  const attemptNumber = readModel.historicalAttempts.length + 1;

  const lifecycle = String(payload.status ?? challenge.status);
  const lifecycleOverride = ["breached", "passed", "reset", "abandoned", "funded"].includes(
    lifecycle,
  );

  let readinessScore: number | null =
    readiness && typeof readiness.score === "number" ? readiness.score : null;
  if (lifecycleOverride || readiness == null) {
    readinessScore = null;
  }

  const confidence =
    (readiness?.confidence?.level as string | undefined) ??
    (typeof engine?.confidence === "object" &&
    engine?.confidence &&
    "level" in engine.confidence
      ? String((engine.confidence as { level?: string }).level ?? "unknown")
      : "unknown");

  const reasonCodes: string[] = [];
  if (lifecycleOverride) reasonCodes.push(`lifecycle_${lifecycle}`);
  if (readiness?.gate) reasonCodes.push(String(readiness.gate));
  reasonCodes.push(...readModel.dataQuality.flags);
  reasonCodes.push(...limitations.slice(0, 8));
  const firstDriver = readiness?.drivers?.[0];
  const rules = readModel.ruleSnapshot?.snapshot;

  return {
    account: {
      id: account.id,
      displayName: account.label,
      firmName: account.firmKey ?? undefined,
      accountSize: money(account.accountSizeMinor, currency),
      lifecycleStatus: account.status,
    },
    challenge: {
      id: challenge.id,
      attemptNumber,
      status: challenge.status,
      startedAt: challenge.startedAt,
      endedAt: challenge.endedAt,
    },
    historicalAttempts: readModel.historicalAttempts.map((h) => ({
      id: h.id,
      status: h.status,
      startedAt: h.startedAt,
    })),
    assignedTradeCount: readModel.assignedTradeCount,
    progress: {
      currentBalance: equityMinor != null ? money(equityMinor, currency) : undefined,
      profitTarget:
        profitTargetMinor != null ? money(profitTargetMinor, currency) : undefined,
      profitRemaining:
        profitRemaining != null ? money(profitRemaining, currency) : undefined,
    },
    buffers: {
      dailyLoss: mapBuffer(buffers, "daily_loss", "propPass.buffer.dailyLoss"),
      trailingDrawdown: mapBuffer(buffers, "drawdown", "propPass.buffer.trailingDrawdown"),
      totalLoss: mapTotalLossProxy(buffers, currency),
    },
    readiness: {
      score: readinessScore,
      confidence,
      reasonCodes: [...new Set(reasonCodes)],
      lifecycleOverride,
    },
    rules: rules
      ? {
          firmKey: rules.firmKey,
          currency: rules.currency,
          profitTargetMinor: rules.profitTargetMinor,
          dailyLossLimitMinor: rules.dailyLossLimitMinor ?? null,
          drawdownAmountMinor: rules.drawdown.amountMinor,
          drawdownKind: rules.drawdown.kind,
          minimumTradingDays: rules.minimumTradingDays ?? null,
          startedAt: challenge.startedAt,
        }
      : null,
    breachReasons,
    readinessDelta:
      readiness && typeof readiness.delta === "number" ? readiness.delta : null,
    readinessPrimaryDriver:
      firstDriver && typeof firstDriver.factor === "string"
        ? {
            id: firstDriver.factor,
            label: firstDriver.label ?? firstDriver.factor,
            contribution:
              typeof firstDriver.contribution === "number" ? firstDriver.contribution : null,
          }
        : null,
    daysTraded:
      tradingStats && typeof tradingStats.daysTraded === "number"
        ? tradingStats.daysTraded
        : null,
    tradeCountInSnapshot:
      tradingStats && typeof tradingStats.tradeCount === "number"
        ? tradingStats.tradeCount
        : null,
    tradingStats:
      tradingStats &&
      typeof tradingStats.disciplineStreakDays === "number" &&
      typeof tradingStats.bestDisciplineStreakDays === "number" &&
      typeof tradingStats.ruleViolations === "number"
        ? {
            disciplineStreakDays: tradingStats.disciplineStreakDays,
            bestDisciplineStreakDays: tradingStats.bestDisciplineStreakDays,
            ruleViolations: tradingStats.ruleViolations,
          }
        : null,
    dataQuality: {
      status: readModel.dataQuality.level,
      limitations,
    },
    freshness: {
      status: readModel.dataQuality.flags.includes("stale_snapshot") ? "stale" : "current",
      calculatedAt: engine?.calculated_at,
    },
  };
}

function money(minor: number, currency: string): PropPassMoney {
  return { minor, currency };
}

function mapBuffer(
  buffers: BufferSlice[],
  id: BufferSlice["id"],
  labelKey: string,
): BufferViewModel | undefined {
  const row = buffers.find((b) => b.id === id);
  if (!row) {
    return {
      id: id === "drawdown" ? "trailing_drawdown" : "daily_loss",
      labelKey,
      remainingMinor: null,
      limitMinor: null,
      status: "unsupported",
      ratio: null,
      limitations: ["buffer_unsupported"],
      accessibilityKey: "propPass.a11y.bufferUnsupported",
    };
  }
  if (row.remainingMinor == null || row.limitMinor == null) {
    return {
      id: id === "drawdown" ? "trailing_drawdown" : "daily_loss",
      labelKey,
      remainingMinor: row.remainingMinor,
      limitMinor: row.limitMinor,
      status: "unsupported",
      ratio: null,
      limitations: row.limitations,
      accessibilityKey: "propPass.a11y.bufferUnsupported",
    };
  }
  const ratio =
    row.limitMinor === 0 ? null : Math.max(0, Math.min(1, row.remainingMinor / row.limitMinor));
  const vmId = id === "drawdown" ? "trailing_drawdown" : "daily_loss";
  return {
    id: vmId,
    labelKey,
    remainingMinor: row.remainingMinor,
    limitMinor: row.limitMinor,
    status: row.status,
    ratio,
    limitations: row.limitations,
    accessibilityKey:
      row.status === "hard"
        ? "propPass.a11y.bufferExhausted"
        : "propPass.a11y.bufferStatus",
  };
}

/** Overall loss limit is drawdown floor distance when present — no new math. */
function mapTotalLossProxy(
  buffers: BufferSlice[],
  _currency: string,
): BufferViewModel | undefined {
  const row = buffers.find((b) => b.id === "drawdown");
  if (!row) {
    return {
      id: "total_loss",
      labelKey: "propPass.buffer.totalLoss",
      remainingMinor: null,
      limitMinor: null,
      status: "unsupported",
      ratio: null,
      limitations: ["buffer_unsupported"],
      accessibilityKey: "propPass.a11y.bufferUnsupported",
    };
  }
  return {
    id: "total_loss",
    labelKey: "propPass.buffer.totalLoss",
    remainingMinor: row.remainingMinor,
    limitMinor: row.limitMinor,
    status:
      row.remainingMinor == null || row.limitMinor == null ? "unsupported" : row.status,
    ratio:
      row.remainingMinor != null && row.limitMinor != null && row.limitMinor !== 0
        ? Math.max(0, Math.min(1, row.remainingMinor / row.limitMinor))
        : null,
    limitations: row.limitations,
    accessibilityKey:
      row.status === "hard"
        ? "propPass.a11y.bufferExhausted"
        : "propPass.a11y.bufferStatus",
  };
}
