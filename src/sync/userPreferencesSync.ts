import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthlyUsageStorageKey, usageMonthKey } from "../config/usageLimitsEngine";
import { userPreferencesStorageKey } from "../auth/userCache";

export type UserPreferencesPayload = {
  lang?: string;
  lockScreenBuffer?: boolean;
  calendarAlerts?: boolean;
  propRiskAlerts?: boolean;
  shareCardExports?: { month: string; count: number };
  updatedAt?: number;
};

type UserAppStateRow = {
  user_id: string;
  preferences: UserPreferencesPayload;
  updated_at: string;
};

export async function loadLocalUserPreferences(userId: string) {
  const raw = await AsyncStorage.getItem(userPreferencesStorageKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserPreferencesPayload;
  } catch {
    return null;
  }
}

export async function saveLocalUserPreferences(userId: string, preferences: UserPreferencesPayload) {
  const next = { ...preferences, updatedAt: Date.now() };
  await AsyncStorage.setItem(userPreferencesStorageKey(userId), JSON.stringify(next));
  return next;
}

export async function pullUserPreferences(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_app_state")
    .select("preferences,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const remote = (data.preferences || {}) as UserPreferencesPayload;
  const remoteUpdatedAt = data.updated_at ? Date.parse(data.updated_at) : 0;
  const local = await loadLocalUserPreferences(userId);
  const localUpdatedAt = local?.updatedAt || 0;
  if (remoteUpdatedAt >= localUpdatedAt) {
    const merged = { ...remote, updatedAt: remoteUpdatedAt || Date.now() };
    await saveLocalUserPreferences(userId, merged);
    await syncShareCardUsageFromPreferences(userId, merged);
    return merged;
  }
  return local;
}

async function syncShareCardUsageFromPreferences(userId: string, preferences: UserPreferencesPayload) {
  const remote = preferences.shareCardExports;
  if (!remote?.month || remote.month !== usageMonthKey()) return;
  const key = monthlyUsageStorageKey("share-cards", userId);
  const localRaw = await AsyncStorage.getItem(key);
  const localCount = Number(localRaw || "0");
  const mergedCount = Math.max(Number.isFinite(localCount) ? localCount : 0, remote.count);
  await AsyncStorage.setItem(key, String(mergedCount));
}

export async function pushUserPreferences(supabase: SupabaseClient, userId: string, preferences: UserPreferencesPayload) {
  const local = await saveLocalUserPreferences(userId, preferences);
  const row: UserAppStateRow = {
    user_id: userId,
    preferences: local,
    updated_at: new Date(local.updatedAt || Date.now()).toISOString(),
  };
  const { error } = await supabase.from("user_app_state").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
  return local;
}
