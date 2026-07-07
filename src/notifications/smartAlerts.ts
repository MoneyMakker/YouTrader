import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { t } from "../i18n";
import { logger } from "../lib/logger";
import { trackEvent } from "../observability/analytics";
import { captureAppError } from "../observability/monitoring";
import {
  ALERT_I18N_KEYS,
  ALERT_PRO_ONLY,
  enabledAlertIds,
  getSmartPushPreferences,
  isProOnlyPreference,
  setSmartPushPreference,
  setSmartPushPreferences,
  type SmartPushAlertId,
  type SmartPushPreferenceKey,
} from "./notificationPreferences";
import { setDailyTradingBriefEnabled } from "./dailyTradingBrief";
import {
  applyMasterGroupsToSmartPrefs,
  getNotificationMasterGroups,
  isMasterGroupProOnly,
  saveNotificationMasterGroups,
  type NotificationMasterGroupId,
  type NotificationMasterGroupPrefs,
} from "./notificationMasterGroups";
import {
  analyzeSmartAlertData,
  type CalendarEventInput,
  type PropRiskSnapshotInput,
  type SmartTradeInput,
} from "./smartAlertEngine";

const LOG = "[YouTrader:smart-push]";
const SCHEDULED_IDS_KEY = "smart-push-scheduled-ids-v2";
const LAST_SENT_KEY = "smart-push-last-sent-v2";
const DAILY_JOURNAL_HOUR = 18;
const DAILY_JOURNAL_MINUTE = 0;
const WEEKLY_REVIEW_DAY = 0;
const WEEKLY_REVIEW_HOUR = 19;
const WEEKLY_REVIEW_MINUTE = 0;

const COOLDOWN_MS: Partial<Record<SmartPushAlertId, number>> = {
  missed_journal_today: 24 * 60 * 60 * 1000,
  inactivity_5_days: 3 * 24 * 60 * 60 * 1000,
  daily_loss_limit_warning: 24 * 60 * 60 * 1000,
  daily_loss_limit_reached: 24 * 60 * 60 * 1000,
  prop_firm_buffer_warning: 24 * 60 * 60 * 1000,
  win_rate_drop_alert: 7 * 24 * 60 * 60 * 1000,
  overtrading_alert: 24 * 60 * 60 * 1000,
  revenge_trading_alert: 24 * 60 * 60 * 1000,
  consistency_check: 7 * 24 * 60 * 60 * 1000,
  weekly_performance_review: 7 * 24 * 60 * 60 * 1000,
  ai_coach_summary_reminder: 7 * 24 * 60 * 60 * 1000,
  profit_protection_alert: 24 * 60 * 60 * 1000,
  best_setup_reminder: 24 * 60 * 60 * 1000,
  cpi_30_min_alert: 6 * 60 * 60 * 1000,
  fomc_30_min_alert: 6 * 60 * 60 * 1000,
  nfp_30_min_alert: 6 * 60 * 60 * 1000,
};

function logSmartPush(event: string, payload?: Record<string, unknown>) {
  if (payload) logger.info(`${LOG} ${event}`, payload);
  else logger.info(`${LOG} ${event}`);
}

function alertCopy(alertId: SmartPushAlertId) {
  const keys = ALERT_I18N_KEYS[alertId];
  return { title: t(keys.title), body: t(keys.body) };
}

async function readScheduledIds(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeScheduledIds(map: Record<string, string>) {
  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(map));
}

async function readLastSent(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SENT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeLastSent(map: Record<string, number>) {
  await AsyncStorage.setItem(LAST_SENT_KEY, JSON.stringify(map));
}

export async function getNotificationPermissionStatus() {
  if (Platform.OS === "web") return { granted: false, canAsk: false };
  const current = await Notifications.getPermissionsAsync();
  return { granted: current.granted, canAsk: !current.granted };
}

/** Request permission only when user enables a notification toggle. */
export async function requestSmartPushPermission(reason: SmartPushPreferenceKey): Promise<boolean> {
  if (Platform.OS === "web") return false;
  logSmartPush("permission_requested", { reason });
  try {
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (permission.granted) {
      logSmartPush("permission_granted", { reason });
      trackEvent("notification_enabled", { reason, granted: true });
      return true;
    }
    logSmartPush("permission_denied", { reason });
    return false;
  } catch (error) {
    captureAppError(error, { feature: "notifications", action: "request_permission", reason });
    return false;
  }
}

async function cancelScheduledKey(storageKey: string) {
  const map = await readScheduledIds();
  const id = map[storageKey];
  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
      logSmartPush("cancelled", { storageKey, id });
    } catch {
      // ignore stale ids
    }
    delete map[storageKey];
    await writeScheduledIds(map);
  }
}

async function scheduleStoredNotification(input: {
  storageKey: string;
  alertId: SmartPushAlertId;
  trigger: Notifications.NotificationTriggerInput;
}) {
  const copy = alertCopy(input.alertId);
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      sound: false,
      data: { alertId: input.alertId, kind: "smart_push" },
    },
    trigger: input.trigger,
  });
  const map = await readScheduledIds();
  map[input.storageKey] = id;
  await writeScheduledIds(map);
  logSmartPush("scheduled", { storageKey: input.storageKey, alertId: input.alertId, id });
  return id;
}

