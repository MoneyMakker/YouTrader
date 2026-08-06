/**
 * AnonymousDataMigrationService — idempotent migration of guest data to an
 * authenticated Supabase account. Clears anonymous data only after success.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { userTradesStorageKey } from "../auth/userCache";
import { logger } from "../lib/logger";
import type { AssessmentAnswers, AssessmentResult } from "../acquisition/assessmentModel";

const MIGRATION_MARKER_PREFIX = "yt-post-purchase-migration-v1:";

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableObject(item)]));
}

function migrationId(entry: unknown, index: number, scope: string): string {
  const normalized = JSON.stringify({ scope, index, entry: stableObject(entry) });
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `migration-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function normalizeMigrationTrade(entry: unknown, index: number, scope: "guest" | "authenticated"): unknown {
  if (!entry || typeof entry !== "object") return entry;
  const record = entry as Record<string, unknown>;
  return record.id ? entry : { ...record, id: migrationId(entry, index, scope) };
}

export type MigrationResult =
  | { status: "migrated"; tradesMigrated: number }
  | { status: "already_migrated" }
  | { status: "no_guest_data" }
  | { status: "failed"; message: string };

export type AssessmentMigrationResult =
  | { status: "migrated" | "already_migrated" | "no_guest_data" }
  | { status: "failed"; message: string };

const ASSESSMENT_MIGRATION_PREFIX = "yt-assessment-migration-v1:";

/** Migrate raw assessment answers and derived challenge setup before journal data. */
export async function migrateAnonymousAssessmentToUser(userId: string): Promise<AssessmentMigrationResult> {
  const markerKey = `${ASSESSMENT_MIGRATION_PREFIX}${userId}`;
  if (await AsyncStorage.getItem(markerKey) === "complete") return { status: "already_migrated" };

  try {
    const [answersRaw, resultRaw] = await Promise.all([
      AsyncStorage.getItem("yt-assessment-answers-v1"),
      AsyncStorage.getItem("yt-assessment-result-v1"),
    ]);
    if (!answersRaw && !resultRaw) {
      await AsyncStorage.setItem(markerKey, "complete");
      return { status: "no_guest_data" };
    }
    const answers = answersRaw ? JSON.parse(answersRaw) as AssessmentAnswers : {};
    const result = resultRaw ? JSON.parse(resultRaw) as AssessmentResult : null;
    const setup = result ? {
      modelVersion: result.modelVersion,
      primaryRisk: result.primaryRisk,
      readinessScore: result.overallReadiness,
      riskLevel: result.riskLevel,
      riskControl: result.riskControl,
      discipline: result.discipline,
      challengeBuffer: result.challengeBuffer,
    } : null;
    await AsyncStorage.multiSet([
      [`yt-assessment-answers-v1:${userId}`, JSON.stringify(answers)],
      [`yt-assessment-result-v1:${userId}`, JSON.stringify(result)],
      [`prop-pass-setup-v1:${userId}`, JSON.stringify(setup)],
      [markerKey, "complete"],
    ]);
    await AsyncStorage.multiRemove(["yt-assessment-answers-v1", "yt-assessment-result-v1"]);
    return { status: "migrated" };
  } catch (error) {
    logger.error(error, { feature: "migration", action: "assessment_setup" });
    return { status: "failed", message: "Assessment setup migration failed" };
  }
}

/**
 * Migrate trades from the legacy guest key to the authenticated user key.
 * Idempotent: never overwrites newer authenticated data with stale guest data.
 */
export async function migrateGuestTradesToUser(userId: string): Promise<MigrationResult> {
  const markerKey = `${MIGRATION_MARKER_PREFIX}${userId}`;

  try {
    const existingMarker = await AsyncStorage.getItem(markerKey);
    if (existingMarker === "complete") return { status: "already_migrated" };
  } catch {
    // proceed without marker
  }

  let guestTradesRaw: string | null = null;
  try {
    guestTradesRaw = await AsyncStorage.getItem("trades-v6");
  } catch (error) {
    logger.error(error, { feature: "migration", action: "read_guest_trades" });
    return { status: "failed", message: "Failed to read guest trades" };
  }

  if (!guestTradesRaw) {
    try { await AsyncStorage.setItem(markerKey, "complete"); } catch { /* best effort */ }
    return { status: "no_guest_data" };
  }

  let guestTrades: unknown[];
  try {
    guestTrades = JSON.parse(guestTradesRaw);
    if (!Array.isArray(guestTrades)) throw new Error("not an array");
  } catch {
    return { status: "failed", message: "Guest trades format invalid" };
  }

  const authenticatedKey = userTradesStorageKey(userId);
  let authenticatedTrades: unknown[] = [];
  try {
    const raw = await AsyncStorage.getItem(authenticatedKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) authenticatedTrades = parsed;
    }
  } catch {
    // start fresh
  }

  // Merge: guest trades first (older), then authenticated (newer). Deduplicate by id.
  const normalizedGuest = guestTrades.map((entry, index) => normalizeMigrationTrade(entry, index, "guest"));
  const normalizedAuthenticated = authenticatedTrades.map((entry, index) => normalizeMigrationTrade(entry, index, "authenticated"));
  const deduplicated = [...normalizedGuest, ...normalizedAuthenticated];

  // Remove duplicates, keeping the last occurrence (authenticated wins)
  const seen = new Map<string, unknown>();
  for (const entry of deduplicated) {
    if (entry && typeof entry === "object" && (entry as any).id) {
      seen.set(String((entry as any).id), entry);
    }
  }
  for (const entry of deduplicated) {
    if (entry && typeof entry === "object" && !(entry as any).id) {
      seen.set(`unkeyed-${seen.size}`, entry);
    }
  }
  const merged = Array.from(seen.values());

  try {
    await AsyncStorage.setItem(authenticatedKey, JSON.stringify(merged));
  } catch (error) {
    logger.error(error, { feature: "migration", action: "write_authenticated_trades" });
    return { status: "failed", message: "Failed to write migrated trades" };
  }

  // Clear anonymous data only after successful migration.
  try {
    await AsyncStorage.multiRemove(["trades-v6", "yt-acquisition-guest-v1"]);
  } catch (error) {
    logger.error(error, { feature: "migration", action: "clear_anonymous_data" });
    // non-fatal — guest data is already migrated
  }

  try { await AsyncStorage.setItem(markerKey, "complete"); } catch { /* best effort */ }

  logger.info("post_purchase_migration_complete", {
    feature: "migration",
    action: "guest_to_authenticated",
    tradesMigrated: merged.length,
    guestTradeCount: guestTrades.length,
  });

  return { status: "migrated", tradesMigrated: merged.length };
}
