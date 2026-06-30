import { PostHog } from "posthog-react-native";

const POSTHOG_API_KEY = (process.env.EXPO_PUBLIC_POSTHOG_API_KEY || process.env.POSTHOG_API_KEY || "").trim();
const POSTHOG_HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || process.env.POSTHOG_HOST || "https://us.i.posthog.com").trim();

export const posthogClient = POSTHOG_API_KEY
  ? new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      flushAt: 10,
      flushInterval: 30000,
    })
  : undefined;
