/**
 * Resolve signed P&L from Manual entry controls.
 * Amount is absolute; result type applies the sign. One sign system only.
 */

export type PnlEntryMode = "calculate" | "manual";
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

export function resolveManualSignedPnl(
  amountRaw: string,
  resultType: ManualPnlResultType,
): { ok: true; pnl: number } | { ok: false; error: "empty" | "invalid" } {
  if (resultType === "breakeven") {
    return { ok: true, pnl: 0 };
  }
  const abs = parseAbsolutePnlAmount(amountRaw);
  if (abs == null) {
    return { ok: false, error: String(amountRaw || "").trim() ? "invalid" : "empty" };
  }
  if (resultType === "loss") return { ok: true, pnl: -Math.abs(abs) };
  return { ok: true, pnl: Math.abs(abs) };
}

export function inferManualResultType(pnl: number): ManualPnlResultType {
  if (pnl > 0) return "profit";
  if (pnl < 0) return "loss";
  return "breakeven";
}
