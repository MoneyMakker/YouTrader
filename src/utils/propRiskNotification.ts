import * as Notifications from "expo-notifications";

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
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!payload.enabled) return;
    const ok = await ensureNotificationPermission();
    if (!ok) return;

    await Notifications.scheduleNotificationAsync({
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
  } catch {
    // Never block app startup if notification scheduling fails.
  }
}
