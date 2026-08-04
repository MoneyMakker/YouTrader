import type { Trade } from "../types";
import { t } from "../../i18n";
import { calculateTradingScore } from "../../analytics/tradingScore";
import { safeDateFromISO, tradeTimestampFromClock } from "./dates";
import { buildUnifiedTradeAnalytics, drawdownControlFromMetrics, infinitySafeMetric } from "../../analytics/tradeMetrics";

export function getTradeTime(t: Trade) {
  if (t.entryTime) return new Date(tradeTimestampFromClock(t.date, t.entryTime));
  const raw = (t as any).createdAt || t.id?.split("-")[0];
  const n = Number(raw);
  return Number.isFinite(n) && n > 1000000000 ? new Date(n) : safeDateFromISO(t.date);
}
export function rrForTrade(t: Trade) {
  const sl = Number(t.stopLoss ?? 0);
  const tp = Number(t.takeProfit ?? 0);
  const entry = t.entry == null ? null : Number(t.entry);

  if (entry != null && Number.isFinite(entry) && sl && tp) {
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    if (risk > 0 && Number.isFinite(reward)) return reward / risk;
  }

  // Fallback for users who enter Stop Loss / Take Profit as dollar or point values.
  // This keeps Avg R:R working even when entry/exit prices are left empty.
  if (sl > 0 && tp > 0 && Number.isFinite(sl) && Number.isFinite(tp)) {
    return tp / sl;
  }

  return null;
}
export function maxDrawdownFromTrades(trades: Trade[]) {
  const ordered = [...trades].sort((a, b) => getTradeTime(a).getTime() - getTradeTime(b).getTime());
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  const curve: number[] = [];
  ordered.forEach((t) => {
    equity += t.pnl;
    curve.push(equity);
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  });
  return { maxDd, curve };
}

export function fullWeekdayName(label: string) {
  const map: Record<string, string> = {
    Sun: t("weekdaySunday"),
    Mon: t("weekdayMonday"),
    Tue: t("weekdayTuesday"),
    Wed: t("weekdayWednesday"),
    Thu: t("weekdayThursday"),
    Fri: t("weekdayFriday"),
    Sat: t("weekdaySaturday"),
    Sunday: t("weekdaySunday"),
    Monday: t("weekdayMonday"),
    Tuesday: t("weekdayTuesday"),
    Wednesday: t("weekdayWednesday"),
    Thursday: t("weekdayThursday"),
    Friday: t("weekdayFriday"),
    Saturday: t("weekdaySaturday"),
  };
  return map[label] || label;
}

export type PerformanceGroup = {
  label: string;
  pnl: number;
  count: number;
  wins: number;
  wr: number;
};

