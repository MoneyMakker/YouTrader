import { t } from "../../i18n";

export const CAREER_TIERS = [
  "Beginner",
  "Explorer",
  "Consistent",
  "Disciplined",
  "Professional",
  "Elite",
  "Legend",
] as const;

export type CareerTier = (typeof CAREER_TIERS)[number];

const CAREER_TIER_KEYS: Record<CareerTier, string> = {
  Beginner: "careerBeginner",
  Explorer: "careerExplorer",
  Consistent: "careerConsistent",
  Disciplined: "careerDisciplined",
  Professional: "careerProfessional",
  Elite: "careerElite",
  Legend: "careerLegend",
};

export function careerTierLabel(tier: CareerTier | string) {
  const key = CAREER_TIER_KEYS[tier as CareerTier];
  return key ? t(key) : tier;
}

export function careerTierIndex(score: number) {
  if (score >= 95) return 6;
  if (score >= 88) return 5;
  if (score >= 76) return 4;
  if (score >= 66) return 3;
  if (score >= 58) return 2;
  if (score >= 35) return 1;
  return 0;
}

export function currentCareerTier(score: number): CareerTier {
  return CAREER_TIERS[careerTierIndex(score)];
}

export function rankDisplayTitle(levelTitleKey: string) {
  const map: Record<string, string> = {
    Rookie: t("rankRookieTrader"),
    Consistent: t("rankConsistentTrader"),
    Funded: t("rankDisciplinedTrader"),
    Elite: t("rankEliteExecution"),
  };
  return map[levelTitleKey] || t("rankGenericTrader", { title: levelTitleKey });
}

export function pointsToNextTier(score: number) {
  const thresholds = [35, 58, 66, 76, 88, 95, 100];
  const idx = careerTierIndex(score);
  const next = thresholds[idx];
  if (next === undefined || score >= 100) return 0;
  return Math.max(0, next - score);
}

export function nextTierLabel(score: number) {
  const idx = careerTierIndex(score);
  if (idx >= CAREER_TIERS.length - 1) return null;
  return careerTierLabel(CAREER_TIERS[idx + 1]);
}

export function missionRewardLabel(achievementId: string) {
  if (achievementId.includes("top") || achievementId.includes("score")) return t("rewardTradingScore");
  if (achievementId.includes("risk") || achievementId.includes("revenge")) return t("rewardDiscipline");
  if (achievementId.includes("prop") || achievementId.includes("eval")) return t("rewardPropProgress");
  return t("rewardAchievementBadge");
}

export function achievementIcon(category: string, unlocked: boolean) {
  if (category === "journal") return unlocked ? "✓" : "📝";
  if (category === "performance") return unlocked ? "✓" : "📈";
  if (category === "risk") return unlocked ? "✓" : "🛡️";
  if (category === "prop_firm") return unlocked ? "✓" : "🏦";
  return unlocked ? "✓" : "🏆";
}
