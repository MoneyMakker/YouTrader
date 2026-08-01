/**
 * Prop Pass presentation helpers — map snapshot view models to product UI states.
 * Does not recalculate immutable challenge truth.
 */

import { formatPropMoney, formatPropMoneyA11y } from "./formatMoney";
import type { BufferViewModel, PropPassViewModel } from "./types";

export type ChallengeHeroStatus =
  | "on_track"
  | "caution"
  | "at_risk"
  | "passed"
  | "violated"
  | "insufficient_data";

export type ReadinessLabel = "high" | "moderate" | "low" | "more_data_needed";

export type BufferDisplayStatus = "healthy" | "caution" | "danger" | "unavailable";

const INSUFFICIENT_ASSIGNED_TRADES = 3;

export function humanAccountTitle(model: PropPassViewModel): string {
  const firm = sanitizeDisplayLabel(model.account.firmName) || "Prop";
  const size =
    model.account.accountSize != null
      ? formatPropMoney(model.account.accountSize.minor, {
          currency: model.account.accountSize.currency,
          maximumFractionDigits: 0,
          minimumFractionDigits: 0,
        }).replace(/\.00$/, "")
      : null;
  const phase = humanPhaseLabel(model.challenge.status, model.challenge.attemptNumber);
  if (size) return `${firm} ${size} · ${phase}`;
  return `${firm} · ${phase}`;
}

/** Strip fixture/staging noise and never return raw UUIDs. */
export function sanitizeDisplayLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (looksLikeUuid(trimmed)) return null;
  if (/^fixture[_-]/i.test(trimmed)) return null;
  if (/^qa[_-]/i.test(trimmed)) return null;
  if (/^staging[_-]/i.test(trimmed)) return null;
  return trimmed;
}

export function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function humanPhaseLabel(status: string, attemptNumber: number): string {
  const s = status.toLowerCase();
  if (s.includes("fund") || s === "funded") return "Funded";
  if (s.includes("phase_2") || s.includes("phase2")) return "Phase 2";
  if (s.includes("phase_1") || s.includes("phase1") || s.includes("eval")) return "Phase 1";
  if (attemptNumber > 1) return `Attempt ${attemptNumber}`;
  return "Phase 1";
}

export function mapChallengeHeroStatus(model: PropPassViewModel): ChallengeHeroStatus {
  const lifecycle = model.challenge.status.toLowerCase();
  if (lifecycle.includes("pass") || lifecycle === "funded") return "passed";
  if (
    lifecycle.includes("breach") ||
    lifecycle.includes("fail") ||
    lifecycle.includes("violat") ||
    lifecycle === "abandoned"
  ) {
    return "violated";
  }

  if (model.assignedTradeCount < INSUFFICIENT_ASSIGNED_TRADES) {
    const hasDangerBuffer = [model.buffers.dailyLoss, model.buffers.trailingDrawdown, model.buffers.totalLoss]
      .filter(Boolean)
      .some((b) => b!.status === "hard" || b!.status === "warn");
    if (!hasDangerBuffer && model.progress.profitRemaining == null) {
      return "insufficient_data";
    }
  }

  const daily = model.buffers.dailyLoss;
  const trailing = model.buffers.trailingDrawdown;
  const total = model.buffers.totalLoss;
  if (daily?.status === "hard" || trailing?.status === "hard" || total?.status === "hard") {
    return "at_risk";
  }
  if (daily?.status === "warn" || trailing?.status === "warn" || total?.status === "warn") {
    return "caution";
  }
  return "on_track";
}

/**
 * Deterministic readiness from existing server score only.
 * Source: shadow snapshot readiness.score (0–100). No pass probability invented.
 * - score >= 70 → High
 * - score >= 40 → Moderate
 * - score > 0 → Low
 * - null / withheld / <3 assigned trades → More Data Needed
 */
export function mapReadinessLabel(model: PropPassViewModel): ReadinessLabel {
  if (model.readiness.lifecycleOverride) return "more_data_needed";
  if (model.assignedTradeCount < INSUFFICIENT_ASSIGNED_TRADES) return "more_data_needed";
  const score = model.readiness.score;
  if (score == null || score <= 0) return "more_data_needed";
  if (score >= 70) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

export function mapBufferDisplayStatus(buffer: BufferViewModel | undefined): BufferDisplayStatus {
  if (!buffer || buffer.status === "unsupported" || buffer.ratio == null) return "unavailable";
  if (buffer.status === "hard") return "danger";
  if (buffer.status === "warn") return "caution";
  return "healthy";
}

export function bufferUsedMinor(buffer: BufferViewModel | undefined): number | null {
  if (!buffer || buffer.limitMinor == null || buffer.remainingMinor == null) return null;
  return Math.max(0, buffer.limitMinor - buffer.remainingMinor);
}

export function bufferUsedPercent(buffer: BufferViewModel | undefined): number | null {
  if (!buffer || buffer.limitMinor == null || buffer.limitMinor === 0 || buffer.remainingMinor == null) {
    return null;
  }
  const used = buffer.limitMinor - buffer.remainingMinor;
  return Math.max(0, Math.min(100, Math.round((used / buffer.limitMinor) * 100)));
}

export function bufferRemainingPercent(buffer: BufferViewModel | undefined): number | null {
  if (buffer?.ratio == null) return null;
  return Math.max(0, Math.min(100, Math.round(buffer.ratio * 100)));
}

export function progressPercent(model: PropPassViewModel): number | null {
  const target = model.progress.profitTarget?.minor;
  const remaining = model.progress.profitRemaining?.minor;
  if (target == null || target <= 0 || remaining == null) return null;
  const earned = Math.max(0, target - remaining);
  return Math.max(0, Math.min(100, Math.round((earned / target) * 100)));
}

export function currentProfitMinor(model: PropPassViewModel): number | null {
  const target = model.progress.profitTarget?.minor;
  const remaining = model.progress.profitRemaining?.minor;
  if (target == null || remaining == null) return null;
  return target - remaining;
}

export function formatRelativeUpdated(iso: string | undefined, nowMs = Date.now()): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const deltaSec = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (deltaSec < 60) return "Updated just now";
  if (deltaSec < 3600) {
    const m = Math.floor(deltaSec / 60);
    return `Updated ${m} min ago`;
  }
  if (deltaSec < 86400) {
    const h = Math.floor(deltaSec / 3600);
    return `Updated ${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(deltaSec / 86400);
  return `Updated ${d} day${d === 1 ? "" : "s"} ago`;
}

export function moneyOrDash(
  minor: number | null | undefined,
  currency = "USD",
): { display: string; a11y: string } {
  return {
    display: formatPropMoney(minor, { currency }),
    a11y: formatPropMoneyA11y(minor, { currency }),
  };
}

export function tradesNeededForInsights(assignedTradeCount: number): number {
  return Math.max(0, INSUFFICIENT_ASSIGNED_TRADES - assignedTradeCount);
}

export { INSUFFICIENT_ASSIGNED_TRADES };
