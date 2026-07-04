import { posthogClient } from "./posthog";

export { trackEvent, trackScreen } from "../observability/analytics";

/** Identify user after login — never pass email or trade data. */
export function identifyAnalyticsUser(userId: string, traits?: Record<string, string | boolean | number | null>) {
  try {
    posthogClient?.identify(userId, traits);
  } catch {
    // Analytics must never crash the app.
  }
}

/** Clear analytics identity on logout. */
export function resetAnalyticsUser() {
  try {
    posthogClient?.reset();
  } catch {
    // Analytics must never crash the app.
  }
}
