import type { Achievement, TraderLevel } from "../../../analytics/achievements";
import { t } from "../../../i18n";

export type AchievementRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export type AchievementShareStats = {
  tradesLogged: number;
  winRate: number;
  totalPnl: number;
  profitFactor: number;
  avgWinLoss: number;
  avgRR?: number;
  avgWin?: number;
  avgLoss?: number;
  expectancy?: number;
  bestTrade?: number;
  currentWinStreak?: number;
  greenDays?: number;
  riskControl: number;
  consistency: number;
  maxDrawdown: number;
  tradingScore: number;
  bestSession: string;
  dateLabel: string;
};

export function achievementRarity(item: Achievement, level: TraderLevel): AchievementRarity {
  const title = item.title.toLowerCase();
  if (
    title.includes("apex") ||
    title.includes("five figure") ||
    title.includes("$10k") ||
    title.includes("funding hunter") ||
    level.score >= 95
  ) {
    return "LEGENDARY";
  }
  if (
    title.includes("elite") ||
    title.includes("risk master") ||
    title.includes("quant") ||
    title.includes("funded") ||
    level.score >= 90
  ) {
    return "EPIC";
  }
  if (title.includes("10 trades") || title.includes("$1k") || title.includes("sniper") || level.score >= 75) {
    return "RARE";
  }
  return "COMMON";
}

export function rarityColor(rarity: AchievementRarity) {
  if (rarity === "LEGENDARY") return "#F4C95D";
  if (rarity === "EPIC") return "#D36BFF";
  if (rarity === "RARE") return "#B026FF";
  return "#9CFF00";
}

export function raritySecondaryColor(rarity: AchievementRarity) {
  if (rarity === "LEGENDARY") return "#9CFF00";
  if (rarity === "EPIC") return "#9CFF00";
  if (rarity === "RARE") return "#D36BFF";
  return "#B8FF00";
}

export function prestigeStatement(item: Achievement) {
  const title = item.title.toLowerCase();
  if (title.includes("revenge")) return t("achPrestigeRevenge");
  if (title.includes("risk") || title.includes("discipline") || title.includes("rule") || title.includes("limit")) {
    return t("achPrestigeDiscipline");
  }
  if (title.includes("fund") || title.includes("evaluation") || title.includes("protected")) {
    return t("achPrestigeProtect");
  }
  if (title.includes("consistency") || title.includes("month") || title.includes("figure")) {
    return t("achPrestigeConsistency");
  }
  if (title.includes("overtrad")) return t("achPrestigeOvertrade");
  return item.condition || t("achPrestigeDefault");
}

export function achievementCategoryLabel(category: string) {
  return category.replace(/_/g, " ").toUpperCase();
}

export type AchievementRewardOverlayCopy = {
  kicker: string;
  title: string;
  description: string;
  detail: string;
};

export function achievementRewardDescription(item: Achievement): string {
  const title = item.title.toLowerCase();
  const id = item.id.toLowerCase();

  if (title.includes("first green week") || id.includes("green_week")) {
    return "Seven disciplined days. Consistency beats luck.";
  }
  if (title.includes("first trade")) {
    return "Every professional trader started with a single trade.";
  }
  if (title.includes("top 20")) {
    return "Your discipline now places you ahead of most traders.";
  }
  if (title.includes("risk master") || title.includes("risk discipline")) {
    return "Exceptional capital preservation and risk management.";
  }
  if (title.includes("profit factor") || id.includes("profit_factor") || id === "pf") {
    return "Your average winners are consistently outperforming your losses.";
  }
  if (title.includes("one step from funding") || title.includes("funding hunter")) {
    return "You're closer than ever to earning a funded account.";
  }
  if (title.includes("equity high")) {
    return "A new peak in your trading equity curve.";
  }
  if (title.includes("10 trades") || title.includes("10 trade")) {
    return "Consistency in logging builds professional habits.";
  }
  if (title.includes("revenge")) {
    return "Emotional control is what separates pros from amateurs.";
  }
  if (title.includes("pass eval") || title.includes("prop survival")) {
    return "Your process is approaching funded-trader standards.";
  }
  if (title.includes("$1k") || title.includes("$10k") || title.includes("figure")) {
    return "Meaningful P&L milestones prove your edge is real.";
  }
  if (title.includes("5r") || title.includes("sniper")) {
    return "Precision entries with outsized reward-to-risk.";
  }
  if (title.includes("green day")) {
    return "Winning days compound into lasting confidence.";
  }
  if (title.includes("expectancy")) {
    return "Positive expectancy means your process is paying off.";
  }
  if (title.includes("consistency")) {
    return "Repeatable behavior beats sporadic big wins.";
  }
  if (title.includes("journal") || title.includes("streak")) {
    return "A consistent journal is the foundation of improvement.";
  }
  return prestigeStatement(item);
}

export function buildAchievementRewardOverlay(
  item?: Achievement | null,
  stats?: AchievementShareStats | null,
): AchievementRewardOverlayCopy {
  if (!item?.title) {
    return {
      kicker: "ACHIEVEMENT UNLOCKED",
      title: "MILESTONE REACHED",
      description: "Discipline creates consistency.",
      detail: stats?.dateLabel ? `Unlocked ${stats.dateLabel}` : "",
    };
  }
  const detail =
    item.unlocked && stats?.dateLabel
      ? `Unlocked ${stats.dateLabel}`
      : item.progressLabel || item.metricLabel || "";
  return {
    kicker: "ACHIEVEMENT UNLOCKED",
    title: item.title.toUpperCase(),
    description: achievementRewardDescription(item),
    detail,
  };
}

export function achievementTitleFontSize(title: string) {
  const len = title.length;
  if (len > 28) return 90;
  if (len > 22) return 100;
  if (len > 16) return 110;
  return 120;
}
