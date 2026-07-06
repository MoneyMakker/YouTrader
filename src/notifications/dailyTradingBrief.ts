import AsyncStorage from "@react-native-async-storage/async-storage";
import { t } from "../i18n";
import { captureAppError } from "../observability/monitoring";
import { clearLocalReminder, scheduleLocalReminder } from "./push";
import { requestSmartPushPermission } from "./smartAlerts";
import { scheduleDailyPropRiskNotification } from "../utils/propRiskNotification";

export const LOCK_SCREEN_BUFFER_KEY = "prop-lock-screen-v1";
export const PROP_RISK_ALERT_ID_KEY = "prop-risk-alert-notification-id-v1";
export const CALENDAR_ALERT_ID_KEY = "calendar-alert-notification-id-v1";
const CALENDAR_ALERTS_STORAGE_KEY = "calendar-alerts-v1";
const PROP_RISK_ALERTS_STORAGE_KEY = "prop-risk-alerts-v1";

export type DailyTradingBriefLegacyState = {
  lockScreen: boolean;
  calendar: boolean;
  propRisk: boolean;
};

export async function readDailyTradingBriefLegacyState(): Promise<DailyTradingBriefLegacyState> {
  const [lockScreen, calendar, propRisk] = await Promise.all([
    AsyncStorage.getItem(LOCK_SCREEN_BUFFER_KEY),
    AsyncStorage.getItem(CALENDAR_ALERTS_STORAGE_KEY),
    AsyncStorage.getItem(PROP_RISK_ALERTS_STORAGE_KEY),
  ]);
  return {
    lockScreen: lockScreen === "on",
    calendar: calendar === "on",
    propRisk: propRisk === "on",
  };
}

export async function isDailyTradingBriefEnabled() {
  const state = await readDailyTradingBriefLegacyState();
  return state.lockScreen || state.calendar || state.propRisk;
}

export async function setDailyTradingBriefEnabled(
  enabled: boolean,
  options?: { refreshPropBuffer?: () => Promise<void> },
): Promise<{ ok: true } | { ok: false; reason: "permission_denied" }> {
  try {
    if (!enabled) {
      await clearLocalReminder(CALENDAR_ALERT_ID_KEY, "dailyBriefReady", { skipPreferenceSync: true });
      await clearLocalReminder(PROP_RISK_ALERT_ID_KEY, "propDailyBufferAtRisk", {
        skipPreferenceSync: true,
      });
      await AsyncStorage.multiSet([
        [CALENDAR_ALERTS_STORAGE_KEY, "off"],
        [PROP_RISK_ALERTS_STORAGE_KEY, "off"],
        [LOCK_SCREEN_BUFFER_KEY, "off"],
      ]);
      await scheduleDailyPropRiskNotification({ enabled: false, title: "", body: "" });
      return { ok: true };
    }

    const granted = await requestSmartPushPermission("dailyJournalReminder");
    if (!granted) return { ok: false, reason: "permission_denied" };

    await AsyncStorage.setItem(LOCK_SCREEN_BUFFER_KEY, "on");
    if (options?.refreshPropBuffer) {
      await options.refreshPropBuffer();
    } else {
      await scheduleDailyPropRiskNotification({ enabled: false, title: "", body: "" });
    }

    const calendarId = await scheduleLocalReminder({
      idKey: CALENDAR_ALERT_ID_KEY,
      title: t("youTraderEconomicCalendar"),
      body: t("economicCalendarReminderBody"),
      hour: 7,
      minute: 45,
      preference: "dailyBriefReady",
      skipPreferenceSync: true,
    });
    if (!calendarId) return { ok: false, reason: "permission_denied" };
    await AsyncStorage.setItem(CALENDAR_ALERTS_STORAGE_KEY, "on");

    const propRiskId = await scheduleLocalReminder({
      idKey: PROP_RISK_ALERT_ID_KEY,
      title: t("youTraderRiskCoach"),
      body: t("riskCoachReminderBody"),
      hour: 8,
      minute: 15,
      preference: "propDailyBufferAtRisk",
      skipPreferenceSync: true,
    });
    if (!propRiskId) {
      await clearLocalReminder(CALENDAR_ALERT_ID_KEY, "dailyBriefReady", { skipPreferenceSync: true });
      await AsyncStorage.multiSet([
        [CALENDAR_ALERTS_STORAGE_KEY, "off"],
        [LOCK_SCREEN_BUFFER_KEY, "off"],
      ]);
      return { ok: false, reason: "permission_denied" };
    }
    await AsyncStorage.setItem(PROP_RISK_ALERTS_STORAGE_KEY, "on");
    return { ok: true };
  } catch (error) {
    captureAppError(error, { feature: "notifications", action: "toggle_daily_trading_brief" });
    return { ok: false, reason: "permission_denied" };
  }
}
