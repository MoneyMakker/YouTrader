/**
 * Resolve trial presentation using StoreKit intro metadata AND (when available)
 * RevenueCat introductory eligibility. Unknown/ineligible never advertise a trial.
 */

import type { PurchasesStoreProduct } from "react-native-purchases";
import { resolveIntroTrialInfo, type IntroTrialInfo, type TrialEligibility } from "../app/startup/trialEligibility";

export type PlanKind = "weekly" | "monthly" | "yearly";

/** Map RC INTRO_ELIGIBILITY status strings to our TrialEligibility. */
export function mapIntroEligibilityStatus(status: string | null | undefined): TrialEligibility {
  const normalized = (status || "").toUpperCase();
  if (
    normalized.includes("ELIGIBLE") &&
    !normalized.includes("INELIGIBLE") &&
    !normalized.includes("NOT_INTRO")
  ) {
    return "eligible";
  }
  if (
    normalized.includes("INELIGIBLE") ||
    normalized.includes("NOT_INTRO_ELIGIBLE") ||
    normalized.includes("NO_INTRO")
  ) {
    return "ineligible";
  }
  if (normalized.includes("UNKNOWN") || !normalized) return "unknown";
  return "unknown";
}

/**
 * Weekly never shows trial copy.
 * Monthly/Yearly require BOTH a free intro on the StoreProduct AND explicit eligibility
 * when an eligibility status is provided. Missing eligibility → defensive unknown → no trial claim.
 */
export function resolvePlanTrialPresentation(input: {
  plan: PlanKind;
  product: PurchasesStoreProduct | null | undefined;
  eligibilityStatus?: string | null;
  checkFailed?: boolean;
}): IntroTrialInfo & { showTrialCopy: boolean } {
  if (input.plan === "weekly") {
    return {
      eligibility: "ineligible",
      hasFreeIntro: false,
      periodLabel: null,
      introDays: null,
      showTrialCopy: false,
    };
  }

  const intro = resolveIntroTrialInfo(input.product, { checkFailed: input.checkFailed });
  const mapped =
    input.eligibilityStatus === undefined
      ? ("unknown" as TrialEligibility)
      : mapIntroEligibilityStatus(input.eligibilityStatus);

  // Prefer explicit RC eligibility when provided; never upgrade unknown → eligible.
  let eligibility: TrialEligibility = intro.eligibility;
  if (input.eligibilityStatus !== undefined) {
    if (mapped === "eligible" && intro.hasFreeIntro) eligibility = "eligible";
    else if (mapped === "ineligible") eligibility = "ineligible";
    else if (mapped === "unknown") eligibility = "unknown";
    else eligibility = mapped;
  } else {
    // No eligibility API result yet — do not advertise trial from intro metadata alone.
    eligibility = intro.hasFreeIntro ? "unknown" : intro.eligibility;
  }

  const showTrialCopy = eligibility === "eligible" && intro.hasFreeIntro;
  return {
    ...intro,
    eligibility,
    periodLabel: showTrialCopy ? intro.periodLabel : null,
    showTrialCopy,
  };
}
