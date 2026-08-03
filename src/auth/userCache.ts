import AsyncStorage from "@react-native-async-storage/async-storage";
import { isLocalAiCacheKeyForUser, LOCAL_AI_CACHE_PREFIX } from "../utils/localAiResponseCache";

export const GUEST_TRADES_STORAGE_KEY = "trades-v6";

export function userTradesStorageKey(userId: string) {
  return `trades-v7:${userId}`;
}

export function userPreferencesStorageKey(userId: string) {
  return `user-preferences-v1:${userId}`;
}

const USER_SCOPED_PREFIXES = [
  "trades-v7:",
  "user-preferences-v1:",
  "usage:share-cards:",
  "usage:pdf-previews:",
  "achievement-share-usage:",
  "ai-daily-mission-v1-",
  `${LOCAL_AI_CACHE_PREFIX}:`,
  "first-insight-dismissed:",
  "locked-insight-dismissed:",
];

/** Device-local Prop Pass / risk preferences cleared on explicit logout. */
const PROP_PASS_LOCAL_KEYS = [
  "prop-risk-mode-v1",
  "prop-risk-mode-v2",
  "prop-risk-template-v1",
  "prop-risk-alerts-v1",
  "prop-risk-alert-notification-id-v1",
];

/**
 * Pure matcher used by logout cleanup.
 * Never use substring includes for userId — that can delete unrelated keys.
 */
export function shouldClearLocalUserCacheKey(key: string, userId?: string | null): boolean {
  if (key === GUEST_TRADES_STORAGE_KEY) return true;
  if (PROP_PASS_LOCAL_KEYS.includes(key)) return true;
  if (!userId) {
    return USER_SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix));
  }
  if (key === `trades-v7:${userId}` || key.startsWith(`trades-v7:${userId}:`)) return true;
  if (key === `user-preferences-v1:${userId}` || key.startsWith(`user-preferences-v1:${userId}:`)) {
    return true;
  }
  if (key.startsWith(`usage:share-cards:${userId}`)) return true;
  if (key.startsWith(`usage:pdf-previews:${userId}`)) return true;
  if (key.startsWith(`achievement-share-usage:${userId}`)) return true;
  return isLocalAiCacheKeyForUser(key, userId);
}

export async function clearLocalUserCache(userId?: string | null) {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter((key) => shouldClearLocalUserCacheKey(key, userId));
  if (toRemove.length) {
    await AsyncStorage.multiRemove(toRemove);
  }
}
