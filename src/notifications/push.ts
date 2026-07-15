import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { trackEvent } from "../observability/analytics";
import { captureAppError } from "../observability/monitoring";
import {
  getSmartPushPreferences,
  setSmartPushPreference,
  type LegacyNotificationPreferenceKey,
  type SmartPushPreferenceKey,
} from "./notificationPreferences";

/** @deprecated Use SmartPushPreferenceKey */
export type NotificationPreferenceKey = LegacyNotificationPreferenceKey;

const LEGACY_PREFS_KEY = "notification-preferences-v1";

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  logTodayTrade: false,
  weeklyReportReady: false,
  dailyBriefReady: false,
  riskLimitClose: false,
  propDailyBufferAtRisk: false,
};

export async function getNotificationPreferences() {
  const smart = await getSmartPushPreferences();
  return {
    logTodayTrade: smart.dailyJournalReminder,
    weeklyReportReady: smart.weeklyPerformanceReview,
    dailyBriefReady: smart.economicCalendarAlerts,
    riskLimitClose: smart.dailyLossLimitWarning,
    propDailyBufferAtRisk: smart.propFirmBufferWarning,
  };
}

export async function setNotificationPreference(key: NotificationPreferenceKey, enabled: boolean) {
  const smartKey: Record<NotificationPreferenceKey, SmartPushPreferenceKey> = {
    logTodayTrade: "dailyJournalReminder",
    weeklyReportReady: "weeklyPerformanceReview",
    dailyBriefReady: "economicCalendarAlerts",
    riskLimitClose: "dailyLossLimitWarning",
    propDailyBufferAtRisk: "propFirmBufferWarning",
  };
  await setSmartPushPreference(smartKey[key], enabled);
  const legacy = await getNotificationPreferences();
  await AsyncStorage.setItem(LEGACY_PREFS_KEY, JSON.stringify(legacy));
  return legacy;
}

export async function requestNotificationPermission(reason: NotificationPreferenceKey) {
  const { requestSmartPushPermission } = await import("./smartAlerts");
  const smartKey: Record<NotificationPreferenceKey, SmartPushPreferenceKey> = {
    logTodayTrade: "dailyJournalReminder",
    weeklyReportReady: "weeklyPerformanceReview",
    dailyBriefReady: "economicCalendarAlerts",
    riskLimitClose: "dailyLossLimitWarning",
    propDailyBufferAtRisk: "propFirmBufferWarning",
  };
  return requestSmartPushPermission(smartKey[reason]);
}

export async function scheduleLocalReminder(options: {
  idKey: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  preference: NotificationPreferenceKey;
  skipPreferenceSync?: boolean;
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
  if (!options.skipPreferenceSync) {
    await setNotificationPreference(options.preference, true);
  }
  return id;
}

export async function clearLocalReminder(
  idKey: string,
  preference: NotificationPreferenceKey,
  options?: { skipPreferenceSync?: boolean },
) {
  const existingId = await AsyncStorage.getItem(idKey);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
    await AsyncStorage.removeItem(idKey);
  }
  if (!options?.skipPreferenceSync) {
    await setNotificationPreference(preference, false);
  }
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

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
