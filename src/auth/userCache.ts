import AsyncStorage from "@react-native-async-storage/async-storage";

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
  "first-insight-dismissed:",
  "locked-insight-dismissed:",
];

export async function clearLocalUserCache(userId?: string | null) {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter((key) => {
    if (key === GUEST_TRADES_STORAGE_KEY) return true;
    if (!userId) {
      return USER_SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix));
    }
    return key.startsWith(`trades-v7:${userId}`) || key.startsWith(`user-preferences-v1:${userId}`);
  });
  if (toRemove.length) {
    await AsyncStorage.multiRemove(toRemove);
  }
}
