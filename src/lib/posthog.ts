import type { PostHog } from "posthog-react-native";

const POSTHOG_API_KEY = (process.env.EXPO_PUBLIC_POSTHOG_API_KEY || process.env.POSTHOG_API_KEY || "").trim();
const POSTHOG_HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || process.env.POSTHOG_HOST || "https://us.i.posthog.com").trim();

let posthogClient: PostHog | undefined;
let posthogInitAttempted = false;

/** Lazy PostHog client — avoids blocking JS thread during App import. */
export function getPosthogClient(): PostHog | undefined {
  if (!POSTHOG_API_KEY || posthogInitAttempted) return posthogClient;
  posthogInitAttempted = true;
  try {
    const { PostHog: PostHogCtor } = require("posthog-react-native") as typeof import("posthog-react-native");
    posthogClient = new PostHogCtor(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      flushAt: 10,
      flushInterval: 30000,
    });
  } catch {
    posthogClient = undefined;
  }
  return posthogClient;
}
