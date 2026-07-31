/**
 * Staging-only email login for QA automation.
 * Credentials come from a fixture file in the app sandbox — never from production,
 * never logged, never committed.
 */

import * as FileSystem from "expo-file-system/legacy";
import { isStagingQaResetAllowed } from "./stagingQaResetGates";

export type StagingQaEmailRole = "allow" | "deny";

type FixtureFile = {
  allow?: { email?: string; password?: string };
  deny?: { email?: string; password?: string };
};

const FIXTURE_RELATIVE = "qa-fixtures/email-login.json";

export function isStagingQaEmailLoginAllowed(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return isStagingQaResetAllowed(env, { devFallback: typeof __DEV__ !== "undefined" && __DEV__ });
}

export function parseStagingQaEmailLoginUrl(url: string): StagingQaEmailRole | null {
  const normalized = (url || "").trim();
  if (!normalized.toLowerCase().startsWith("youtrader://qa/email-login")) return null;
  try {
    const parsed = new URL(normalized);
    const role = (parsed.searchParams.get("role") || "allow").trim().toLowerCase();
    if (role === "allow" || role === "deny") return role;
  } catch {
    // URL constructor may fail on custom schemes in some RN runtimes — fallback parse.
    const match = normalized.match(/[?&]role=(allow|deny)/i);
    if (match) return match[1].toLowerCase() as StagingQaEmailRole;
    if (/youtrader:\/\/qa\/email-login\/?/i.test(normalized)) return "allow";
  }
  return null;
}

function fixturePath(): string {
  return `${FileSystem.documentDirectory || ""}${FIXTURE_RELATIVE}`;
}

export async function readStagingQaEmailFixture(
  role: StagingQaEmailRole,
): Promise<{ email: string; password: string } | null> {
  if (!isStagingQaEmailLoginAllowed()) return null;
  const path = fixturePath();
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    console.info("[YTQA] email fixture missing", { role });
    return null;
  }
  try {
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as FixtureFile;
    const entry = role === "allow" ? parsed.allow : parsed.deny;
    const email = (entry?.email || "").trim();
    const password = entry?.password || "";
    if (!email || !password) {
      console.info("[YTQA] email fixture incomplete", { role, hasEmail: !!email });
      return null;
    }
    return { email, password };
  } catch {
    console.info("[YTQA] email fixture unreadable", { role });
    return null;
  }
}
