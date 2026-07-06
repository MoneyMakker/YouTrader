import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { t } from "../i18n";
import { C } from "../theme/colors";
import {
  MASTER_GROUP_I18N,
  NOTIFICATION_MASTER_GROUP_ORDER,
  getNotificationMasterGroups,
  refreshDailyTradingBriefMasterState,
  type NotificationMasterGroupId,
  type NotificationMasterGroupPrefs,
} from "./notificationMasterGroups";
import { setMasterNotificationGroupEnabled } from "./smartAlerts";
import type { CalendarEventInput } from "./smartAlertEngine";

type Props = {
  isPro: boolean;
  calendarEvents?: CalendarEventInput[];
  onUpgrade: () => void;
  refreshDailyPropBuffer?: () => Promise<void>;
};

function ProBadge() {
  return (
    <View style={styles.proBadge}>
      <Text style={styles.proBadgeText}>{t("notificationsProBadge")}</Text>
    </View>
  );
}

function MasterToggleRow({
  groupId,
  enabled,
  isPro,
  onToggle,
}: {
  groupId: NotificationMasterGroupId;
  enabled: boolean;
  isPro: boolean;
  onToggle: (groupId: NotificationMasterGroupId, next: boolean) => void;
}) {
  const copy = MASTER_GROUP_I18N[groupId];
  const locked = copy.proOnly && !isPro;
  const value = enabled && !locked;

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, locked && styles.titleLocked]}>{t(copy.title)}</Text>
          {copy.proOnly ? <ProBadge /> : null}
        </View>
        <Text style={styles.sub}>{t(copy.body)}</Text>
      </View>
      <Switch
        value={value}
        disabled={locked && !value}
        onValueChange={(next) => onToggle(groupId, next)}
        trackColor={{ false: "#222936", true: "rgba(176,38,255,0.55)" }}
        thumbColor={value && !locked ? C.purple : "#7D8795"}
        ios_backgroundColor="#222936"
      />
    </View>
  );
}

export function SmartNotificationsSection({
  isPro,
  calendarEvents,
  onUpgrade,
  refreshDailyPropBuffer,
}: Props) {
  const [masters, setMasters] = useState<NotificationMasterGroupPrefs | null>(null);

  useEffect(() => {
    void getNotificationMasterGroups()
      .then((loaded) => refreshDailyTradingBriefMasterState(loaded))
      .then(setMasters);
  }, []);

  const handleToggle = useCallback(
    async (groupId: NotificationMasterGroupId, enabled: boolean) => {
      if (MASTER_GROUP_I18N[groupId].proOnly && !isPro) {
        Alert.alert(t("notificationsProLockedTitle"), t("notificationsProLockedBody"), [
          { text: t("cancel"), style: "cancel" },
          { text: t("upgradeToPro"), onPress: onUpgrade },
        ]);
        return;
      }

      const result = await setMasterNotificationGroupEnabled({
        groupId,
        enabled,
        isPro,
        calendarEvents,
        refreshDailyPropBuffer,
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
      if (result.ok) setMasters(result.masters);
    },
    [calendarEvents, isPro, onUpgrade, refreshDailyPropBuffer],
  );

  if (!masters) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionSub}>{t("notificationsMasterSub")}</Text>
      {NOTIFICATION_MASTER_GROUP_ORDER.map((groupId, index) => (
        <React.Fragment key={groupId}>
          <MasterToggleRow
            groupId={groupId}
            enabled={masters[groupId]}
            isPro={isPro}
            onToggle={handleToggle}
          />
          {index < NOTIFICATION_MASTER_GROUP_ORDER.length - 1 ? (
            <View style={styles.divider} />
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 2,
  },
  sectionSub: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
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
    minWidth: 0,
    paddingRight: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 3,
  },
  title: {
    color: C.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
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
});
