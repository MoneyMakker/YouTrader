import AsyncStorage from "@react-native-async-storage/async-storage";
import { captureAppError } from "../observability/monitoring";

export type SmartPushAlertId =
  | "missed_journal_today"
  | "inactivity_5_days"
  | "daily_loss_limit_warning"
  | "daily_loss_limit_reached"
  | "prop_firm_buffer_warning"
  | "cpi_30_min_alert"
  | "fomc_30_min_alert"
  | "nfp_30_min_alert"
  | "win_rate_drop_alert"
  | "overtrading_alert"
  | "revenge_trading_alert"
  | "consistency_check"
  | "weekly_performance_review"
  | "ai_coach_summary_reminder"
  | "profit_protection_alert"
  | "best_setup_reminder";

export type SmartPushPreferenceKey =
  | "dailyJournalReminder"
  | "inactivityReminder"
  | "economicCalendarAlerts"
  | "smartRiskAlerts"
  | "dailyLossLimitWarning"
  | "propFirmBufferWarning"
  | "winRateDropAlert"
  | "overtradingAlert"
  | "revengeTradingAlert"
  | "consistencyCheck"
  | "weeklyPerformanceReview"
  | "aiCoachSummaryReminder"
  | "profitProtectionAlert"
  | "bestSetupReminder";

/** Legacy keys from push.ts — kept for migration. */
export type LegacyNotificationPreferenceKey =
  | "logTodayTrade"
  | "weeklyReportReady"
  | "dailyBriefReady"
  | "riskLimitClose"
  | "propDailyBufferAtRisk";

export type SmartPushPreferences = Record<SmartPushPreferenceKey, boolean>;

const PREFS_KEY = "smart-push-preferences-v2";
const LEGACY_PREFS_KEY = "notification-preferences-v1";

export const DEFAULT_SMART_PUSH_PREFERENCES: SmartPushPreferences = {
  dailyJournalReminder: false,
  inactivityReminder: false,
  economicCalendarAlerts: false,
  smartRiskAlerts: false,
  dailyLossLimitWarning: false,
  propFirmBufferWarning: false,
  winRateDropAlert: false,
  overtradingAlert: false,
  revengeTradingAlert: false,
  consistencyCheck: false,
  weeklyPerformanceReview: false,
  aiCoachSummaryReminder: false,
  profitProtectionAlert: false,
  bestSetupReminder: false,
};

export const PRO_ONLY_PREFERENCE_KEYS: SmartPushPreferenceKey[] = [
  "smartRiskAlerts",
  "dailyLossLimitWarning",
  "propFirmBufferWarning",
  "winRateDropAlert",
  "overtradingAlert",
  "revengeTradingAlert",
  "consistencyCheck",
  "weeklyPerformanceReview",
  "aiCoachSummaryReminder",
  "profitProtectionAlert",
  "bestSetupReminder",
];

export const BASIC_PREFERENCE_KEYS: SmartPushPreferenceKey[] = [
  "dailyJournalReminder",
  "inactivityReminder",
  "economicCalendarAlerts",
];

export const PREFERENCE_ALERT_MAP: Record<SmartPushPreferenceKey, SmartPushAlertId[]> = {
  dailyJournalReminder: ["missed_journal_today"],
  inactivityReminder: ["inactivity_5_days"],
  economicCalendarAlerts: ["cpi_30_min_alert", "fomc_30_min_alert", "nfp_30_min_alert"],
  smartRiskAlerts: ["daily_loss_limit_warning", "daily_loss_limit_reached"],
  dailyLossLimitWarning: ["daily_loss_limit_warning", "daily_loss_limit_reached"],
  propFirmBufferWarning: ["prop_firm_buffer_warning"],
  winRateDropAlert: ["win_rate_drop_alert"],
  overtradingAlert: ["overtrading_alert"],
  revengeTradingAlert: ["revenge_trading_alert"],
  consistencyCheck: ["consistency_check"],
  weeklyPerformanceReview: ["weekly_performance_review"],
  aiCoachSummaryReminder: ["ai_coach_summary_reminder"],
  profitProtectionAlert: ["profit_protection_alert"],
  bestSetupReminder: ["best_setup_reminder"],
};

