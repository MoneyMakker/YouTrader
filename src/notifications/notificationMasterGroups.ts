import AsyncStorage from "@react-native-async-storage/async-storage";
import { captureAppError } from "../observability/monitoring";
import {
  DEFAULT_SMART_PUSH_PREFERENCES,
  getSmartPushPreferences,
  isProOnlyPreference,
  type SmartPushPreferenceKey,
  type SmartPushPreferences,
} from "./notificationPreferences";
import { isDailyTradingBriefEnabled, readDailyTradingBriefLegacyState } from "./dailyTradingBrief";

export type NotificationMasterGroupId =
  | "smartTradingCoach"
  | "riskProtection"
  | "economicEvents"
  | "performanceInsights"
  | "dailyTradingBrief";

export const NOTIFICATION_MASTER_GROUP_ORDER: NotificationMasterGroupId[] = [
  "smartTradingCoach",
  "riskProtection",
  "economicEvents",
  "performanceInsights",
  "dailyTradingBrief",
];

export const MASTER_GROUP_CHILD_KEYS: Record<
  NotificationMasterGroupId,
  SmartPushPreferenceKey[]
> = {
  smartTradingCoach: [
    "dailyJournalReminder",
    "inactivityReminder",
    "consistencyCheck",
    "bestSetupReminder",
    "weeklyPerformanceReview",
    "aiCoachSummaryReminder",
  ],
  riskProtection: [
    "dailyLossLimitWarning",
    "smartRiskAlerts",
    "propFirmBufferWarning",
    "revengeTradingAlert",
    "overtradingAlert",
    "profitProtectionAlert",
  ],
  economicEvents: ["economicCalendarAlerts"],
  performanceInsights: ["winRateDropAlert", "weeklyPerformanceReview", "aiCoachSummaryReminder"],
  dailyTradingBrief: [],
};

export const MASTER_GROUP_I18N: Record<
  NotificationMasterGroupId,
  { title: string; body: string; proOnly?: boolean }
> = {
  smartTradingCoach: {
    title: "notificationsMasterSmartCoachTitle",
    body: "notificationsMasterSmartCoachBody",
  },
  riskProtection: {
    title: "notificationsMasterRiskProtectionTitle",
    body: "notificationsMasterRiskProtectionBody",
    proOnly: true,
  },
  economicEvents: {
    title: "notificationsMasterEconomicEventsTitle",
    body: "notificationsMasterEconomicEventsBody",
  },
  performanceInsights: {
    title: "notificationsMasterPerformanceInsightsTitle",
    body: "notificationsMasterPerformanceInsightsBody",
    proOnly: true,
  },
  dailyTradingBrief: {
    title: "notificationsMasterDailyBriefTitle",
    body: "notificationsMasterDailyBriefBody",
  },
};

export type NotificationMasterGroupPrefs = Record<NotificationMasterGroupId, boolean>;

const MASTER_PREFS_KEY = "notification-master-groups-v1";

export const DEFAULT_MASTER_GROUP_PREFS: NotificationMasterGroupPrefs = {
  smartTradingCoach: false,
  riskProtection: false,
  economicEvents: false,
  performanceInsights: false,
  dailyTradingBrief: false,
};

export function isMasterGroupProOnly(groupId: NotificationMasterGroupId) {
  return MASTER_GROUP_I18N[groupId].proOnly === true;
}

export function applyMasterGroupsToSmartPrefs(
  masters: NotificationMasterGroupPrefs,
  isPro: boolean,
): SmartPushPreferences {
  const prefs: SmartPushPreferences = { ...DEFAULT_SMART_PUSH_PREFERENCES };
  for (const groupId of NOTIFICATION_MASTER_GROUP_ORDER) {
    if (!masters[groupId]) continue;
    if (isMasterGroupProOnly(groupId) && !isPro) continue;
    for (const key of MASTER_GROUP_CHILD_KEYS[groupId]) {
      if (isProOnlyPreference(key) && !isPro) continue;
      prefs[key] = true;
    }
  }
  return prefs;
}

function deriveMasterGroupsFromLegacy(
  prefs: SmartPushPreferences,
  brief: { lockScreen: boolean; calendar: boolean; propRisk: boolean },
): NotificationMasterGroupPrefs {
  const anyBrief = brief.lockScreen || brief.calendar || brief.propRisk;
  return {
    smartTradingCoach: MASTER_GROUP_CHILD_KEYS.smartTradingCoach.some((key) => prefs[key]),
    riskProtection: MASTER_GROUP_CHILD_KEYS.riskProtection.some((key) => prefs[key]),
    economicEvents: prefs.economicCalendarAlerts,
    performanceInsights: MASTER_GROUP_CHILD_KEYS.performanceInsights.some((key) => prefs[key]),
    dailyTradingBrief: anyBrief,
  };
}

export async function getNotificationMasterGroups(): Promise<NotificationMasterGroupPrefs> {
  try {
    const raw = await AsyncStorage.getItem(MASTER_PREFS_KEY);
    if (raw) {
      return { ...DEFAULT_MASTER_GROUP_PREFS, ...JSON.parse(raw) };
    }
    const [smartPrefs, brief] = await Promise.all([
      getSmartPushPreferences(),
      readDailyTradingBriefLegacyState(),
    ]);
    const derived = deriveMasterGroupsFromLegacy(smartPrefs, brief);
    await AsyncStorage.setItem(MASTER_PREFS_KEY, JSON.stringify(derived));
    return derived;
  } catch (error) {
    captureAppError(error, { feature: "notifications", action: "read_master_groups" });
    return DEFAULT_MASTER_GROUP_PREFS;
  }
}

export async function saveNotificationMasterGroups(next: NotificationMasterGroupPrefs) {
  await AsyncStorage.setItem(MASTER_PREFS_KEY, JSON.stringify(next));
  return next;
}

export async function refreshDailyTradingBriefMasterState(
  masters: NotificationMasterGroupPrefs,
): Promise<NotificationMasterGroupPrefs> {
  const briefOn = await isDailyTradingBriefEnabled();
  if (masters.dailyTradingBrief === briefOn) return masters;
  return { ...masters, dailyTradingBrief: briefOn };
}
