/**
 * Versioned first-launch onboarding profile — local before auth.
 * Answers drive personalized value copy; never claim AI personalization.
 * Preview + selections always derive from one normalized model.
 */

export const ONBOARDING_PROFILE_KEY = "yt-onboarding-profile-v1";
export const ONBOARDING_PROFILE_VERSION = 1 as const;

export type PainPoint =
  | "revenge"
  | "fomo"
  | "risk_breaks"
  | "unknown_setups";

export type MarketKind = "futures" | "crypto" | "forex" | "stocks";

export type FuturesInstrument = "MES" | "MNQ" | "ES" | "NQ" | "CL" | "GC" | "Other";

export type SessionPref =
  | "ny_am"
  | "ny_pm"
  | "london"
  | "asia"
  | "no_fixed";

export type StylePref = "scalping" | "intraday" | "swing";

export type PropFirmPref = "apex" | "topstep" | "tpt" | "other";

export type OnboardingProfileV1 = {
  version: typeof ONBOARDING_PROFILE_VERSION;
  painPoint: PainPoint | null;
  market: MarketKind | null;
  /** Futures-only instruments. Cleared when market !== futures. */
  instruments: FuturesInstrument[];
  session: SessionPref | null;
  style: StylePref | null;
  propChallenge: boolean | null;
  propFirms: PropFirmPref[];
  completedAt: string | null;
  skippedSteps: number[];
};

export type OnboardingProfilePreview = {
  market: MarketKind;
  primarySymbol: string;
  styleLabel: string;
  sessionLabel: string;
  propActive: boolean;
  propFirmLabel: string | null;
  focusLine: string;
  headline: string;
  subtitle: string;
};

export function emptyOnboardingProfile(): OnboardingProfileV1 {
  return {
    version: ONBOARDING_PROFILE_VERSION,
    painPoint: null,
    market: null,
    instruments: [],
    session: null,
    style: null,
    propChallenge: null,
    propFirms: [],
    completedAt: null,
    skippedSteps: [],
  };
}

/** Enforce market/instrument invariants. */
export function normalizeOnboardingProfile(
  partial: Partial<OnboardingProfileV1> | OnboardingProfileV1,
): OnboardingProfileV1 {
  const market = partial.market ?? null;
  const instrumentsRaw = Array.isArray(partial.instruments) ? partial.instruments : [];
  const instruments =
    market === "futures"
      ? (instrumentsRaw.filter(Boolean) as FuturesInstrument[])
      : [];
  const propChallenge = partial.propChallenge ?? null;
  const propFirms =
    propChallenge === true
      ? (Array.isArray(partial.propFirms) ? partial.propFirms : [])
      : [];

  return {
    version: ONBOARDING_PROFILE_VERSION,
    painPoint: partial.painPoint ?? null,
    market,
    instruments,
    session: partial.session ?? null,
    style: partial.style ?? null,
    propChallenge,
    propFirms,
    completedAt: partial.completedAt ?? null,
    skippedSteps: Array.isArray(partial.skippedSteps) ? partial.skippedSteps : [],
  };
}

/** Sensible defaults when the user skips early screens. */
export function defaultOnboardingProfile(partial?: Partial<OnboardingProfileV1>): OnboardingProfileV1 {
  const base = normalizeOnboardingProfile({
    painPoint: "unknown_setups",
    market: "futures",
    instruments: ["MES", "MNQ"],
    session: "ny_am",
    style: "intraday",
    propChallenge: false,
    propFirms: [],
    ...partial,
  });
  if (base.market === "futures" && base.instruments.length === 0) {
    return { ...base, instruments: ["MES"] };
  }
  return base;
}

export function parseOnboardingProfile(raw: unknown): OnboardingProfileV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<OnboardingProfileV1>;
  if (value.version !== ONBOARDING_PROFILE_VERSION) return null;
  return normalizeOnboardingProfile(value);
}

export function applyMarketSelection(
  profile: OnboardingProfileV1,
  market: MarketKind,
): OnboardingProfileV1 {
  return normalizeOnboardingProfile({
    ...profile,
    market,
    instruments: market === "futures" ? profile.instruments : [],
  });
}

export function sessionLabelFor(session: SessionPref | null | undefined): string {
  switch (session) {
    case "ny_am":
      return "New York AM";
    case "ny_pm":
      return "New York PM";
    case "london":
      return "London";
    case "asia":
      return "Asia";
    case "no_fixed":
      return "No fixed session";
    default:
      return "No fixed session";
  }
}

