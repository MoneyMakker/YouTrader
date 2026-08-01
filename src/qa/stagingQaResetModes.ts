/**
 * Pure staging QA reset modes — Node-testable, no RN imports.
 */

export type StagingQaResetMode =
  | "fresh"
  | "paywall"
  | "auth"
  | "returning-allow"
  | "returning-deny";

export type StagingQaResetModeUi = {
  session: null;
  onboardingCompleted: boolean;
  paywallCompleted: boolean;
  acquisitionHydrated: true;
  /** Persist these keys as "1" after wipe so hydrate cannot undo the mode. */
  persistOnboarding: boolean;
  persistPaywallDevice: boolean;
  expectedPhase: "onboarding" | "paywall" | "auth" | "main";
};

const MODE_BY_PATH: Record<string, StagingQaResetMode> = {
  "reset-fresh": "fresh",
  "reset-paywall": "paywall",
  "reset-auth": "auth",
  "reset-returning-allow": "returning-allow",
  "reset-returning-deny": "returning-deny",
};

/** Parse youtrader://qa/reset-* deep links. */
export function parseStagingQaResetMode(url: string): StagingQaResetMode | null {
  const raw = (url || "").trim().toLowerCase();
  if (!raw.startsWith("youtrader://qa/reset-")) return null;
  try {
    const parsed = new URL(raw);
    const path = (parsed.hostname || "") + (parsed.pathname || "");
    // youtrader://qa/reset-auth → hostname=qa, pathname=/reset-auth
    const leaf = path.replace(/^qa\/?/, "").replace(/^\//, "").split("?")[0];
    if (MODE_BY_PATH[leaf]) return MODE_BY_PATH[leaf];
  } catch {
    // fall through
  }
  for (const [key, mode] of Object.entries(MODE_BY_PATH)) {
    if (raw.includes(`/qa/${key}`) || raw.includes(`qa/${key}`) || raw.endsWith(key)) {
      return mode;
    }
  }
  return null;
}

export function isStagingQaResetDeepLink(url: string): boolean {
  return parseStagingQaResetMode(url) != null;
}

/**
 * Acquisition UI contract after a successful staging reset for the given mode.
 * Critical: keep acquisitionHydrated=true (see prior stuck-loading incident).
 */
export function stagingQaResetModeUi(mode: StagingQaResetMode): StagingQaResetModeUi {
  switch (mode) {
    case "fresh":
      return {
        session: null,
        onboardingCompleted: false,
        paywallCompleted: false,
        acquisitionHydrated: true,
        persistOnboarding: false,
        persistPaywallDevice: false,
        expectedPhase: "onboarding",
      };
    case "paywall":
      return {
        session: null,
        onboardingCompleted: true,
        paywallCompleted: false,
        acquisitionHydrated: true,
        persistOnboarding: true,
        persistPaywallDevice: false,
        expectedPhase: "paywall",
      };
    case "auth":
      // Direct Auth: onboarding + paywall already completed for this install path.
      return {
        session: null,
        onboardingCompleted: true,
        paywallCompleted: true,
        acquisitionHydrated: true,
        persistOnboarding: true,
        persistPaywallDevice: true,
        expectedPhase: "auth",
      };
    case "returning-allow":
    case "returning-deny":
      return {
        session: null,
        onboardingCompleted: true,
        paywallCompleted: true,
        acquisitionHydrated: true,
        persistOnboarding: true,
        persistPaywallDevice: true,
        expectedPhase: "main",
      };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