export function groupPerformance(trades: Trade[], keyFn: (t: Trade) => string) {
  const map: Record<string, { pnl: number; count: number; wins: number }> = {};
  trades.forEach((t) => {
    const k = keyFn(t);
    if (!map[k]) map[k] = { pnl: 0, count: 0, wins: 0 };
    map[k].pnl += t.pnl;
    map[k].count += 1;
    if (t.pnl > 0) map[k].wins += 1;
  });
  return Object.entries(map)
    .map(([label, v]) => ({ label, ...v, wr: v.count ? (v.wins / v.count) * 100 : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}
export function extractStrategyTags(trade: Trade) {
  const noteTags = (trade.notes.match(/#[a-z0-9_-]{2,24}/gi) || []).map((tag) =>
    tag.replace(/^#/, "").toUpperCase(),
  );
  const explicitTags = (trade.tags || []).map((tag) => String(tag).replace(/^#/, "").toUpperCase());
  return [...new Set([...explicitTags, ...noteTags])].filter(Boolean).slice(0, 6);
}

export function sessionLabelForTrade(trade: Trade) {
  const h = getTradeTime(trade).getHours();
  if (h < 11) return t("sessionMorning");
  if (h < 14) return t("sessionMidday");
  return t("sessionAfternoon");
}

export function primarySetupLabel(trade: Trade) {
  const tags = extractStrategyTags(trade);
  return tags[0] ? `#${tags[0]}` : trade.symbol || "Manual";
}


export function buildDailySeries(trades: Trade[]) {
  const map: Record<string, number> = {};
  trades.forEach((t) => {
    const day = String(t.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    map[day] = (map[day] || 0) + t.pnl;
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
}


export function sharpeRatioFromDaily(daily: { value: number }[]) {
  if (daily.length < 2) return 0;
  const avg = daily.reduce((a, d) => a + d.value, 0) / daily.length;
  const variance = daily.reduce((a, d) => a + Math.pow(d.value - avg, 2), 0) / daily.length;
  const stdev = Math.sqrt(variance);
  if (!stdev) return avg > 0 ? 99 : 0;
  return avg / stdev;
}


export function dailyWinLossStreaks(daily: { value: number }[]) {
  let current: "win" | "loss" | null = null;
  let len = 0;
  let maxWin = 0;
  let maxLoss = 0;

  const flush = () => {
    if (current === "win") maxWin = Math.max(maxWin, len);
    if (current === "loss") maxLoss = Math.max(maxLoss, len);
  };

  daily.forEach((day) => {
    const kind = day.value > 0 ? "win" : day.value < 0 ? "loss" : null;
    if (!kind) {
      flush();
      current = null;
      len = 0;
      return;
    }
    if (kind === current) len += 1;
    else {
      flush();
      current = kind;
      len = 1;
    }
  });
  flush();

  return { maxWinDayStreak: maxWin, maxLossDayStreak: maxLoss };
}


export function calcStats(trades: Trade[]) {
  const unified = buildUnifiedTradeAnalytics(trades);
  const official = unified.metrics;
  const pnl = official.netPnl;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const wr = official.winRate || 0;
  const exp = official.expectancy || 0;
  const pf = infinitySafeMetric(official.profitFactor);
  const avgWin = official.averageWin;
  const avgLoss = official.averageLoss;
  const avgWinLoss = infinitySafeMetric(official.averageWinLossRatio);
  const rrs = trades.map(rrForTrade).filter((x): x is number => x != null && Number.isFinite(x));
  const avgRR = rrs.length ? rrs.reduce((a, x) => a + x, 0) / rrs.length : 0;
  const ordered = [...trades].sort((a, b) => getTradeTime(a).getTime() - getTradeTime(b).getTime());
  const winStreaks: number[] = [];
  const lossStreaks: number[] = [];
  let current: "win" | "loss" | null = null;
  let len = 0;
  const flush = () => {
    if (!current || len === 0) return;
    if (current === "win") winStreaks.push(len);
    if (current === "loss") lossStreaks.push(len);
  };
  ordered.forEach((t) => {
    const kind = t.pnl > 0 ? "win" : t.pnl < 0 ? "loss" : null;
    if (!kind) { flush(); current = null; len = 0; return; }
    if (kind === current) len += 1;
    else { flush(); current = kind; len = 1; }
  });
  flush();
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, x) => a + x, 0) / arr.length : 0;
  const daily = buildDailySeries(trades);
  const dayStreaks = dailyWinLossStreaks(daily);
  const dd = { maxDd: official.maxDrawdown, curve: unified.equityCurve.map((point) => point.cumulativePnl) };
  const weekday = groupPerformance(trades, (t) => safeDateFromISO(t.date).toLocaleDateString([], { weekday: "short", timeZone: "UTC" }));
  const session = groupPerformance(trades, sessionLabelForTrade);
  const bySetup = groupPerformance(trades, primarySetupLabel);
  const consistency = official.consistency;
  const recoveryFactor = infinitySafeMetric(official.recoveryFactor);
  const drawdownControl = drawdownControlFromMetrics(pnl, official.maxDrawdown);
  return {
    pnl,
    wr,
    exp,
    ev: exp,
    pf,
    count: trades.length,
    avgWinStreak: avg(winStreaks),
    avgLossStreak: avg(lossStreaks),
    avgWin,
    avgLoss,
    avgWinLoss,
    avgRR,
    sharpeRatio: sharpeRatioFromDaily(daily),
    maxWinDayStreak: dayStreaks.maxWinDayStreak,
    maxLossDayStreak: dayStreaks.maxLossDayStreak,
    maxDd: dd.maxDd,
    curve: dd.curve,
    consistency,
    recoveryFactor,
    drawdownControl,
    riskControl: official.riskControl,
    weekday,
    session,
    bySetup,
  };
}

export function tradingScoreForTrades(trades: Trade[]) {
  const stats = calcStats(trades);
  return calculateTradingScore({
    winRate: stats.wr,
    profitFactor: stats.pf,
    expectancy: stats.exp,
    consistency: stats.consistency,
    riskControl: stats.drawdownControl,
    recoveryFactor: stats.recoveryFactor,
    maxDrawdown: stats.maxDd,
    avgWinLossRatio: stats.avgWinLoss,
    tradeCount: stats.count,
  });
}

export function lowToHighPerformance(rows: ReturnType<typeof groupPerformance>) {
  return [...rows].sort((a, b) => a.pnl - b.pnl);
}
