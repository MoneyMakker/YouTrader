export type SmartTradeInput = {
  id?: string;
  date: string;
  pnl: number;
  notes?: string;
  tags?: string[];
  photoUri?: string | null;
  voiceUri?: string | null;
  entryTime?: string | null;
  symbol?: string;
};

export type CalendarEventInput = {
  id: string;
  date: string;
  time: string;
  name: string;
};

export type PropRiskSnapshotInput = {
  dailyRemaining: number;
  dailyLossLimit: number;
  dayPnl: number;
  status: string;
  enabled: boolean;
};

export type SmartAlertAnalysis = {
  todayIso: string;
  tradesToday: number;
  lastTradeDate: string | null;
  daysSinceLastTrade: number | null;
  dayPnl: number;
  dayHighPnl: number;
  lossStreakToday: number;
  winStreakToday: number;
  weeklyWinRate: number | null;
  previousWeeklyWinRate: number | null;
  weeklyTradeCount: number;
  previousWeeklyTradeCount: number;
  avgDailyTradeCount30d: number;
  todayTradeCount: number;
  notesCompletenessRatio: number;
  nearDailyLossLimit: boolean;
  dailyLossLimitReached: boolean;
  propBufferTight: boolean;
  profitGivebackDetected: boolean;
  overtradingToday: boolean;
  revengeTradingToday: boolean;
  consistencyGap: boolean;
  enoughDataForWinRateAlert: boolean;
  enoughDataForAiCoach: boolean;
  bestSessionHour: number | null;
  upcomingEvents: { alertId: "cpi_30_min_alert" | "fomc_30_min_alert" | "nfp_30_min_alert"; atMs: number }[];
};

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateMs(date: string) {
  const ms = Date.parse(`${date}T12:00:00`);
  return Number.isFinite(ms) ? ms : null;
}

function daysBetween(a: string, b: string) {
  const am = parseDateMs(a);
  const bm = parseDateMs(b);
  if (am == null || bm == null) return null;
  return Math.floor((bm - am) / (24 * 60 * 60 * 1000));
}

