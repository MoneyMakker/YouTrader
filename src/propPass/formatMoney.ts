/**
 * Prop Pass money display — formats server minor units for UI only.
 * Never recalculates challenge truth.
 */

export type PropMoneyFormatOptions = {
  currency?: string;
  locale?: string;
  /** Fraction digits for major units (default 2 for USD-like). */
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
};

const SUPPORTED = new Set(["USD", "EUR", "GBP", "CAD", "AUD", "JPY"]);

/** Convert integer minor units → major number for Intl. */
export function minorToMajor(minor: number | null | undefined): number | null {
  if (minor == null || !Number.isFinite(minor)) return null;
  return minor / 100;
}

export function formatPropMoney(
  minor: number | null | undefined,
  options: PropMoneyFormatOptions = {},
): string {
  const major = minorToMajor(minor);
  if (major == null) return "—";

  const currency = (options.currency || "USD").toUpperCase();
  const locale = options.locale || "en-US";
  const isYen = currency === "JPY";
  const maximumFractionDigits =
    options.maximumFractionDigits ?? (isYen ? 0 : 2);
  const minimumFractionDigits =
    options.minimumFractionDigits ?? (isYen ? 0 : 2);

  try {
    if (!SUPPORTED.has(currency) && currency.length !== 3) {
      return `${major.toFixed(maximumFractionDigits)} ${currency}`;
    }
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: SUPPORTED.has(currency) ? currency : "USD",
      currencyDisplay: "symbol",
      maximumFractionDigits,
      minimumFractionDigits,
    }).format(major);
  } catch {
    const sign = major < 0 ? "-" : "";
    return `${sign}$${Math.abs(major).toFixed(2)}`;
  }
}

/** Accessibility-friendly spoken money (no raw minor). */
export function formatPropMoneyA11y(
  minor: number | null | undefined,
  options: PropMoneyFormatOptions = {},
): string {
  const formatted = formatPropMoney(minor, options);
  if (formatted === "—") return "Unavailable";
  return formatted.replace(/[^\d.,\-$€£]/g, " ").replace(/\s+/g, " ").trim() || formatted;
}
