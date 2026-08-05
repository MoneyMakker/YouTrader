/**
 * AnonymousDataMigrationService — idempotent migration of guest data to an
 * authenticated Supabase account. Clears anonymous data only after success.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { userTradesStorageKey } from "../auth/userCache";
import { logger } from "../lib/logger";

const MIGRATION_MARKER_PREFIX = "yt-post-purchase-migration-v1:";

export type MigrationResult =
  | { status: "migrated"; tradesMigrated: number }
  | { status: "already_migrated" }
  | { status: "no_guest_data" }
  | { status: "failed"; message: string };

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
  const authTradeIds = new Set<string>();
  for (const entry of authenticatedTrades) {
    if (entry && typeof entry === "object" && (entry as any).id) {
      authTradeIds.add(String((entry as any).id));
    }
  }

  const deduplicated = [...guestTrades];
  for (const entry of authenticatedTrades) {
    if (entry && typeof entry === "object" && (entry as any).id) {
      deduplicated.push(entry);
    }
  }

  // Remove duplicates, keeping the last occurrence (authenticated wins)
  const seen = new Map<string, unknown>();
  for (const entry of deduplicated) {
    if (entry && typeof entry === "object" && (entry as any).id) {
      seen.set(String((entry as any).id), entry);
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
