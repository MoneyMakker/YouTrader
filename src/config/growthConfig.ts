export type GrowthExperimentKey =
  | "upgrade_button_copy"
  | "paywall_plan_order"
  | "locked_insight_headline";

export type GrowthConfig = {
  paywallHeadline: string;
  paywallCtaText: string;
  upgradeButtonText: string;
  showTrialOffer: boolean;
  showYearlyDiscount: boolean;
  showLockedInsightAfter7Trades: boolean;
  showPushPrompt: boolean;
  copyVariant: "control" | "growth" | "protection";
  experiments: Record<GrowthExperimentKey, string>;
};

export const DEFAULT_GROWTH_CONFIG: GrowthConfig = {
  paywallHeadline: "Unlock Full Edge Analysis",
  paywallCtaText: "Upgrade to Pro",
  upgradeButtonText: "Upgrade",
  showTrialOffer: true,
  showYearlyDiscount: true,
  showLockedInsightAfter7Trades: true,
  showPushPrompt: false,
  copyVariant: "control",
  experiments: {
    upgrade_button_copy: "upgrade",
    paywall_plan_order: "monthly_first",
    locked_insight_headline: "hidden_leaks",
  },
};

function boolFromEnv(value: string | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function safeText(value: string | undefined, fallback: string, maxLength = 80) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

export function getGrowthConfigDefaults(): GrowthConfig {
  return {
    ...DEFAULT_GROWTH_CONFIG,
    paywallHeadline: safeText(
      process.env.EXPO_PUBLIC_GROWTH_PAYWALL_HEADLINE,
      DEFAULT_GROWTH_CONFIG.paywallHeadline,
    ),
    paywallCtaText: safeText(
      process.env.EXPO_PUBLIC_GROWTH_PAYWALL_CTA,
      DEFAULT_GROWTH_CONFIG.paywallCtaText,
      48,
    ),
    upgradeButtonText: safeText(
      process.env.EXPO_PUBLIC_GROWTH_UPGRADE_BUTTON,
      DEFAULT_GROWTH_CONFIG.upgradeButtonText,
      36,
    ),
    showTrialOffer: boolFromEnv(
      process.env.EXPO_PUBLIC_GROWTH_SHOW_TRIAL_OFFER,
      DEFAULT_GROWTH_CONFIG.showTrialOffer,
    ),
    showYearlyDiscount: boolFromEnv(
      process.env.EXPO_PUBLIC_GROWTH_SHOW_YEARLY_DISCOUNT,
      DEFAULT_GROWTH_CONFIG.showYearlyDiscount,
    ),
    showLockedInsightAfter7Trades: boolFromEnv(
      process.env.EXPO_PUBLIC_GROWTH_SHOW_LOCKED_INSIGHT_AFTER_7_TRADES,
      DEFAULT_GROWTH_CONFIG.showLockedInsightAfter7Trades,
    ),
    showPushPrompt: boolFromEnv(
      process.env.EXPO_PUBLIC_GROWTH_SHOW_PUSH_PROMPT,
      DEFAULT_GROWTH_CONFIG.showPushPrompt,
    ),
  };
}

export async function loadGrowthConfig(): Promise<GrowthConfig> {
  return getGrowthConfigDefaults();
}

export function growthConfigStatus() {
  return {
    firebaseRemoteConfig: false,
    source: "local-defaults",
    safeForMissingFirebase: true,
  };
}
