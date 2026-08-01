import { logger } from "./logger";

const START_MS = Date.now();
const emitted = new Set<string>();
const fileLines: string[] = [];

export type StartupCheckpoint =
  | "S04"
  | "S05"
  | "S06"
  | "S07"
  | "S08"
  | "S09"
  | "S10"
  | "S11"
  | "S12"
  | "S13"
  | "S14";

const CHECKPOINT_LABEL: Record<StartupCheckpoint, string> = {
  S04: "index entry reached",
  S05: "root component registered",
  S06: "App module import completed",
  S07: "runtime environment resolved",
  S08: "Supabase client initialized",
  S09: "first React render committed",
  S10: "auth restoration started",
  S11: "activation lookup started",
  S12: "navigation shell mounted",
  S13: "splash screen hidden",
  S14: "app interactive",
};

function persistStartupLine(line: string) {
  fileLines.push(line);
  // Defer native FS until after the React Native runtime is up.
  queueMicrotask(() => {
    void (async () => {
      try {
        const FileSystem = await import("expo-file-system/legacy");
        const dir = FileSystem.documentDirectory;
        if (!dir) return;
        const path = `${dir}startup-checkpoints.log`;
        await FileSystem.writeAsStringAsync(path, `${fileLines.join("\n")}\n`, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch {
        // Persistence is diagnostic-only; never fail startup.
      }
    })();
  });
}

export function logStartupPerf(event: string) {
  // warn (not info): Release builds silence logger.info, but TestFlight
  // startup diagnosis needs these checkpoints in device logs.
  // Prefer console.warn over console.error so LogBox does not block QA UI.
  // Release syslog still captures warn; true startup failures use logStartupError.
  const line = `[YouTrader:startup] ${event} +${Date.now() - START_MS}ms`;
  logger.warn(line);
  // eslint-disable-next-line no-console
  console.warn(line);
  persistStartupLine(line);
}

export function logStartupCheckpoint(code: StartupCheckpoint, detail?: string) {
  if (emitted.has(code)) return;
  emitted.add(code);
  const suffix = detail ? ` ${detail}` : "";
  logStartupPerf(`${code} ${CHECKPOINT_LABEL[code]}${suffix}`);
}

export function logStartupError(action: string, error?: unknown) {
  const message = error instanceof Error ? error.message : String(error || "unknown");
  const line = `[YouTrader:startup] startup_error ${action}: ${message.slice(0, 160)}`;
  logger.warn(line);
  // eslint-disable-next-line no-console
  console.error(line);
  persistStartupLine(line);
}

export function getLastStartupCheckpoint(): StartupCheckpoint | null {
  const order: StartupCheckpoint[] = [
    "S04",
    "S05",
    "S06",
    "S07",
    "S08",
    "S09",
    "S10",
    "S11",
    "S12",
    "S13",
    "S14",
  ];
  let last: StartupCheckpoint | null = null;
  for (const code of order) {
    if (emitted.has(code)) last = code;
  }
  return last;
}

let appStartLogged = false;

export function markAppStart() {
  if (appStartLogged) return;
  appStartLogged = true;
  logStartupPerf("app_start");
  logStartupCheckpoint("S04");
}
