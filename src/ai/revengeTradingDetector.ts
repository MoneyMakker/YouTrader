/**
 * Deterministic revenge-trading risk signal for Prop Coach / AI OS.
 * Client-only. No cloud calls. Educational severity/reason/recommendation only.
 *
 * Input contract:
 * - `trades`: journal rows in oldest→newest order (last items = most recent).
 * - `selectedDate`: ISO date string `YYYY-MM-DD` matching `trade.date`.
 * - `dangerMode`: optional external risk flag (e.g. prop pass-probability DANGER).
 *   Elevates severity / can contribute to detection only when loss evidence exists.
 *
 * Empty selected day:
 * - Falls back to the last `RECENT_WINDOW` trades in the journal.
 * - Flags when recent loss density or trailing consecutive losses meet thresholds.
 * - Empty / insufficient journal → not detected (no false positive).
 *
 * Selected day with trades:
 * - Preserves prior semantics: dangerMode OR losses≥2 OR tradeCount≥5.
 */

export type TradeLike = { pnl: number; date?: string };

export type RevengeSeverity = "LOW" | "MEDIUM" | "HIGH";

export type RevengeTradingResult = {
  detected: boolean;
  severity: RevengeSeverity;
  reason: string;
  recommendation: string;
};

export const REVENGE_TRADING_THRESHOLDS = {
  /** Most recent trades inspected when the selected day has no rows. */
  RECENT_WINDOW: 8,
  /** Losses inside the recent window that flag empty-day risk. */
  EMPTY_DAY_MIN_RECENT_LOSSES: 3,
  /** Trailing consecutive losses (from newest backward) that flag empty-day risk. */
  EMPTY_DAY_MIN_CONSECUTIVE_LOSSES: 3,
  /**
   * Minimum recent losses required before `dangerMode` may contribute to empty-day detection.
   * Prevents dangerMode-alone false positives on quiet / winning recent history.
   */
  EMPTY_DAY_DANGER_MIN_RECENT_LOSSES: 2,
  /** Same-day loss count that flags risk (legacy). */
  DAY_MIN_LOSSES: 2,
  /** Same-day trade count that flags overtrading risk (legacy). */
  DAY_OVERTRADE_COUNT: 5,
  /** Same-day loss count that forces HIGH severity (legacy). */
  DAY_HIGH_LOSSES: 3,
} as const;

const PAUSE_RECOMMENDATION = "Pause, review screenshots/notes, and do not increase size after losses.";
const KEEP_RECOMMENDATION = "Keep following the checklist and fixed risk.";

function clearResult(reason: string): RevengeTradingResult {
  return {
    detected: false,
    severity: "LOW",
    reason,
    recommendation: KEEP_RECOMMENDATION,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeTrades(trades: TradeLike[] | null | undefined): TradeLike[] {
  if (!Array.isArray(trades)) return [];
  return trades.filter((trade) => trade && isFiniteNumber(trade.pnl));
}

function isLoss(trade: TradeLike): boolean {
  return trade.pnl < 0;
}

/** Count trailing consecutive losses assuming oldest→newest order. */
export function countTrailingConsecutiveLosses(trades: TradeLike[]): number {
  let count = 0;
  for (let index = trades.length - 1; index >= 0; index -= 1) {
    if (!isLoss(trades[index])) break;
    count += 1;
  }
  return count;
}

export function detectRevengeTrading({
  trades,
  selectedDate,
  dangerMode = false,
}: {
  trades: TradeLike[] | null | undefined;
  selectedDate: string | null | undefined;
  dangerMode?: boolean;
}): RevengeTradingResult {
  const safeTrades = normalizeTrades(trades);
  if (typeof selectedDate !== "string" || !selectedDate.trim()) {
    return clearResult("No clear revenge-trading pattern — selected date is missing.");
  }

  const today = safeTrades.filter((trade) => trade.date === selectedDate);
  const losses = today.filter(isLoss).length;
  const T = REVENGE_TRADING_THRESHOLDS;

  if (today.length === 0) {
    if (safeTrades.length === 0) {
      return clearResult("No clear revenge-trading pattern — journal is empty.");
    }

    const recent = safeTrades.slice(-T.RECENT_WINDOW);
    const recentLosses = recent.filter(isLoss).length;
    const consecutiveLosses = countTrailingConsecutiveLosses(recent);
    const densitySignal = recentLosses >= T.EMPTY_DAY_MIN_RECENT_LOSSES;
    const streakSignal = consecutiveLosses >= T.EMPTY_DAY_MIN_CONSECUTIVE_LOSSES;
    const dangerWithEvidence =
      Boolean(dangerMode) && recentLosses >= T.EMPTY_DAY_DANGER_MIN_RECENT_LOSSES;
    const detected = densitySignal || streakSignal || dangerWithEvidence;

    if (!detected) {
      return clearResult("No clear revenge-trading pattern in recent journal behavior.");
    }

    const severity: RevengeSeverity =
      streakSignal || recentLosses >= T.EMPTY_DAY_MIN_RECENT_LOSSES + 1 || (dangerMode && (densitySignal || streakSignal))
        ? "HIGH"
        : "MEDIUM";

    return {
      detected: true,
      severity,
      reason: `Recent journal shows ${recentLosses} losses across the last ${recent.length} trades — emotional risk is based on recent behavior, not today.`,
      recommendation: PAUSE_RECOMMENDATION,
    };
  }

  // Selected-day path: preserve prior detection semantics.
  const detected = Boolean(dangerMode || losses >= T.DAY_MIN_LOSSES || today.length >= T.DAY_OVERTRADE_COUNT);
  const severity: RevengeSeverity =
    dangerMode || losses >= T.DAY_HIGH_LOSSES ? "HIGH" : detected ? "MEDIUM" : "LOW";

  return {
    detected,
    severity,
    reason: detected
      ? `${today.length} trades today with ${losses} losses suggests elevated emotional risk.`
      : "No clear revenge-trading pattern in the selected day.",
    recommendation: detected ? PAUSE_RECOMMENDATION : KEEP_RECOMMENDATION,
  };
}
