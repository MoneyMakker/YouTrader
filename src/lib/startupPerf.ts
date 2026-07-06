const START_MS = Date.now();

export function logStartupPerf(event: string) {
  console.log(`[YouTrader:startup-perf] ${event} +${Date.now() - START_MS}ms`);
}

let appStartLogged = false;

export function markAppStart() {
  if (appStartLogged) return;
  appStartLogged = true;
  logStartupPerf("app_start");
}
