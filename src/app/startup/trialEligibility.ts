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
  /** Free intro length in days when known (DAY or WEEK units). */
  introDays: number | null;
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

function introLengthDays(periodUnits: number, periodUnit?: string): number | null {
  if (!(periodUnits > 0)) return null;
  const unit = (periodUnit || "DAY").toUpperCase();
  if (unit.startsWith("DAY")) return periodUnits;
  if (unit.startsWith("WEEK")) return periodUnits * 7;
  return null;
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
    return { eligibility: "failed", hasFreeIntro: false, periodLabel: null, introDays: null };
  }
  if (!product) {
    return { eligibility: "unknown", hasFreeIntro: false, periodLabel: null, introDays: null };
  }
  const intro = readIntro(product);
  if (!intro) {
    return { eligibility: "ineligible", hasFreeIntro: false, periodLabel: null, introDays: null };
  }
  const free = intro.price === 0 || Number.isNaN(intro.price);
  if (!free || intro.periodUnits <= 0) {
    return { eligibility: "ineligible", hasFreeIntro: false, periodLabel: null, introDays: null };
  }
  const days = introLengthDays(intro.periodUnits, intro.periodUnit);
  const periodLabel =
    days === 7
      ? "7 days free"
      : days === 3
        ? "3 days free"
        : days != null
          ? `${days} days free`
          : "Introductory offer";
  return { eligibility: "eligible", hasFreeIntro: true, periodLabel, introDays: days };
}

/** @deprecated Prefer computeYearlySavingsPercent from paywallPlanCopy. */
export function yearlySavingsLabel(monthlyPrice: number, yearlyPrice: number): string | null {
  if (!(monthlyPrice > 0) || !(yearlyPrice > 0)) return null;
  const annualizedMonthly = monthlyPrice * 12;
  if (annualizedMonthly <= yearlyPrice) return null;
  const saved = annualizedMonthly - yearlyPrice;
  const pct = Math.round((saved / annualizedMonthly) * 100);
  if (pct <= 0) return null;
  return `Save ${pct}% vs monthly`;
}