export const PREF_I18N_KEYS: Record<SmartPushPreferenceKey, { title: string; body: string }> = {
  dailyJournalReminder: {
    title: "notificationsPrefDailyJournalTitle",
    body: "notificationsPrefDailyJournalBody",
  },
  inactivityReminder: {
    title: "notificationsPrefInactivityTitle",
    body: "notificationsPrefInactivityBody",
  },
  economicCalendarAlerts: {
    title: "notificationsPrefEconomicCalendarTitle",
    body: "notificationsPrefEconomicCalendarBody",
  },
  smartRiskAlerts: {
    title: "notificationsPrefSmartRiskTitle",
    body: "notificationsPrefSmartRiskBody",
  },
  dailyLossLimitWarning: {
    title: "notificationsPrefDailyLossLimitTitle",
    body: "notificationsPrefDailyLossLimitBody",
  },
  propFirmBufferWarning: {
    title: "notificationsPrefPropFirmBufferTitle",
    body: "notificationsPrefPropFirmBufferBody",
  },
  winRateDropAlert: {
    title: "notificationsPrefWinRateDropTitle",
    body: "notificationsPrefWinRateDropBody",
  },
  overtradingAlert: {
    title: "notificationsPrefOvertradingTitle",
    body: "notificationsPrefOvertradingBody",
  },
  revengeTradingAlert: {
    title: "notificationsPrefRevengeTradingTitle",
    body: "notificationsPrefRevengeTradingBody",
  },
  consistencyCheck: {
    title: "notificationsPrefConsistencyTitle",
    body: "notificationsPrefConsistencyBody",
  },
  weeklyPerformanceReview: {
    title: "notificationsPrefWeeklyReviewTitle",
    body: "notificationsPrefWeeklyReviewBody",
  },
  aiCoachSummaryReminder: {
    title: "notificationsPrefAiCoachTitle",
    body: "notificationsPrefAiCoachBody",
  },
  profitProtectionAlert: {
    title: "notificationsPrefProfitProtectionTitle",
    body: "notificationsPrefProfitProtectionBody",
  },
  bestSetupReminder: {
    title: "notificationsPrefBestSetupTitle",
    body: "notificationsPrefBestSetupBody",
  },
};

export const ALERT_I18N_KEYS: Record<SmartPushAlertId, { title: string; body: string }> = {
  missed_journal_today: {
    title: "notificationsAlertMissedJournalTitle",
    body: "notificationsAlertMissedJournalBody",
  },
  inactivity_5_days: {
    title: "notificationsAlertInactivityTitle",
    body: "notificationsAlertInactivityBody",
  },
  daily_loss_limit_warning: {
    title: "notificationsAlertDailyLossWarningTitle",
    body: "notificationsAlertDailyLossWarningBody",
  },
  daily_loss_limit_reached: {
    title: "notificationsAlertDailyLossReachedTitle",
    body: "notificationsAlertDailyLossReachedBody",
  },
  prop_firm_buffer_warning: {
    title: "notificationsAlertPropFirmBufferTitle",
    body: "notificationsAlertPropFirmBufferBody",
  },
  cpi_30_min_alert: {
    title: "notificationsAlertCpiTitle",
    body: "notificationsAlertCpiBody",
  },
  fomc_30_min_alert: {
    title: "notificationsAlertFomcTitle",
    body: "notificationsAlertFomcBody",
  },
  nfp_30_min_alert: {
    title: "notificationsAlertNfpTitle",
    body: "notificationsAlertNfpBody",
  },
  win_rate_drop_alert: {
    title: "notificationsAlertWinRateDropTitle",
    body: "notificationsAlertWinRateDropBody",
  },
  overtrading_alert: {
    title: "notificationsAlertOvertradingTitle",
    body: "notificationsAlertOvertradingBody",
  },
  revenge_trading_alert: {
    title: "notificationsAlertRevengeTradingTitle",
    body: "notificationsAlertRevengeTradingBody",
  },
  consistency_check: {
    title: "notificationsAlertConsistencyTitle",
    body: "notificationsAlertConsistencyBody",
  },
  weekly_performance_review: {
    title: "notificationsAlertWeeklyReviewTitle",
    body: "notificationsAlertWeeklyReviewBody",
  },
  ai_coach_summary_reminder: {
    title: "notificationsAlertAiCoachTitle",
    body: "notificationsAlertAiCoachBody",
  },
  profit_protection_alert: {
    title: "notificationsAlertProfitProtectionTitle",
    body: "notificationsAlertProfitProtectionBody",
  },
  best_setup_reminder: {
    title: "notificationsAlertBestSetupTitle",
    body: "notificationsAlertBestSetupBody",
  },
};

