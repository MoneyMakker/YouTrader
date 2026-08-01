/**
 * Authoritative acquisition paywall plan copy + CTA contract.
 * Trial display must follow StoreKit intro eligibility — never invent trials.
 */

import type { PurchasesStoreProduct } from "react-native-purchases";
import { resolveIntroTrialInfo, type IntroTrialInfo, type TrialEligibility } from "./trialEligibility";
import { resolvePlanTrialPresentation } from "../../billing/trialEligibilityPresentation";

export type PaywallPlanId = "weekly" | "monthly" | "yearly";

export type PaywallPlanPresentation = {
  id: PaywallPlanId;
  label: string;
  priceLine: string;
  periodUnit: "week" | "month" | "year";
  body: string;
  trialBadge: string | null;
  valueLines: string[];
  badges: string[];
  cta: string;
  supporting: string;
  trial: IntroTrialInfo;
};

export function parseLocalizedPriceNumber(priceString: string): number {
  const n = Number(String(priceString).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Yearly savings vs 52× weekly using localized numeric prices.
 * USD baseline: ($4.99×52 − $99.99) / ($4.99×52) ≈ 61%.
 */
export function computeYearlySavingsPercent(weeklyPrice: number, yearlyPrice: number): number | null {
  if (!(weeklyPrice > 0) || !(yearlyPrice > 0)) return null;
  const annualizedWeekly = weeklyPrice * 52;
  if (annualizedWeekly <= yearlyPrice) return null;
  const pct = Math.round(((annualizedWeekly - yearlyPrice) / annualizedWeekly) * 100);
  return pct > 0 ? pct : null;
}

export function computeYearlyPerWeek(yearlyPrice: number): number | null {
  if (!(yearlyPrice > 0)) return null;
  return Math.round((yearlyPrice / 52) * 100) / 100;
}

export function planAllowsTrialDisplay(
  planId: PaywallPlanId,
  trial: IntroTrialInfo,
  _product?: PurchasesStoreProduct | null | undefined,
): boolean {
  if (planId === "weekly") return false;
  if (trial.eligibility !== "eligible") return false;
  const days = trial.introDays;
  if (planId === "monthly") return days === 3;
  if (planId === "yearly") return days === 7;
  return false;
}

export function buildPaywallPlanPresentation(input: {
  id: PaywallPlanId;
  priceString: string;
  product: PurchasesStoreProduct | null | undefined;
  weeklyPriceString?: string;
  checkFailed?: boolean;
  /** RC introductory eligibility status string when available. */
  eligibilityStatus?: string | null;
}): PaywallPlanPresentation {
  const presented = resolvePlanTrialPresentation({
    plan: input.id,
    product: input.product,
    eligibilityStatus: input.eligibilityStatus,
    checkFailed: input.checkFailed,
  });
  const trial: IntroTrialInfo = {
    eligibility: presented.eligibility,
    hasFreeIntro: presented.hasFreeIntro,
    periodLabel: presented.periodLabel,
    introDays: presented.introDays,
  };
  const showTrial = planAllowsTrialDisplay(input.id, trial, input.product);
  const price = input.priceString;

  if (input.id === "weekly") {
    return {
      id: "weekly",
      label: "Weekly",
      priceLine: `${price} / week`,
      periodUnit: "week",
      body: "Full access with maximum flexibility.",
      trialBadge: null,
      valueLines: [],
      badges: [],
      cta: `Start for ${price}/week`,
      supporting: `Auto-renews at ${price}/week until canceled.`,
      trial: { ...trial, eligibility: trial.eligibility === "eligible" ? "ineligible" : trial.eligibility, hasFreeIntro: false, periodLabel: null },
    };
  }

  if (input.id === "monthly") {
    return {
      id: "monthly",
      label: "Monthly",
      priceLine: `${price} / month`,
      periodUnit: "month",
      body: "A flexible plan for building consistent trading habits.",
      trialBadge: showTrial ? "3 Days Free" : null,
      valueLines: [
        "Less than many monthly streaming subscriptions — built for your complete trading workflow.",
      ],
      badges: [],
      cta: showTrial ? "Try 3 Days Free" : `Start Monthly · ${price}`,
      supporting: showTrial
        ? `3 days free, then ${price}/month. Cancel anytime.`
        : `Auto-renews at ${price}/month until canceled.`,
      trial: showTrial ? trial : { ...trial, hasFreeIntro: false, periodLabel: null, eligibility: trial.eligibility === "eligible" ? "ineligible" : trial.eligibility },
    };
  }

  const weeklyPriceString = input.weeklyPriceString || "$4.99";
  const weeklyNum = parseLocalizedPriceNumber(weeklyPriceString);
  const yearlyNum = parseLocalizedPriceNumber(price);
  const savingsPct = computeYearlySavingsPercent(weeklyNum, yearlyNum);
  const perWeek = computeYearlyPerWeek(yearlyNum);
  const badges = ["BEST VALUE"];
  if (savingsPct != null) badges.push(`SAVE ${savingsPct}%`);
  const valueLines: string[] = [];
  if (perWeek != null) {
    const perWeekLabel = weeklyPriceString.includes("$")
      ? `$${perWeek.toFixed(2)}`
      : perWeek.toFixed(2);
    valueLines.push(`Only ${perWeekLabel}/week`);
    valueLines.push(`Instead of ${weeklyPriceString}/week on the Weekly plan.`);
  }
  valueLines.push("The best value for traders committed to long-term consistency.");

  return {
    id: "yearly",
    label: "Yearly",
    priceLine: `${price} / year`,
    periodUnit: "year",
    body: valueLines[valueLines.length - 1],
    trialBadge: showTrial ? "7 Days Free" : null,
    valueLines,
    badges,
    cta: showTrial ? "Start 7 Days Free" : `Start Yearly · ${price}`,
    supporting: showTrial
      ? `7 days free, then ${price}/year. Cancel anytime.`
      : `Auto-renews at ${price}/year until canceled.`,
    trial: showTrial
      ? trial
      : {
          ...trial,
          hasFreeIntro: false,
          periodLabel: null,
          eligibility: trial.eligibility === "eligible" ? "ineligible" : trial.eligibility,
        },
  };
}

export function assertNoForbiddenTrialCopy(text: string, planId: PaywallPlanId): string[] {
  const hits: string[] = [];
  const lower = text.toLowerCase();
  if (planId === "weekly") {
    for (const phrase of ["free trial", "3 days free", "7 days free", "no charge today", "days free"]) {
      if (lower.includes(phrase)) hits.push(phrase);
    }
  }
  if (planId === "monthly" && lower.includes("7 days free")) hits.push("7 days free");
  if (planId === "yearly" && lower.includes("3 days free")) hits.push("3 days free");
  return hits;
}

export type { TrialEligibility };
