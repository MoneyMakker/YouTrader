import { ALLOWED_TRADE_SYMBOLS, SECURITY_LIMITS } from "./securityConfig";

export type ValidatedTradeInput = {
  symbol: string;
  direction: "LONG" | "SHORT";
  entry: number | null;
  exit: number | null;
  contracts: number;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number;
  mood: string;
  notes: string;
  tags?: string[];
};

function stripDangerousText(value: string, maxLength: number) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeNumber(value: unknown, fallback: number | null = null) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function sanitizeTradeText(value: string, maxLength: number = SECURITY_LIMITS.noteMaxLength) {
  return stripDangerousText(value || "", maxLength);
}

export function validateTradeInput(input: ValidatedTradeInput) {
  const symbol = sanitizeTradeText(input.symbol, SECURITY_LIMITS.symbolMaxLength).toUpperCase();
  const direction: "LONG" | "SHORT" = input.direction === "SHORT" ? "SHORT" : "LONG";
  const contracts = Math.max(1, Math.min(1000, Math.round(safeNumber(input.contracts, 1) || 1)));
  const pnl = safeNumber(input.pnl, 0);
  const entry = safeNumber(input.entry);
  const exit = safeNumber(input.exit);
  const stopLoss = safeNumber(input.stopLoss);
  const takeProfit = safeNumber(input.takeProfit);
  const mood = sanitizeTradeText(input.mood, SECURITY_LIMITS.moodMaxLength) || "Focused";
  const notes = sanitizeTradeText(input.notes, SECURITY_LIMITS.noteMaxLength);
  const tags = (input.tags || [])
    .slice(0, SECURITY_LIMITS.maxTags)
    .map((tag) => sanitizeTradeText(tag, SECURITY_LIMITS.tagMaxLength))
    .filter(Boolean);

  const errors: string[] = [];
  if (!ALLOWED_TRADE_SYMBOLS.includes(symbol as any) && !/^[A-Z0-9./-]{1,12}$/.test(symbol)) {
    errors.push("Invalid symbol");
  }
  if (pnl == null || Math.abs(pnl) > 10_000_000) errors.push("Invalid P&L");
  for (const [label, value] of Object.entries({ entry, exit, stopLoss, takeProfit })) {
    if (value != null && (value < 0 || value > 10_000_000)) errors.push(`Invalid ${label}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      symbol,
      direction,
      entry,
      exit,
      contracts,
      stopLoss,
      takeProfit,
      pnl: Number((pnl || 0).toFixed(2)),
      mood,
      notes,
      tags,
    },
  };
}

export function validateImportedRows(rowCount: number, byteLength: number) {
  if (byteLength > SECURITY_LIMITS.csvMaxBytes) return { ok: false, reason: "too_large" as const };
  if (rowCount > SECURITY_LIMITS.csvMaxRows) return { ok: false, reason: "too_many_rows" as const };
  return { ok: true, reason: "" as const };
}
