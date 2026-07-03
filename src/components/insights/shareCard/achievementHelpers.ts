import type { Achievement, TraderLevel } from "../../../analytics/achievements";

export type AchievementRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export type AchievementShareStats = {
  tradesLogged: number;
  winRate: number;
  totalPnl: number;
  profitFactor: number;
  avgWinLoss: number;
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
  if (title.includes("revenge")) return "Emotional re-entries stay out of the journal.";
  if (title.includes("risk") || title.includes("discipline") || title.includes("rule") || title.includes("limit")) {
    return "Discipline over emotion.";
  }
  if (title.includes("fund") || title.includes("evaluation") || title.includes("protected")) {
    return "Protect the account. Earn the next level.";
  }
  if (title.includes("consistency") || title.includes("month") || title.includes("figure")) {
    return "Consistency compounds when it is tracked.";
  }
  if (title.includes("overtrad")) return "Fewer decisions. Cleaner execution.";
  return item.condition || "Discipline creates consistency.";
}

export function achievementCategoryLabel(category: string) {
  return category.replace(/_/g, " ").toUpperCase();
}
