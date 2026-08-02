/**
 * Locked Prop Pass preview for non-entitled users.
 * Tab stays visible; content is gated — paywall only via CTA.
 */

import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../ydl/components/YdlButton";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";

const PREVIEW_CAPABILITY_KEYS = [
  "propPass.locked.cap.target",
  "propPass.locked.cap.daily",
  "propPass.locked.cap.drawdown",
  "propPass.locked.cap.modes",
  "propPass.locked.cap.streak",
  "propPass.locked.cap.intervention",
] as const;

type Props = {
  onViewPlans: () => void;
  onRestore: () => void;
  restoreBusy?: boolean;
};

export function PropPassLockedPreview({ onViewPlans, onRestore, restoreBusy }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background.primary }}
      contentContainerStyle={styles.body}
      testID="prop-pass-locked-preview"
    >
      <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]}>
        <YdlText role="caption" color="text.secondary">
          {t("propPass.tab")}
        </YdlText>
        <YdlText role="title" testID="prop-pass-locked-title">
          {t("propPass.lockedTitle")}
        </YdlText>
        <YdlText role="body" color="text.secondary">
          {t("propPass.lockedBody")}
        </YdlText>
        <YdlText role="body" color="text.secondary">
          {t("propPass.locked.challengeLiveHint")}
        </YdlText>
        <YdlText role="caption" color="text.secondary" accessibilityLabel={t("propPass.lockedIndicator")}>
          {t("propPass.lockedIndicator")}
        </YdlText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface.card }]} testID="prop-pass-locked-capabilities">
        <YdlText role="label">{t("propPass.lockedPreviewLabel")}</YdlText>
        {PREVIEW_CAPABILITY_KEYS.map((key) => (
          <View key={key} style={styles.capabilityRow}>
            <View style={[styles.dot, { backgroundColor: theme.colors.action.primary }]} />
            <YdlText role="body">{t(key)}</YdlText>
          </View>
        ))}
      </View>

      <YdlButton
        label={t("propPass.unlockCta")}
        onPress={onViewPlans}
        fullWidth
        testID="prop-pass-unlock"
      />
      <YdlButton
        label={t("viewPlans")}
        variant="secondary"
        onPress={onViewPlans}
        fullWidth
        testID="prop-pass-view-plans"
      />
      <YdlButton
        label={t("restorePurchases")}
        variant="secondary"
        onPress={onRestore}
        disabled={!!restoreBusy}
        fullWidth
        testID="prop-pass-restore"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { borderRadius: 14, padding: 16, gap: 10 },
  capabilityRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
