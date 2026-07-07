import React from "react";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const SENTRY_DSN = (process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "").trim();
const SENTRY_ENVIRONMENT = (process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || (__DEV__ ? "development" : "production")).trim();
const APP_VERSION = Constants.expoConfig?.version || "1.5.9";
const APP_BUILD = Constants.expoConfig?.ios?.buildNumber || "92";
const SENTRY_RELEASE = `YouTrader@${APP_VERSION}+${APP_BUILD}`;

let monitoringInitialized = false;

function sanitizeContext(context?: Record<string, unknown>) {
  if (!context) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    const lower = key.toLowerCase();
    if (lower.includes("token") || lower.includes("secret") || lower.includes("key") || lower.includes("password")) continue;
    if (typeof value === "string") safe[key] = value.slice(0, 240);
    else if (typeof value === "number" || typeof value === "boolean" || value == null) safe[key] = value;
    else safe[key] = JSON.stringify(value).slice(0, 240);
  }
  return safe;
}

export function initializeMonitoring() {
  if (monitoringInitialized || !SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: true,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    dist: APP_BUILD,
    attachStacktrace: true,
    tracesSampleRate: __DEV__ ? 0 : 0.05,
    beforeSend(event) {
      if (event.request) delete event.request.cookies;
      return event;
    },
  });
  monitoringInitialized = true;
}

export function setMonitoringUser(userId: string | null) {
  if (!SENTRY_DSN) return;
  try {
    initializeMonitoring();
    Sentry.setUser(userId ? { id: userId } : null);
  } catch {
    // Monitoring must never affect app behavior.
  }
}

/** Defer Sentry init until after first paint — avoids startup UI hangs. */
export function scheduleMonitoringInit() {
  if (monitoringInitialized || !SENTRY_DSN) return;
  const run = () => {
    try {
      initializeMonitoring();
    } catch {
      // Monitoring must never block app render.
    }
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => setTimeout(run, 0));
  } else {
    setTimeout(run, 0);
  }
}

export function captureAppError(error: unknown, context?: Record<string, unknown>) {
  const safeContext = sanitizeContext(context);
  if (SENTRY_DSN) {
    initializeMonitoring();
    Sentry.captureException(error, safeContext ? { extra: safeContext } : undefined);
  }
  if (__DEV__) console.error("[app:error]", error, safeContext || {});
}

export function logCrashlyticsBreadcrumb(message: string, data?: Record<string, unknown>) {
  const safeData = sanitizeContext(data);
  if (SENTRY_DSN) {
    initializeMonitoring();
    Sentry.addBreadcrumb({ message, data: safeData, level: "info" });
  }
  if (__DEV__) console.log("[breadcrumb]", message, safeData || {});
}

export function wrapAppWithSentry<T extends React.ComponentType<any>>(Component: T): T {
  if (!SENTRY_DSN) return Component;
  scheduleMonitoringInit();
  return Sentry.wrap(Component) as T;
}
