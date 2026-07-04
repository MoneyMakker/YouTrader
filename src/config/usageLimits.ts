import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./appConfig";
import { loadLocalUserPreferences, pushUserPreferences } from "../sync/userPreferencesSync";
import { peekShareCardExportAllowed as peekShareCardExportAllowedEngine, usageMonthKey, monthlyUsageStorageKey } from "./usageLimitsEngine";

const SHARE_CARDS_USAGE_KEY = "share-cards";

export async function getShareCardsUsedThisMonth(userId: string | null = null) {
  const month = usageMonthKey();
  const key = monthlyUsageStorageKey(SHARE_CARDS_USAGE_KEY, userId);
  const raw = await AsyncStorage.getItem(key);
  let count = Number(raw || "0");
  if (userId) {
    const prefs = await loadLocalUserPreferences(userId);
    const remote = prefs?.shareCardExports;
    if (remote?.month === month && remote.count > count) {
      count = remote.count;
      await AsyncStorage.setItem(key, String(count));
    }
  }
  return Number.isFinite(count) ? count : 0;
}

export async function peekShareCardExportAllowed(isPremium: boolean, userId: string | null = null) {
  const used = await getShareCardsUsedThisMonth(userId);
  return peekShareCardExportAllowedEngine(isPremium, used);
}

export async function recordShareCardExportSuccess(userId: string | null = null, isPremium = false) {
  const check = await peekShareCardExportAllowed(isPremium, userId);
  if (!check.allowed) return check.used;
  const month = usageMonthKey();
  const next = check.used + 1;
  await AsyncStorage.setItem(monthlyUsageStorageKey(SHARE_CARDS_USAGE_KEY, userId), String(next));
  if (userId && supabase) {
    void pushUserPreferences(supabase, userId, { shareCardExports: { month, count: next } }).catch(() => {});
  }
  return next;
}

export { countTradeImages, canAttachTradeImage, usageMonthKey, monthlyUsageStorageKey } from "./usageLimitsEngine";
