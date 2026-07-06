import { getPosthogClient } from "./posthog";

export { trackEvent, trackScreen } from "../observability/analytics";

/** Identify user after login — never pass email or trade data. */
export function identifyAnalyticsUser(userId: string, traits?: Record<string, string | boolean | number | null>) {
  try {
    getPosthogClient()?.identify(userId, traits);
  } catch {
    // Analytics must never crash the app.
  }
}

/** Clear analytics identity on logout. */
export function resetAnalyticsUser() {
  try {
    getPosthogClient()?.reset();
  } catch {
    // Analytics must never crash the app.
  }
}
