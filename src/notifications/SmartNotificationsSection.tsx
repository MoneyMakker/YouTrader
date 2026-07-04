import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { t } from "../i18n";
import { C } from "../theme/colors";
import {
  BASIC_PREFERENCE_KEYS,
  getSmartPushPreferences,
  isProOnlyPreference,
  PREF_I18N_KEYS,
  PRO_ONLY_PREFERENCE_KEYS,
  type SmartPushPreferenceKey,
  type SmartPushPreferences,
} from "./notificationPreferences";
import { setSmartPushPreferenceEnabled } from "./smartAlerts";
import type { CalendarEventInput } from "./smartAlertEngine";

type Props = {
  isPro: boolean;
  calendarEvents?: CalendarEventInput[];
  onUpgrade: () => void;
};

function ProBadge() {
  return (
    <View style={styles.proBadge}>
      <Text style={styles.proBadgeText}>{t("notificationsProBadge")}</Text>
    </View>
  );
}

function ToggleRow({
  prefKey,
  prefs,
  isPro,
  onToggle,
}: {
  prefKey: SmartPushPreferenceKey;
  prefs: SmartPushPreferences;
  isPro: boolean;
  onToggle: (key: SmartPushPreferenceKey, next: boolean) => void;
}) {
  const locked = isProOnlyPreference(prefKey) && !isPro;
  const copy = PREF_I18N_KEYS[prefKey];
  const value = prefs[prefKey];

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, locked && styles.titleLocked]}>{t(copy.title)}</Text>
          {isProOnlyPreference(prefKey) ? <ProBadge /> : null}
        </View>
        <Text style={styles.sub}>{t(copy.body)}</Text>
      </View>
      <Switch
        value={value && !locked}
        disabled={locked && !value}
        onValueChange={(next) => onToggle(prefKey, next)}
        trackColor={{ false: "#222936", true: "rgba(176,38,255,0.55)" }}
        thumbColor={value && !locked ? C.purple : "#7D8795"}
        ios_backgroundColor="#222936"
      />
    </View>
  );
}

export function SmartNotificationsSection({ isPro, calendarEvents, onUpgrade }: Props) {
  const [prefs, setPrefs] = useState<SmartPushPreferences | null>(null);

  useEffect(() => {
    void getSmartPushPreferences().then(setPrefs);
  }, []);

  const handleToggle = useCallback(
    async (key: SmartPushPreferenceKey, enabled: boolean) => {
      if (isProOnlyPreference(key) && !isPro) {
        Alert.alert(t("notificationsProLockedTitle"), t("notificationsProLockedBody"), [
          { text: t("cancel"), style: "cancel" },
          { text: t("upgradeToPro"), onPress: onUpgrade },
        ]);
        return;
      }

      const result = await setSmartPushPreferenceEnabled({
        key,
        enabled,
        isPro,
        calendarEvents,
      });

      if (!result.ok && result.reason === "permission_denied") {
        Alert.alert(t("notifications"), t("notificationsPermissionDenied"));
        return;
      }
      if (!result.ok && result.reason === "pro_required") {
        Alert.alert(t("notificationsProLockedTitle"), t("notificationsProLockedBody"), [
          { text: t("cancel"), style: "cancel" },
          { text: t("upgradeToPro"), onPress: onUpgrade },
        ]);
        return;
      }
      if (result.ok) setPrefs(result.prefs);
    },
    [calendarEvents, isPro, onUpgrade],
  );

  if (!prefs) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionTitle}>{t("notificationsSmartTitle")}</Text>
      <Text style={styles.sectionSub}>{t("notificationsSmartSub")}</Text>

      <Text style={styles.groupLabel}>{t("notificationsBasicReminders")}</Text>
      {BASIC_PREFERENCE_KEYS.map((key) => (
        <React.Fragment key={key}>
          <ToggleRow prefKey={key} prefs={prefs} isPro={isPro} onToggle={handleToggle} />
          <View style={styles.divider} />
        </React.Fragment>
      ))}

      <Text style={[styles.groupLabel, { marginTop: 8 }]}>{t("notificationsProSmartAlerts")}</Text>
      {!isPro ? (
        <Pressable onPress={onUpgrade} style={styles.previewChip}>
          <Text style={styles.previewText}>{t("notificationsProPreview")}</Text>
        </Pressable>
      ) : null}
      {PRO_ONLY_PREFERENCE_KEYS.map((key) => (
        <React.Fragment key={key}>
          <ToggleRow prefKey={key} prefs={prefs} isPro={isPro} onToggle={handleToggle} />
          <View style={styles.divider} />
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(176,38,255,0.22)",
    marginBottom: 14,
    marginTop: 6,
  },
  sectionTitle: {
    color: C.purple,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
  },
  sectionSub: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  groupLabel: {
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  copy: {
    flex: 1,
    paddingRight: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    color: C.text,
    fontSize: 15,
    fontWeight: "700",
  },
  titleLocked: {
    color: C.sub,
  },
  sub: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(176,38,255,0.22)",
  },
  proBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "rgba(176,38,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.45)",
  },
  proBadgeText: {
    color: C.purple,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  previewChip: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(176,38,255,0.35)",
    backgroundColor: "rgba(176,38,255,0.08)",
  },
  previewText: {
    color: C.purple,
    fontSize: 12,
    fontWeight: "700",
  },
});
