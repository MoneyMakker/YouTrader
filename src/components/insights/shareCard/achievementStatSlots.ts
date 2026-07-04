import type { AchievementShareStats } from "./achievementHelpers";
import { t } from "../../../i18n";
import { money, pnlCompact, profitFactorCompact } from "./formatters";
import { statValueDesignSize } from "./shareCardTypography";

export type AchievementStatTone = "green" | "white" | "red" | "purple" | "gold";

export type AchievementStatSlot = {
  label: string;
  value: string;
  tone: AchievementStatTone;
};

type StatCandidate = {
  id: string;
  label: string;
  shortLabel: string;
  format: (stats: AchievementShareStats, hasTrades: boolean) => string;
  tone: (stats: AchievementShareStats, hasTrades: boolean) => AchievementStatTone;
  available: (stats: AchievementShareStats, hasTrades: boolean) => boolean;
};

function formatWinRate(value: number) {
  return `${Math.round(value)}%`;
}

function formatProfitFactor(value: number) {
  return profitFactorCompact(value);
}

function formatTradeCount(count: number) {
  return count.toLocaleString();
}

function formatWinStreak(streak: number) {
  if (streak <= 0) return "0";
  return String(streak);
}

function formatAvgRR(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}R` : `${rounded.toFixed(1)}R`;
}

function formatExpectancy(value: number, hasTrades: boolean) {
  if (!hasTrades) return "—";
  const abs = Math.abs(value);
  if (abs >= 10_000) return pnlCompact(value);
  if (abs >= 1000) return money(value, 0);
  if (abs >= 100) return money(value, 0);
  if (abs >= 10) return money(value, 1);
  return money(value, 2);
}

function formatBestTrade(value: number, hasTrades: boolean) {
  if (!hasTrades || value <= 0) return "—";
  return pnlCompact(value);
}

const STAT_LABEL_KEYS: Record<string, { label: string; short: string }> = {
  totalPnl: { label: "statTotalPnl", short: "statPnlShort" },
  winRate: { label: "statWinRate", short: "statWinPctShort" },
  totalTrades: { label: "statTotalTrades", short: "trades" },
  profitFactor: { label: "profitFactor", short: "microPF" },
  bestTrade: { label: "statBestTrade", short: "microBest" },
  winStreak: { label: "statWinStreak", short: "statWinStreak" },
  avgRR: { label: "statAvgRR", short: "statAvgRR" },
  avgWinner: { label: "statAvgWinner", short: "statAvgWinner" },
  avgLoser: { label: "statAvgLoser", short: "statAvgLoser" },
  expectancy: { label: "expectancy", short: "expectancy" },
  greenDays: { label: "statGreenDays", short: "statGreenDays" },
};

const STAT_CANDIDATES: StatCandidate[] = [
  {
    id: "totalPnl",
    label: "",
    shortLabel: "",
    format: (stats, hasTrades) => (hasTrades ? pnlCompact(stats.totalPnl) : "$0"),
    tone: (stats, hasTrades) => (hasTrades && stats.totalPnl < 0 ? "red" : "green"),
    available: () => true,
  },
  {
    id: "winRate",
    label: "Win Rate",
    shortLabel: "Win %",
    format: (stats, hasTrades) => (hasTrades ? formatWinRate(stats.winRate) : "0%"),
    tone: (stats, hasTrades) => (hasTrades && stats.winRate >= 50 ? "green" : "white"),
    available: () => true,
  },
  {
    id: "totalTrades",
    label: "Total Trades",
    shortLabel: "Trades",
    format: (stats) => formatTradeCount(stats.tradesLogged),
    tone: () => "green",
    available: () => true,
  },
  {
    id: "profitFactor",
    label: "Profit Factor",
    shortLabel: "PF",
    format: (stats, hasTrades) => (hasTrades ? formatProfitFactor(stats.profitFactor) : "—"),
    tone: (stats, hasTrades) => (hasTrades && stats.profitFactor >= 1 ? "green" : "white"),
    available: (stats, hasTrades) => hasTrades && stats.profitFactor > 0 && Number.isFinite(stats.profitFactor),
  },
  {
    id: "bestTrade",
    label: "Best Trade",
    shortLabel: "Best",
    format: (stats, hasTrades) => formatBestTrade(stats.bestTrade ?? 0, hasTrades),
    tone: () => "green",
    available: (stats, hasTrades) => hasTrades && (stats.bestTrade ?? 0) > 0,
  },
  {
    id: "winStreak",
    label: "Win Streak",
    shortLabel: "Streak",
    format: (stats, hasTrades) => (hasTrades ? formatWinStreak(stats.currentWinStreak ?? 0) : "0 Wins"),
    tone: (stats, hasTrades) => (hasTrades && (stats.currentWinStreak ?? 0) > 0 ? "green" : "white"),
    available: () => true,
  },
  {
    id: "avgRR",
    label: "Avg R:R",
    shortLabel: "R:R",
    format: (stats, hasTrades) => (hasTrades ? formatAvgRR(stats.avgRR ?? 0) : "—"),
    tone: () => "green",
    available: (stats, hasTrades) => hasTrades && (stats.avgRR ?? 0) > 0,
  },
  {
    id: "avgWinner",
    label: "Avg Winner",
    shortLabel: "Avg Win",
    format: (stats, hasTrades) => (hasTrades && (stats.avgWin ?? 0) > 0 ? pnlCompact(stats.avgWin ?? 0) : "—"),
    tone: () => "green",
    available: (stats, hasTrades) => hasTrades && (stats.avgWin ?? 0) > 0,
  },
  {
    id: "avgLoser",
    label: "Avg Loser",
    shortLabel: "Avg Loss",
    format: (stats, hasTrades) => (hasTrades && (stats.avgLoss ?? 0) < 0 ? pnlCompact(stats.avgLoss ?? 0) : "—"),
    tone: () => "red",
    available: (stats, hasTrades) => hasTrades && (stats.avgLoss ?? 0) < 0,
  },
  {
    id: "expectancy",
    label: "Expectancy",
    shortLabel: "Expect.",
    format: (stats, hasTrades) => formatExpectancy(stats.expectancy ?? 0, hasTrades),
    tone: (stats, hasTrades) => (hasTrades && (stats.expectancy ?? 0) >= 0 ? "green" : "red"),
    available: (stats, hasTrades) => hasTrades,
  },
  {
    id: "greenDays",
    label: "Green Days",
    shortLabel: "Green",
    format: (stats, hasTrades) => (hasTrades ? String(stats.greenDays ?? 0) : "0"),
    tone: () => "green",
    available: (stats, hasTrades) => hasTrades && (stats.greenDays ?? 0) > 0,
  },
];

const DEFAULT_LAYOUT_IDS = ["totalPnl", "winRate", "totalTrades", "profitFactor", "bestTrade", "winStreak"] as const;

function resolveCandidate(id: string) {
  return STAT_CANDIDATES.find((candidate) => candidate.id === id);
}

export function buildAchievementStatSlots(stats?: AchievementShareStats | null): AchievementStatSlot[] {
  const safeStats: AchievementShareStats = stats ?? {
    tradesLogged: 0,
    winRate: 0,
    totalPnl: 0,
    profitFactor: 0,
    avgWinLoss: 0,
    riskControl: 0,
    consistency: 0,
    maxDrawdown: 0,
    tradingScore: 0,
    bestSession: "N/A",
    dateLabel: "",
  };
  const hasTrades = safeStats.tradesLogged > 0;
  const selected: AchievementStatSlot[] = [];
  const used = new Set<string>();

  const pushCandidate = (candidate: StatCandidate) => {
    if (used.has(candidate.id) || !candidate.available(safeStats, hasTrades)) return;
    const value = candidate.format(safeStats, hasTrades);
    const keys = STAT_LABEL_KEYS[candidate.id];
    selected.push({
      label: keys ? t(keys.short) : candidate.shortLabel,
      value,
      tone: candidate.tone(safeStats, hasTrades),
    });
    used.add(candidate.id);
  };

  DEFAULT_LAYOUT_IDS.forEach((id) => {
    const candidate = resolveCandidate(id);
    if (candidate) pushCandidate(candidate);
  });

  if (selected.length < 6) {
    STAT_CANDIDATES.forEach((candidate) => {
      if (selected.length >= 6) return;
      pushCandidate(candidate);
    });
  }

  while (selected.length < 6) {
    selected.push({ label: t("trades"), value: formatTradeCount(safeStats.tradesLogged), tone: "white" });
  }

  return selected.slice(0, 6);
}

export function achievementValueSize(value: string) {
  return statValueDesignSize(value);
}
