export type MetricConfidence = "low" | "medium" | "high";

export type TradeInput = {
  id?: string;
  userId?: string | null;
  date?: string;
  symbol?: string;
  instrument?: string;
  direction?: "LONG" | "SHORT" | "long" | "short" | string;
  side?: "long" | "short" | string;
  entryTime?: string | null;
  exitTime?: string | null;
  entry?: number | null;
  exit?: number | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  contracts?: number | null;
  quantity?: number | null;
  pnl?: number | null;
  fees?: number | null;
  tags?: string[];
  mood?: string | null;
  notes?: string | null;
  photoUri?: string | null;
  voiceUri?: string | null;
  screenshots?: string[];
  stopLoss?: number | null;
  takeProfit?: number | null;
  plannedRisk?: number | null;
  accountBalanceBefore?: number | null;
};

export type NormalizedTrade = {
  id: string;
  userId: string | null;
  instrument: string;
  side: "long" | "short";
  entryPrice: number | null;
  exitPrice: number | null;
  quantity: number;
  pnl: number;
  fees: number;
  netPnl: number;
  date: string;
  session: string;
  hour: number | null;
  dayOfWeek: string;
  week: string;
  month: string;
  tags: string[];
  mood: string;
  notes: string;
  screenshots: string[];
  stopLoss: number | null;
  takeProfit: number | null;
  riskAmount: number | null;
  plannedRisk: number | null;
  actualRisk: number | null;
  rMultiple: number | null;
  isWin: boolean;
  isLoss: boolean;
  isBreakeven: boolean;
  duration: number | null;
  accountBalanceBefore: number | null;
  accountBalanceAfter: number | null;
  confidence: MetricConfidence;
  missingFields: string[];
};

function asNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeDate(value?: string) {
  const raw = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
}

function parseHour(time?: string | null) {
  if (!time) return null;
  const match = String(time).match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour >= 0 && hour <= 23 ? hour : null;
}

import { t } from "../i18n";

export function sessionForHour(hour: number | null) {
  if (hour == null) return t("sessionUnknown");
  if (hour < 8) return t("sessionAsia");
  if (hour < 12) return hour >= 9 ? t("sessionNewYorkAm") : t("sessionLondon");
  if (hour < 14) return t("sessionMidday");
  if (hour >= 15 && hour < 16) return t("microPowerHour");
  if (hour >= 16) return t("sessionAfterHours");
  return t("sessionAfternoon");
}

function weekKey(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start.toISOString().slice(0, 10);
}

function riskAmountForTrade(input: TradeInput, entryPrice: number | null, quantity: number) {
  const plannedRisk = asNumber(input.plannedRisk);
  if (plannedRisk != null && plannedRisk > 0) return plannedRisk;
  const stopLoss = asNumber(input.stopLoss);
  if (entryPrice == null || stopLoss == null) return null;
  const risk = Math.abs(entryPrice - stopLoss) * Math.max(1, quantity);
  return risk > 0 ? risk : null;
}

export function normalizeTradeForAnalytics(input: TradeInput): NormalizedTrade {
  const missingFields: string[] = [];
  const date = normalizeDate(input.date);
  const parsedDate = new Date(`${date}T00:00:00Z`);
  const entryPrice = asNumber(input.entryPrice ?? input.entry);
  const exitPrice = asNumber(input.exitPrice ?? input.exit);
  const quantity = Math.max(1, asNumber(input.quantity ?? input.contracts) || 1);
  const pnl = asNumber(input.pnl) || 0;
  const fees = Math.max(0, asNumber(input.fees) || 0);
  const netPnl = Number((pnl - fees).toFixed(2));
  const hour = parseHour(input.entryTime || input.exitTime);
  const sideRaw = String(input.side || input.direction || "long").toLowerCase();
  const side = sideRaw.includes("short") ? "short" : "long";
  const riskAmount = riskAmountForTrade(input, entryPrice, quantity);
  const plannedRisk = asNumber(input.plannedRisk);
  const actualRisk = riskAmount;
  const rMultiple = riskAmount && riskAmount > 0 ? Number((netPnl / riskAmount).toFixed(2)) : null;
  const accountBalanceBefore = asNumber(input.accountBalanceBefore);
  const accountBalanceAfter = accountBalanceBefore == null ? null : Number((accountBalanceBefore + netPnl).toFixed(2));

  if (!input.symbol && !input.instrument) missingFields.push("instrument");
  if (entryPrice == null) missingFields.push("entryPrice");
  if (exitPrice == null) missingFields.push("exitPrice");
  if (riskAmount == null) missingFields.push("riskAmount");

  return {
    id: String(input.id || `${date}-${Math.random().toString(36).slice(2, 10)}`),
    userId: input.userId || null,
    instrument: String(input.instrument || input.symbol || "UNKNOWN").toUpperCase(),
    side,
    entryPrice,
    exitPrice,
    quantity,
    pnl,
    fees,
    netPnl,
    date,
    session: sessionForHour(hour),
    hour,
    dayOfWeek: parsedDate.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    week: weekKey(parsedDate),
    month: date.slice(0, 7),
    tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : [],
    mood: String(input.mood || "Unknown"),
    notes: String(input.notes || ""),
    screenshots: input.screenshots || [input.photoUri].filter(Boolean) as string[],
    stopLoss: asNumber(input.stopLoss),
    takeProfit: asNumber(input.takeProfit),
    riskAmount,
    plannedRisk,
    actualRisk,
    rMultiple,
    isWin: netPnl > 0,
    isLoss: netPnl < 0,
    isBreakeven: netPnl === 0,
    duration: null,
    accountBalanceBefore,
    accountBalanceAfter,
    confidence: missingFields.length >= 3 ? "low" : missingFields.length ? "medium" : "high",
    missingFields,
  };
}

export function normalizeTradesForAnalytics(trades: TradeInput[]) {
  return trades.map(normalizeTradeForAnalytics).sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`));
}

export function confidenceForSampleSize(count: number): MetricConfidence {
  if (count < 10) return "low";
  if (count <= 30) return "medium";
  return "high";
}
