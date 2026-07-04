import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

const PROP_DAILY_NOTIF_ID_KEY = "prop-daily-risk-notification-id-v1";

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function scheduleDailyPropRiskNotification(payload: {
  enabled: boolean;
  title: string;
  body: string;
}) {
  try {
    const existingId = await AsyncStorage.getItem(PROP_DAILY_NOTIF_ID_KEY);
    if (existingId) {
      await Notifications.cancelScheduledNotificationAsync(existingId);
      await AsyncStorage.removeItem(PROP_DAILY_NOTIF_ID_KEY);
    }
    if (!payload.enabled) return;
    const ok = await ensureNotificationPermission();
    if (!ok) return;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 30,
      },
    });
    await AsyncStorage.setItem(PROP_DAILY_NOTIF_ID_KEY, id);
  } catch {
    // Never block app startup if notification scheduling fails.
  }
}
