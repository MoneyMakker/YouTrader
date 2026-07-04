/** Free plan: new trades logged per calendar month (resets on the 1st). */
export const FREE_MONTHLY_TRADE_LIMIT = 15;

/** Free plan: watermarked PDF previews per calendar month. */
export const FREE_MONTHLY_PDF_PREVIEW_LIMIT = 0;

export const PRO_MONTHLY_PRICE_LABEL = "$12.99/month";
export const PRO_TRIAL_DAYS = 3;

export const TRADE_LIMIT_PAYWALL = {
  title: "You've reached your free trade limit this month.",
  subtitle: "Unlock YouTrader Pro at full power: start 3 days free, then $12.99/month.",
  cta: "Start 3-Day Free Trial",
  priceHint: "Cancel anytime in Apple Settings.",
} as const;

export const AI_DAILY_LIMIT_MESSAGE = "Daily AI limit reached.\nMore requests become available tomorrow.";
