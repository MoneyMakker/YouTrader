import { logger } from "./logger";

const START_MS = Date.now();

export function logStartupPerf(event: string) {
  logger.info(`[YouTrader:startup] ${event} +${Date.now() - START_MS}ms`);
}

export function logStartupError(action: string, error?: unknown) {
  const message = error instanceof Error ? error.message : String(error || "unknown");
  logger.warn(`[YouTrader:startup] startup_error ${action}: ${message.slice(0, 160)}`);
}

let appStartLogged = false;

export function markAppStart() {
  if (appStartLogged) return;
  appStartLogged = true;
  logStartupPerf("app_start");
}
