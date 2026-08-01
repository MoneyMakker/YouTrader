/** Monthly trade allowance before Pro upgrade prompt (resets on the 1st). */
export const FREE_MONTHLY_TRADE_LIMIT = 15;

/** Watermarked PDF preview allowance before Pro (per calendar month). */
export const FREE_MONTHLY_PDF_PREVIEW_LIMIT = 0;

export const PRO_MONTHLY_PRICE_LABEL = "$12.99/month";
/** Must match App Store Connect free introductory offer (1 Week = 7 days). */
export const PRO_TRIAL_DAYS = 7;

export const TRADE_LIMIT_PAYWALL = {
  title: "You've reached your monthly trade limit.",
  subtitle: "Unlock YouTrader Pro: start 7 days free when eligible, then $12.99/month.",
  cta: "Start 7-Day Free Trial",
  priceHint: "Cancel anytime in Apple Settings.",
} as const;

export const AI_DAILY_LIMIT_MESSAGE = "Daily AI limit reached.\nMore requests become available tomorrow.";