function weekStartIso(dateIso: string) {
  const d = new Date(`${dateIso}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function winRateForTrades(trades: SmartTradeInput[]) {
  if (!trades.length) return null;
  const wins = trades.filter((t) => t.pnl > 0).length;
  return (wins / trades.length) * 100;
}

function parseEventDateTimeMs(event: CalendarEventInput) {
  const time = event.time?.trim() || "09:30";
  const ms = Date.parse(`${event.date}T${time}:00`);
  return Number.isFinite(ms) ? ms : null;
}

function matchEventAlert(name: string): SmartAlertAnalysis["upcomingEvents"][number]["alertId"] | null {
  const n = name.toUpperCase();
  if (n.includes("CPI") || n.includes("CONSUMER PRICE")) return "cpi_30_min_alert";
  if (n.includes("FOMC") || n.includes("FED") && n.includes("RATE")) return "fomc_30_min_alert";
  if (n.includes("NFP") || n.includes("NON-FARM") || n.includes("NONFARM")) return "nfp_30_min_alert";
  return null;
}

export function analyzeSmartAlertData(input: {
  trades: SmartTradeInput[];
  calendarEvents?: CalendarEventInput[];
  propSnapshot?: PropRiskSnapshotInput | null;
  nowMs?: number;
}): SmartAlertAnalysis {
  const todayIso = todayIsoLocal();
  const nowMs = input.nowMs ?? Date.now();
  const trades = input.trades.filter((t) => t.date);
  const todayTrades = trades.filter((t) => t.date === todayIso);
  const sortedDates = [...new Set(trades.map((t) => t.date))].sort();
  const lastTradeDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : null;
  const daysSinceLastTrade = lastTradeDate ? daysBetween(lastTradeDate, todayIso) : null;

  let dayPnl = 0;
  let dayHighPnl = 0;
  let running = 0;
  let lossStreakToday = 0;
  let winStreakToday = 0;
  let maxLossStreak = 0;
  for (const trade of todayTrades.sort((a, b) => (a.entryTime || "").localeCompare(b.entryTime || ""))) {
    running += trade.pnl;
    dayPnl = running;
    dayHighPnl = Math.max(dayHighPnl, running);
    if (trade.pnl < 0) {
      lossStreakToday += 1;
      winStreakToday = 0;
      maxLossStreak = Math.max(maxLossStreak, lossStreakToday);
    } else if (trade.pnl > 0) {
      winStreakToday += 1;
      lossStreakToday = 0;
    }
  }
  lossStreakToday = maxLossStreak;

  const thisWeekStart = weekStartIso(todayIso);
  const prevWeekStartDate = new Date(`${thisWeekStart}T12:00:00`);
  prevWeekStartDate.setDate(prevWeekStartDate.getDate() - 7);
  const prevWeekStart = `${prevWeekStartDate.getFullYear()}-${String(prevWeekStartDate.getMonth() + 1).padStart(2, "0")}-${String(prevWeekStartDate.getDate()).padStart(2, "0")}`;

  const thisWeekTrades = trades.filter((t) => t.date >= thisWeekStart && t.date <= todayIso);
  const prevWeekEndDate = new Date(`${thisWeekStart}T12:00:00`);
  prevWeekEndDate.setDate(prevWeekEndDate.getDate() - 1);
  const prevWeekEnd = `${prevWeekEndDate.getFullYear()}-${String(prevWeekEndDate.getMonth() + 1).padStart(2, "0")}-${String(prevWeekEndDate.getDate()).padStart(2, "0")}`;
  const prevWeekTrades = trades.filter((t) => t.date >= prevWeekStart && t.date <= prevWeekEnd);

  const weeklyWinRate = winRateForTrades(thisWeekTrades);
  const previousWeeklyWinRate = winRateForTrades(prevWeekTrades);

  const last30Start = new Date(nowMs);
  last30Start.setDate(last30Start.getDate() - 30);
  const last30Iso = `${last30Start.getFullYear()}-${String(last30Start.getMonth() + 1).padStart(2, "0")}-${String(last30Start.getDate()).padStart(2, "0")}`;
  const last30Trades = trades.filter((t) => t.date >= last30Iso);
  const dayCounts = new Map<string, number>();
  last30Trades.forEach((t) => dayCounts.set(t.date, (dayCounts.get(t.date) || 0) + 1));
  const activeDays = dayCounts.size || 1;
  const avgDailyTradeCount30d = last30Trades.length / activeDays;

  const recentWithContext = trades.slice(-40);
  const withContext = recentWithContext.filter(
    (t) => (t.notes || "").trim().length > 0 || (t.tags?.length || 0) > 0 || t.photoUri || t.voiceUri,
  );
  const notesCompletenessRatio = recentWithContext.length
    ? withContext.length / recentWithContext.length
    : 1;

  const prop = input.propSnapshot;
  const nearDailyLossLimit = Boolean(
    prop?.enabled &&
      prop.dailyLossLimit > 0 &&
      prop.dailyRemaining <= prop.dailyLossLimit * 0.2 &&
      prop.dailyRemaining > 0,
  );
  const dailyLossLimitReached = Boolean(
    prop?.enabled && (prop.status === "STOP" || prop.dailyRemaining <= 0),
  );
  const propBufferTight = Boolean(
    prop?.enabled &&
      prop.dailyLossLimit > 0 &&
      prop.dailyRemaining <= prop.dailyLossLimit * 0.15,
  );

  const profitGivebackDetected = dayHighPnl > 0 && dayPnl > 0 && dayPnl <= dayHighPnl * 0.5;
  const overtradingToday =
    todayTrades.length >= 5 && todayTrades.length > avgDailyTradeCount30d * 1.5;
  const revengeTradingToday = lossStreakToday >= 3;
  const consistencyGap = recentWithContext.length >= 5 && notesCompletenessRatio < 0.45;

  const hourBuckets = new Map<number, { wins: number; total: number }>();
  trades.forEach((t) => {
    const hour = t.entryTime ? Number(t.entryTime.split(":")[0]) : null;
    if (hour == null || Number.isNaN(hour)) return;
    const bucket = hourBuckets.get(hour) || { wins: 0, total: 0 };
    bucket.total += 1;
    if (t.pnl > 0) bucket.wins += 1;
    hourBuckets.set(hour, bucket);
  });
  let bestSessionHour: number | null = null;
  let bestRate = -1;
  hourBuckets.forEach((bucket, hour) => {
    if (bucket.total < 5) return;
    const rate = bucket.wins / bucket.total;
    if (rate > bestRate) {
      bestRate = rate;
      bestSessionHour = hour;
    }
  });

  const upcomingEvents: SmartAlertAnalysis["upcomingEvents"] = [];
  for (const event of input.calendarEvents || []) {
    const alertId = matchEventAlert(event.name);
    const eventMs = parseEventDateTimeMs(event);
    if (!alertId || eventMs == null) continue;
    const notifyAt = eventMs - 30 * 60 * 1000;
    if (notifyAt > nowMs && notifyAt - nowMs < 7 * 24 * 60 * 60 * 1000) {
      upcomingEvents.push({ alertId, atMs: notifyAt });
    }
  }

  return {
    todayIso,
    tradesToday: todayTrades.length,
    lastTradeDate,
    daysSinceLastTrade,
    dayPnl,
    dayHighPnl,
    lossStreakToday,
    winStreakToday,
    weeklyWinRate,
    previousWeeklyWinRate,
    weeklyTradeCount: thisWeekTrades.length,
    previousWeeklyTradeCount: prevWeekTrades.length,
    avgDailyTradeCount30d,
    todayTradeCount: todayTrades.length,
    notesCompletenessRatio,
    nearDailyLossLimit,
    dailyLossLimitReached,
    propBufferTight,
    profitGivebackDetected,
    overtradingToday,
    revengeTradingToday,
    consistencyGap,
    enoughDataForWinRateAlert:
      thisWeekTrades.length >= 5 &&
      prevWeekTrades.length >= 5 &&
      weeklyWinRate != null &&
      previousWeeklyWinRate != null &&
      previousWeeklyWinRate - weeklyWinRate >= 10,
    enoughDataForAiCoach: trades.length >= 15,
    bestSessionHour,
    upcomingEvents,
  };
}
