/**
 * Versioned first-launch onboarding profile — local before auth.
 * Answers drive personalized value copy; never claim AI personalization.
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
  instruments: FuturesInstrument[];
  session: SessionPref | null;
  style: StylePref | null;
  propChallenge: boolean | null;
  propFirms: PropFirmPref[];
  completedAt: string | null;
  skippedSteps: number[];
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

/** Sensible defaults when the user skips early screens. */
export function defaultOnboardingProfile(partial?: Partial<OnboardingProfileV1>): OnboardingProfileV1 {
  return {
    ...emptyOnboardingProfile(),
    painPoint: "unknown_setups",
    market: "futures",
    instruments: ["MES", "MNQ"],
    session: "ny_am",
    style: "intraday",
    propChallenge: false,
    propFirms: [],
    ...partial,
    version: ONBOARDING_PROFILE_VERSION,
  };
}

export function parseOnboardingProfile(raw: unknown): OnboardingProfileV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<OnboardingProfileV1>;
  if (value.version !== ONBOARDING_PROFILE_VERSION) return null;
  return {
    ...emptyOnboardingProfile(),
    ...value,
    version: ONBOARDING_PROFILE_VERSION,
    instruments: Array.isArray(value.instruments) ? value.instruments : [],
    propFirms: Array.isArray(value.propFirms) ? value.propFirms : [],
    skippedSteps: Array.isArray(value.skippedSteps) ? value.skippedSteps : [],
  };
}

export function buildPersonalizedValueBullets(profile: OnboardingProfileV1): string[] {
  const instrument =
    profile.instruments[0] ||
    (profile.market === "futures" ? "MES" : profile.market === "crypto" ? "BTC" : "your markets");
  const sessionLabel =
    profile.session === "ny_am"
      ? "New York AM"
      : profile.session === "ny_pm"
        ? "New York PM"
        : profile.session === "london"
          ? "London"
          : profile.session === "asia"
            ? "Asia"
            : "your preferred session";
  const styleLabel =
    profile.style === "scalping" ? "scalping" : profile.style === "swing" ? "swing" : "intraday";

  const bullets = [
    `See whether your strongest results happen during ${sessionLabel}`,
    `Track how tilt changes your P&L after a losing trade`,
    `Identify which ${instrument} ${styleLabel} setups produce positive expectancy`,
  ];
  if (profile.propChallenge) {
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