async function canSendImmediate(alertId: SmartPushAlertId, eventKey?: string) {
  const lastSent = await readLastSent();
  const key = eventKey ? `${alertId}:${eventKey}` : alertId;
  const cooldown = COOLDOWN_MS[alertId] ?? 12 * 60 * 60 * 1000;
  const prev = lastSent[key];
  if (!prev) return true;
  return Date.now() - prev >= cooldown;
}

async function markSent(alertId: SmartPushAlertId, eventKey?: string) {
  const lastSent = await readLastSent();
  const key = eventKey ? `${alertId}:${eventKey}` : alertId;
  lastSent[key] = Date.now();
  await writeLastSent(lastSent);
}

export async function sendImmediateSmartAlert(alertId: SmartPushAlertId, eventKey?: string) {
  if (Platform.OS === "web") return null;
  if (!(await canSendImmediate(alertId, eventKey))) {
    logSmartPush("skipped_cooldown", { alertId, eventKey });
    return null;
  }
  const copy = alertCopy(alertId);
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      sound: false,
      data: { alertId, kind: "smart_push" },
    },
    trigger: null,
  });
  await markSent(alertId, eventKey);
  logSmartPush("triggered_condition", { alertId, eventKey, id });
  trackEvent("smart_notification_sent", { alert_type: alertId });
  return id;
}

export async function cancelAllSmartPushSchedules() {
  const map = await readScheduledIds();
  await Promise.all(
    Object.entries(map).map(async ([key, id]) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // ignore
      }
      logSmartPush("cancelled", { storageKey: key, id });
    }),
  );
  await writeScheduledIds({});
}

export async function syncSmartPushSchedules(input: {
  isPro: boolean;
  calendarEvents?: CalendarEventInput[];
}) {
  if (Platform.OS === "web") return;
  const prefs = await getSmartPushPreferences();
  const enabled = enabledAlertIds(prefs);
  await cancelAllSmartPushSchedules();

  if (!enabled.length) return;
  const status = await getNotificationPermissionStatus();
  if (!status.granted) return;

  if (enabled.includes("missed_journal_today") && prefs.dailyJournalReminder) {
    await scheduleStoredNotification({
      storageKey: "daily:journal",
      alertId: "missed_journal_today",
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: DAILY_JOURNAL_HOUR,
        minute: DAILY_JOURNAL_MINUTE,
      },
    });
  }

  if (
    (enabled.includes("weekly_performance_review") && prefs.weeklyPerformanceReview && input.isPro) ||
    (enabled.includes("ai_coach_summary_reminder") && prefs.aiCoachSummaryReminder && input.isPro)
  ) {
    const alertId: SmartPushAlertId = prefs.weeklyPerformanceReview
      ? "weekly_performance_review"
      : "ai_coach_summary_reminder";
    await scheduleStoredNotification({
      storageKey: "weekly:review",
      alertId,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: WEEKLY_REVIEW_DAY + 1,
        hour: WEEKLY_REVIEW_HOUR,
        minute: WEEKLY_REVIEW_MINUTE,
      },
    });
  }

  if (prefs.economicCalendarAlerts) {
    for (const event of input.calendarEvents || []) {
      const analysis = analyzeSmartAlertData({ trades: [], calendarEvents: [event] });
      const upcoming = analysis.upcomingEvents[0];
      if (!upcoming) continue;
      const alertId = upcoming.alertId;
      if (!enabled.includes(alertId)) continue;
      const seconds = Math.max(60, Math.floor((upcoming.atMs - Date.now()) / 1000));
      await scheduleStoredNotification({
        storageKey: `econ:${event.id}:${alertId}`,
        alertId,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });
    }
  }
}

