/**
 * Resolve signed Trade P&L from the unified +/- amount control.
 * Amount is absolute; sign applies profit/loss. Empty is never a fake zero result.
 */

export type TradePnlSign = "plus" | "minus";

/** @deprecated Prefer TradePnlSign — kept for older fixtures during transition. */
export type PnlEntryMode = "calculate" | "manual";
/** @deprecated Prefer TradePnlSign. */
export type ManualPnlResultType = "profit" | "loss" | "breakeven";

export function parseAbsolutePnlAmount(raw: string): number | null {
  const cleaned = String(raw || "")
    .trim()
    .replace(/[$€£\s]/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number(n.toFixed(2));
}

/**
 * Authoritative signed P&L from the Trade P&L control.
 * Empty amount → error (never invent +$0.00).
 * Amount 0 with either sign → breakeven 0.
 */
export function resolveSignedTradePnl(
  amountRaw: string,
  sign: TradePnlSign,
): { ok: true; pnl: number } | { ok: false; error: "empty" | "invalid" } {
  const cleaned = String(amountRaw || "").trim();
  if (!cleaned) return { ok: false, error: "empty" };
  const abs = parseAbsolutePnlAmount(cleaned);
  if (abs == null) return { ok: false, error: "invalid" };
  if (abs === 0) return { ok: true, pnl: 0 };
  return { ok: true, pnl: sign === "minus" ? -Math.abs(abs) : Math.abs(abs) };
}

/** Legacy Manual path — maps result type onto signed resolution. */
export function resolveManualSignedPnl(
  amountRaw: string,
  resultType: ManualPnlResultType,
): { ok: true; pnl: number } | { ok: false; error: "empty" | "invalid" } {
  if (resultType === "breakeven") {
    const cleaned = String(amountRaw || "").trim();
    if (!cleaned || parseAbsolutePnlAmount(cleaned) === 0) return { ok: true, pnl: 0 };
    return resolveSignedTradePnl("0", "plus");
  }
  return resolveSignedTradePnl(amountRaw, resultType === "loss" ? "minus" : "plus");
}

export function inferTradePnlSign(pnl: number): TradePnlSign {
  return pnl < 0 ? "minus" : "plus";
}

export function inferManualResultType(pnl: number): ManualPnlResultType {
  if (pnl > 0) return "profit";
  if (pnl < 0) return "loss";
  return "breakeven";
}

export function formatAbsolutePnlAmount(pnl: number): string {
  return Math.abs(Number(pnl) || 0).toFixed(2);
}
