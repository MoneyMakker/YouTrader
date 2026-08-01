/**
 * Trial eligibility for acquisition paywall — derived from StoreKit/RC product intro.
 * Never hardcode eligibility from onboarding flags.
 */

import type { PurchasesStoreProduct } from "react-native-purchases";

export type TrialEligibility = "eligible" | "ineligible" | "unknown" | "failed";

export type IntroTrialInfo = {
  eligibility: TrialEligibility;
  /** True only when a zero-price (or free) introductory period is present on the product. */
  hasFreeIntro: boolean;
  periodLabel: string | null;
};

function readIntro(
  product: PurchasesStoreProduct | null | undefined,
): { price: number; periodUnits: number; periodUnit?: string } | null {
  if (!product) return null;
  const intro = (
    product as {
      introPrice?: {
        price?: number;
        periodNumberOfUnits?: number;
        periodUnit?: string;
      } | null;
    }
  ).introPrice;
  if (!intro) return null;
  return {
    price: Number(intro.price ?? NaN),
    periodUnits: Number(intro.periodNumberOfUnits ?? 0),
    periodUnit: intro.periodUnit,
  };
}

/**
 * Resolve intro trial presentation from a resolved store product.
 * - Product with free intro → eligible
 * - Product without intro → ineligible
 * - Product missing → unknown
 */
export function resolveIntroTrialInfo(
  product: PurchasesStoreProduct | null | undefined,
  options?: { checkFailed?: boolean },
): IntroTrialInfo {
  if (options?.checkFailed) {
    return { eligibility: "failed", hasFreeIntro: false, periodLabel: null };
  }
  if (!product) {
    return { eligibility: "unknown", hasFreeIntro: false, periodLabel: null };
  }
  const intro = readIntro(product);
  if (!intro) {
    return { eligibility: "ineligible", hasFreeIntro: false, periodLabel: null };
  }
  const free = intro.price === 0 || Number.isNaN(intro.price);
  if (!free || intro.periodUnits <= 0) {
    return { eligibility: "ineligible", hasFreeIntro: false, periodLabel: null };
  }
  const unit = (intro.periodUnit || "DAY").toUpperCase();
  const periodLabel =
    unit.startsWith("DAY") && intro.periodUnits === 7
      ? "7 days free"
      : unit.startsWith("DAY")
        ? `${intro.periodUnits} days free`
        : unit.startsWith("WEEK")
          ? `${intro.periodUnits} week${intro.periodUnits === 1 ? "" : "s"} free`
          : "Introductory offer";
  return { eligibility: "eligible", hasFreeIntro: true, periodLabel };
}

export function yearlySavingsLabel(monthlyPrice: number, yearlyPrice: number): string | null {
  if (!(monthlyPrice > 0) || !(yearlyPrice > 0)) return null;
  const annualizedMonthly = monthlyPrice * 12;
  if (annualizedMonthly <= yearlyPrice) return null;
  const saved = annualizedMonthly - yearlyPrice;
  const pct = Math.round((saved / annualizedMonthly) * 100);
  if (pct <= 0) return null;
  return `Save ${pct}% vs monthly`;
}
