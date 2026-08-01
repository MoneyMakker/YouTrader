/**
 * Deterministic Auth screen readiness — pure, Node-testable.
 * Maestro must poll for auth.screen + auth.google enabled before OAuth.
 */

export type AuthScreenReadinessInput = {
  startupResolverIdle: boolean;
  onboardingModalActive: boolean;
  paywallModalActive: boolean;
  asWebAuthSheetActive: boolean;
  oauthRequestPending: boolean;
  /** When Apple native is disabled, pass true (not required to mount). */
  appleCtaMounted: boolean;
  googleCtaMounted: boolean;
  emailCtaMounted: boolean;
  buttonsEnabled: boolean;
  /** True when banner is absent OR has finished evaluating config (may show warnings). */
  configurationBannerResolved: boolean;
};

export type AuthScreenReadiness = {
  ready: boolean;
  blockers: string[];
};

export function evaluateAuthScreenReadiness(
  input: AuthScreenReadinessInput,
): AuthScreenReadiness {
  const blockers: string[] = [];
  if (!input.startupResolverIdle) blockers.push("startup_resolver_busy");
  if (input.onboardingModalActive) blockers.push("onboarding_active");
  if (input.paywallModalActive) blockers.push("paywall_active");
  if (input.asWebAuthSheetActive) blockers.push("aswebauth_active");
  if (input.oauthRequestPending) blockers.push("oauth_pending");
  if (!input.appleCtaMounted) blockers.push("apple_cta_missing");
  if (!input.googleCtaMounted) blockers.push("google_cta_missing");
  if (!input.emailCtaMounted) blockers.push("email_cta_missing");
  if (!input.buttonsEnabled) blockers.push("buttons_disabled");
  if (!input.configurationBannerResolved) blockers.push("configuration_unresolved");
  return { ready: blockers.length === 0, blockers };
}

/** Maestro / a11y contract IDs for Auth. */
export const AUTH_A11Y = {
  screen: "auth.screen",
  loading: "auth.loading",
  configurationBanner: "auth.configuration-banner",
  apple: "auth.apple",
  google: "auth.google",
  email: "auth.email",
  ready: "auth.ready",
} as const;