export const ALERT_PRO_ONLY: Record<SmartPushAlertId, boolean> = {
  missed_journal_today: false,
  inactivity_5_days: false,
  daily_loss_limit_warning: true,
  daily_loss_limit_reached: true,
  prop_firm_buffer_warning: true,
  cpi_30_min_alert: false,
  fomc_30_min_alert: false,
  nfp_30_min_alert: false,
  win_rate_drop_alert: true,
  overtrading_alert: true,
  revenge_trading_alert: true,
  consistency_check: true,
  weekly_performance_review: true,
  ai_coach_summary_reminder: true,
  profit_protection_alert: true,
  best_setup_reminder: true,
};

export function isProOnlyPreference(key: SmartPushPreferenceKey) {
  return PRO_ONLY_PREFERENCE_KEYS.includes(key);
}

export function enabledAlertIds(prefs: SmartPushPreferences): SmartPushAlertId[] {
  const ids = new Set<SmartPushAlertId>();
  for (const [pref, alertIds] of Object.entries(PREFERENCE_ALERT_MAP) as [SmartPushPreferenceKey, SmartPushAlertId[]][]) {
    if (!prefs[pref]) continue;
    alertIds.forEach((id) => ids.add(id));
  }
  return [...ids];
}

async function migrateLegacyPrefs(raw: string | null): Promise<SmartPushPreferences | null> {
  if (!raw) return null;
  try {
    const legacy = JSON.parse(raw) as Partial<Record<LegacyNotificationPreferenceKey, boolean>>;
    const next = { ...DEFAULT_SMART_PUSH_PREFERENCES };
    if (legacy.logTodayTrade) next.dailyJournalReminder = true;
    if (legacy.dailyBriefReady) next.economicCalendarAlerts = true;
    if (legacy.propDailyBufferAtRisk) next.propFirmBufferWarning = true;
    if (legacy.riskLimitClose) next.dailyLossLimitWarning = true;
    return next;
  } catch {
    return null;
  }
}

export async function getSmartPushPreferences(): Promise<SmartPushPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) {
      return { ...DEFAULT_SMART_PUSH_PREFERENCES, ...JSON.parse(raw) };
    }
    const legacy = await migrateLegacyPrefs(await AsyncStorage.getItem(LEGACY_PREFS_KEY));
    if (legacy) {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(legacy));
      return legacy;
    }
    return DEFAULT_SMART_PUSH_PREFERENCES;
  } catch (error) {
    captureAppError(error, { feature: "notifications", action: "read_smart_push_preferences" });
    return DEFAULT_SMART_PUSH_PREFERENCES;
  }
}

export async function setSmartPushPreference(key: SmartPushPreferenceKey, enabled: boolean) {
  const current = await getSmartPushPreferences();
  const next = { ...current, [key]: enabled };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}

export async function setSmartPushPreferences(next: SmartPushPreferences) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}