export async function evaluateSmartPushConditions(input: {
  trades: SmartTradeInput[];
  isPro: boolean;
  calendarEvents?: CalendarEventInput[];
  propSnapshot?: PropRiskSnapshotInput | null;
}) {
  if (Platform.OS === "web") return;
  const prefs = await getSmartPushPreferences();
  const enabled = new Set(enabledAlertIds(prefs));
  if (!enabled.size) return;

  const status = await getNotificationPermissionStatus();
  if (!status.granted) return;

  const analysis = analyzeSmartAlertData({
    trades: input.trades,
    calendarEvents: input.calendarEvents,
    propSnapshot: input.propSnapshot,
  });

  const tryAlert = async (alertId: SmartPushAlertId, condition: boolean, eventKey?: string) => {
    if (!enabled.has(alertId)) return;
    if (ALERT_PRO_ONLY[alertId] && !input.isPro) {
      logSmartPush("skipped_not_pro", { alertId });
      return;
    }
    if (!condition) return;
    await sendImmediateSmartAlert(alertId, eventKey);
  };

  if (enabled.has("missed_journal_today") && analysis.tradesToday === 0) {
    const hour = new Date().getHours();
    if (hour >= DAILY_JOURNAL_HOUR) {
      await tryAlert("missed_journal_today", true, analysis.todayIso);
    }
  }

  await tryAlert(
    "inactivity_5_days",
    analysis.daysSinceLastTrade != null && analysis.daysSinceLastTrade >= 5,
    analysis.lastTradeDate || "none",
  );

  await tryAlert("daily_loss_limit_warning", analysis.nearDailyLossLimit, analysis.todayIso);
  await tryAlert("daily_loss_limit_reached", analysis.dailyLossLimitReached, analysis.todayIso);
  await tryAlert("prop_firm_buffer_warning", analysis.propBufferTight, analysis.todayIso);
  await tryAlert("win_rate_drop_alert", analysis.enoughDataForWinRateAlert, analysis.todayIso);
  await tryAlert("overtrading_alert", analysis.overtradingToday, analysis.todayIso);
  await tryAlert("revenge_trading_alert", analysis.revengeTradingToday, analysis.todayIso);
  await tryAlert("consistency_check", analysis.consistencyGap, analysis.todayIso);
  await tryAlert("profit_protection_alert", analysis.profitGivebackDetected, analysis.todayIso);
  await tryAlert(
    "best_setup_reminder",
    input.isPro && analysis.bestSessionHour != null && new Date().getHours() === Math.max(0, analysis.bestSessionHour - 1),
    analysis.todayIso,
  );

  if (!analysis.enoughDataForAiCoach && enabled.has("ai_coach_summary_reminder")) {
    logSmartPush("skipped_not_enough_data", { alertId: "ai_coach_summary_reminder" });
  }
}

export async function setMasterNotificationGroupEnabled(input: {
  groupId: NotificationMasterGroupId;
  enabled: boolean;
  isPro: boolean;
  calendarEvents?: CalendarEventInput[];
  refreshDailyPropBuffer?: () => Promise<void>;
}) {
  if (input.enabled && isMasterGroupProOnly(input.groupId) && !input.isPro) {
    logSmartPush("skipped_not_pro", { group: input.groupId });
    return { ok: false as const, reason: "pro_required" as const };
  }

  if (input.enabled && input.groupId !== "dailyTradingBrief" && Platform.OS !== "web") {
    const sampleKey =
      input.groupId === "economicEvents"
        ? "economicCalendarAlerts"
        : input.groupId === "performanceInsights"
          ? "winRateDropAlert"
          : input.groupId === "riskProtection"
            ? "dailyLossLimitWarning"
            : "dailyJournalReminder";
    const granted = await requestSmartPushPermission(sampleKey);
    if (!granted) return { ok: false as const, reason: "permission_denied" as const };
  }

  const masters = await getNotificationMasterGroups();
  const nextMasters: NotificationMasterGroupPrefs = { ...masters, [input.groupId]: input.enabled };

  if (input.groupId === "dailyTradingBrief") {
    const briefResult = await setDailyTradingBriefEnabled(input.enabled, {
      refreshPropBuffer: input.refreshDailyPropBuffer,
    });
    if (!briefResult.ok) {
      return { ok: false as const, reason: "permission_denied" as const };
    }
  }

  await saveNotificationMasterGroups(nextMasters);
  const prefs = applyMasterGroupsToSmartPrefs(nextMasters, input.isPro);
  await setSmartPushPreferences(prefs);
  await syncSmartPushSchedules({ isPro: input.isPro, calendarEvents: input.calendarEvents });

  trackEvent(input.enabled ? "notification_enabled" : "notification_disabled", {
    master_group: input.groupId,
    pro_only: isMasterGroupProOnly(input.groupId),
  });

  return { ok: true as const, masters: nextMasters, prefs };
}

export async function setSmartPushPreferenceEnabled(input: {
  key: SmartPushPreferenceKey;
  enabled: boolean;
  isPro: boolean;
  calendarEvents?: CalendarEventInput[];
}) {
  if (input.enabled && Platform.OS !== "web") {
    const granted = await requestSmartPushPermission(input.key);
    if (!granted) return { ok: false as const, reason: "permission_denied" as const };
  }

  if (input.enabled && isProOnlyPreference(input.key) && !input.isPro) {
    logSmartPush("skipped_not_pro", { preference: input.key });
    return { ok: false as const, reason: "pro_required" as const };
  }

  const next = await setSmartPushPreference(input.key, input.enabled);
  await syncSmartPushSchedules({ isPro: input.isPro, calendarEvents: input.calendarEvents });
  trackEvent(input.enabled ? "notification_enabled" : "notification_disabled", {
    preference: input.key,
    pro_only: isProOnlyPreference(input.key),
  });
  return { ok: true as const, prefs: next };
}

export async function toggleSmartPushPreference(input: {
  key: SmartPushPreferenceKey;
  enabled: boolean;
  isPro: boolean;
  calendarEvents?: CalendarEventInput[];
}) {
  return setSmartPushPreferenceEnabled(input);
}
