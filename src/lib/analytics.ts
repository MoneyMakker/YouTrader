import { posthogClient } from "./posthog";
import { configureAgent007Analytics, resetAgent007Analytics, trackAgent007Event } from "../observability/agent007Analytics";

export { trackEvent, trackScreen } from "../observability/analytics";

/** Identify user after login — never pass email or trade data. */
export function identifyAnalyticsUser(userId: string, traits?: Record<string, string | boolean | number | null>) {
  try {
    posthogClient?.identify(userId, traits);
  } catch {
    // Analytics must never crash the app.
  }
  void configureAgent007Analytics(Boolean(userId)).then(() => {
    if (userId) trackAgent007Event("app_opened", { authenticated_session: true });
  }).catch(() => {
    // Analytics configuration is non-critical.
  });
}

/** Clear analytics identity on logout. */
export function resetAnalyticsUser() {
  try {
    posthogClient?.reset();
  } catch {
    // Analytics must never crash the app.
  }
  void resetAgent007Analytics();
}
