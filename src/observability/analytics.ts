import { getPosthogClient } from "../lib/posthog";
import { trackAgent007Event } from "./agent007Analytics";

type AnalyticsValue = string | number | boolean | null;
type AnalyticsProperties = Record<string, unknown>;
type SafeAnalyticsProperties = Record<string, AnalyticsValue>;

const ALLOWED_VALUE_TYPES = new Set(["string", "number", "boolean"]);

function sanitizeProperties(properties?: AnalyticsProperties): SafeAnalyticsProperties | undefined {
  if (!properties) return undefined;
  const safe: SafeAnalyticsProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("note") ||
      lower.includes("screenshot") ||
      lower.includes("voice") ||
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("key") ||
      lower.includes("payload")
    ) continue;
    if (value == null) {
      safe[key] = null;
    } else if (ALLOWED_VALUE_TYPES.has(typeof value)) {
      safe[key] = typeof value === "string" ? value.slice(0, 120) : value as AnalyticsValue;
    }
  }
  return safe;
}

export function trackEvent(name: string, properties?: AnalyticsProperties) {
  const safe = sanitizeProperties(properties);
  getPosthogClient()?.capture(name, safe);
  trackAgent007Event(name, safe);
  if (__DEV__) console.log("[analytics:event]", name, safe || {});
}

export function trackScreen(name: string, properties?: AnalyticsProperties) {
  const safe = sanitizeProperties(properties);
  getPosthogClient()?.screen(name, safe);
  if (__DEV__) console.log("[analytics:screen]", name, safe || {});
}