export function styleLabelFor(style: StylePref | null | undefined): string {
  switch (style) {
    case "scalping":
      return "Scalping";
    case "swing":
      return "Swing";
    case "intraday":
      return "Intraday";
    default:
      return "Intraday";
  }
}

export function primarySymbolFor(profile: OnboardingProfileV1): string {
  const market = profile.market;
  if (market === "futures") {
    return profile.instruments[0] || "MES";
  }
  if (market === "crypto") return "BTC";
  if (market === "forex") return "EURUSD";
  if (market === "stocks") return "EQUITIES";
  return "—";
}

/** Live preview labels — never invent futures symbols for non-futures markets. */
export function buildOnboardingProfilePreview(
  profile: OnboardingProfileV1,
): OnboardingProfilePreview {
  const resolved = normalizeOnboardingProfile(profile);
  const market = resolved.market || "futures";
  const withDefaults =
    market === "futures" && resolved.instruments.length === 0
      ? { ...resolved, market, instruments: ["MES"] as FuturesInstrument[] }
      : { ...resolved, market };
  const primarySymbol = primarySymbolFor(withDefaults);
  const styleLabel = styleLabelFor(withDefaults.style);
  const sessionLabel = sessionLabelFor(withDefaults.session);
  const propActive = withDefaults.propChallenge === true;
  const propFirmLabel = propActive
    ? PROP_FIRM_OPTIONS.find((f) => withDefaults.propFirms.includes(f.id))?.label || "Prop firm"
    : null;
  const focusLine =
    market === "futures"
      ? "Session consistency"
      : market === "crypto"
        ? "24h decision quality"
        : market === "forex"
          ? "Session overlap timing"
          : "Market-hours discipline";

  return {
    market,
    primarySymbol,
    styleLabel,
    sessionLabel,
    propActive,
    propFirmLabel,
    focusLine,
    headline: primarySymbol,
    subtitle: `${styleLabel} · ${sessionLabel}`,
  };
}

export function buildPersonalizedValueBullets(profile: OnboardingProfileV1): string[] {
  const preview = buildOnboardingProfilePreview(profile);
  const instrument =
    preview.market === "stocks"
      ? "equity"
      : preview.market === "forex"
        ? "FX"
        : preview.primarySymbol;
  const sessionLabel = preview.sessionLabel;
  const styleLabel = preview.styleLabel.toLowerCase();

  const bullets = [
    `See whether your strongest results happen during ${sessionLabel}`,
    `Track how tilt changes your P&L after a losing trade`,
    `Identify which ${instrument} ${styleLabel} setups produce positive expectancy`,
  ];
  if (preview.propActive) {
    bullets.push("Protect daily and trailing drawdown during prop challenges");
  } else {
    bullets.push("Build risk visibility before you take a prop challenge");
  }
  if (profile.painPoint === "revenge") {
    bullets[1] = "Spot revenge-trading streaks before they compound losses";
  } else if (profile.painPoint === "fomo") {
    bullets[1] = "Measure how FOMO entries change your expectancy";
  } else if (profile.painPoint === "risk_breaks") {
    bullets[1] = "See when risk and stop rules are broken in live sessions";
  }
  return bullets.slice(0, 4);
}

export const PAIN_OPTIONS: { id: PainPoint; label: string }[] = [
  { id: "revenge", label: "Revenge trading after a loss" },
  { id: "fomo", label: "Entering from FOMO" },
  { id: "risk_breaks", label: "Breaking risk and stop rules" },
  { id: "unknown_setups", label: "Not knowing which setups actually work" },
];

export const MARKET_OPTIONS: { id: MarketKind; label: string }[] = [
  { id: "futures", label: "Futures" },
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
  { id: "stocks", label: "Stocks" },
];

export const FUTURES_INSTRUMENTS: FuturesInstrument[] = ["MES", "MNQ", "ES", "NQ", "CL", "GC", "Other"];

export const SESSION_OPTIONS: { id: SessionPref; label: string }[] = [
  { id: "ny_am", label: "New York AM" },
  { id: "ny_pm", label: "New York PM" },
  { id: "london", label: "London" },
  { id: "asia", label: "Asia" },
  { id: "no_fixed", label: "No fixed session" },
];

export const STYLE_OPTIONS: { id: StylePref; label: string }[] = [
  { id: "scalping", label: "Scalping" },
  { id: "intraday", label: "Intraday" },
  { id: "swing", label: "Swing" },
];

export const PROP_FIRM_OPTIONS: { id: PropFirmPref; label: string }[] = [
  { id: "apex", label: "Apex" },
  { id: "topstep", label: "Topstep" },
  { id: "tpt", label: "Take Profit Trader" },
  { id: "other", label: "Other" },
];
