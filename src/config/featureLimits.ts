import { t } from "../i18n";

export type FeatureLimitTier = {
  shareCardsPerMonth: number;
  tradeImagesTotal: number;
  localAiCoach: boolean;
  paidAiAnalysis: boolean;
  aiChat: boolean;
  chartScreenshotAi: boolean;
  weeklyAiReport: boolean;
};

export const FREE_LIMITS: FeatureLimitTier = {
  shareCardsPerMonth: 30,
  tradeImagesTotal: 15,
  localAiCoach: true,
  paidAiAnalysis: false,
  aiChat: false,
  chartScreenshotAi: false,
  weeklyAiReport: false,
};

export const PRO_LIMITS: FeatureLimitTier = {
  shareCardsPerMonth: 100,
  tradeImagesTotal: Number.POSITIVE_INFINITY,
  localAiCoach: true,
  paidAiAnalysis: true,
  aiChat: true,
  chartScreenshotAi: true,
  weeklyAiReport: true,
};

export const FEATURE_LIMIT_MESSAGES = {
  get shareCardMonthlyLimitFree() {
    return t("featureShareCardLimitFree");
  },
  get shareCardMonthlyLimitPro() {
    return t("featureShareCardLimitPro");
  },
  get shareCardMonthlyLimit() {
    return t("featureShareCardLimitFree");
  },
  get tradeImageLimit() {
    return t("featureTradeImageLimit");
  },
  get paidAiPaywall() {
    return t("paidAiPaywall");
  },
  get exportProPaywall() {
    return t("featureExportProPaywall");
  },
  get freeLocalCoachLabel() {
    return t("freeLocalCoach");
  },
  get stayFree() {
    return t("stayFree");
  },
  get upgradeToPro() {
    return t("upgradeToPro");
  },
} as const;

export function getLimitsForUser(isPremium: boolean): FeatureLimitTier {
  return isPremium ? PRO_LIMITS : FREE_LIMITS;
}
