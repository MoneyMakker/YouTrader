import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import type { PropPassViewModel } from "../types";

type Props = {
  model: PropPassViewModel;
  onViewHistory: () => void;
};

export function PropPassRecentActivity({ model, onViewHistory }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const rows = model.historicalAttempts.slice(0, 3);

  return (
    <View
      style={[styles.wrap, { backgroundColor: theme.colors.surface.card }]}
      testID="prop-pass-recent-activity"
    >
      <YdlText role="label">{t("propPass.activity.title")}</YdlText>
      {rows.length === 0 ? (
        <YdlText role="caption" color="text.secondary">
          {t("propPass.activity.empty")}
        </YdlText>
      ) : (
        rows.map((h) => (
          <View key={h.id} style={styles.row}>
            <YdlText role="bodyEmphasized">{h.startedAt.slice(0, 10)}</YdlText>
            <YdlText role="caption" color="text.secondary">
              {t("propPass.activity.row", { status: h.status })}
            </YdlText>
          </View>
        ))
      )}
      <YdlButton
        label={t("propPass.activity.viewHistory")}
        variant="secondary"
        onPress={onViewHistory}
        testID="prop-pass-view-history"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  row: { gap: 2, paddingVertical: 4 },
});
