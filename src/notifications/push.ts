import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { trackEvent } from "../observability/analytics";
import { captureAppError } from "../observability/monitoring";

export type NotificationPreferenceKey =
  | "logTodayTrade"
  | "weeklyReportReady"
  | "dailyBriefReady"
  | "riskLimitClose"
  | "propDailyBufferAtRisk";

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

const NOTIFICATION_PREFS_KEY = "notification-preferences-v1";

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  logTodayTrade: false,
  weeklyReportReady: false,
  dailyBriefReady: false,
  riskLimitClose: false,
  propDailyBufferAtRisk: false,
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
  } catch (error) {
    captureAppError(error, { feature: "notifications", action: "read_preferences" });
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export async function setNotificationPreference(key: NotificationPreferenceKey, enabled: boolean) {
  const current = await getNotificationPreferences();
  const next = { ...current, [key]: enabled };
  await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
  return next;
}

export async function requestNotificationPermission(reason: NotificationPreferenceKey) {
  trackEvent("push_permission_requested", { reason });
  try {
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (permission.granted) {
      trackEvent("push_permission_granted", { reason });
      return true;
    }
    return false;
  } catch (error) {
    captureAppError(error, { feature: "notifications", action: "request_permission", reason });
    return false;
  }
}

export async function scheduleLocalReminder(options: {
  idKey: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  preference: NotificationPreferenceKey;
}) {
  const granted = await requestNotificationPermission(options.preference);
  if (!granted) return null;
  const existingId = await AsyncStorage.getItem(options.idKey);
  if (existingId) await Notifications.cancelScheduledNotificationAsync(existingId);
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: options.title, body: options.body, sound: false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: options.hour,
      minute: options.minute,
    },
  });
  await AsyncStorage.setItem(options.idKey, id);
  await setNotificationPreference(options.preference, true);
  return id;
}

export async function clearLocalReminder(idKey: string, preference: NotificationPreferenceKey) {
  const existingId = await AsyncStorage.getItem(idKey);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
    await AsyncStorage.removeItem(idKey);
  }
  await setNotificationPreference(preference, false);
}

export async function getExpoPushTokenIfServerStorageIsReady() {
  const projectId = (process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "").trim();
  if (!projectId || Platform.OS === "web") return null;
  const granted = await requestNotificationPermission("dailyBriefReady");
  if (!granted) return null;
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    captureAppError(error, { feature: "notifications", action: "get_expo_push_token" });
    return null;
  }
}
