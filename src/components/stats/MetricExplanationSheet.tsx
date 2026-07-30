import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import {
  YdlBottomSheetModal,
  YdlModalSheetScrollView,
  YDL_SHEET_COLORS,
  type YdlSheetAppearance,
} from "../../ydl/sheets";
import { YdlIconButton, YdlSectionHeader } from "../../ydl/components";
import { YdlSymbol } from "../../ydl/symbols";
import { announceYdlAccessibility, useYdlReduceMotion } from "../../ydl/accessibility";
import { t } from "../../i18n";

export type MetricExplanationContent = {
  label: string;
  value: string;
  target: string;
  explanation: string;
};

export type MetricExplanationSheetProps = {
  visible: boolean;
  content: MetricExplanationContent | null;
  onClose: () => void;
  /** Override appearance; defaults to system scheme (dark when unspecified). */
  appearance?: YdlSheetAppearance;
};

/**
 * Phase 3 production reference: read-only radar metric explanation.
 * Removable without affecting trade/auth/paywall/AI logic.
 * Imports only YDL adapters — no third-party UI packages.
 */
export function MetricExplanationSheet({
  visible,
  content,
  onClose,
  appearance: appearanceProp,
}: MetricExplanationSheetProps) {
  const scheme = useColorScheme();
  const appearance: YdlSheetAppearance =
    appearanceProp ?? (scheme === "light" ? "light" : "dark");
  const colors = YDL_SHEET_COLORS[appearance];
  const reduceMotion = useYdlReduceMotion();

  const a11yLabel = useMemo(() => {
    if (!content) return t("metricDefault");
    return `${content.label}. ${content.value}`;
  }, [content]);

  useEffect(() => {
    if (visible && content) {
      announceYdlAccessibility(`${content.label}: ${content.value}`);
    }
  }, [visible, content]);

  return (
    <YdlBottomSheetModal
      open={visible}
      sizing={{ mode: "dynamic", maxDynamicContentSize: 480 }}
      enablePanDownToClose
      backdrop="pressable"
      appearance={appearance}
      accessibilityLabel={a11yLabel}
      hapticOnSettle={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <YdlModalSheetScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <YdlSymbol name="info" size="md" tintColor={colors.title} decorative />
              <YdlSectionHeader title={content?.label || t("metricDefault")} />
            </View>
          </View>
          <YdlIconButton
            symbol="close"
            accessibilityLabel={t("close")}
            onPress={onClose}
            tintColor={colors.title}
            haptic="selection"
          />
        </View>

        {content ? (
          <>
            <Text
              style={[styles.value, { color: colors.title }]}
              allowFontScaling
              accessibilityRole="text"
            >
              {content.value}
            </Text>
            <Text style={[styles.body, { color: colors.body }]} allowFontScaling>
              {content.explanation}
            </Text>
            <Text style={[styles.body, { color: colors.body }]} allowFontScaling>
              {t("targetPrefix")}: {content.target}
            </Text>
            {reduceMotion ? null : (
              <View
                style={styles.footerIcon}
                accessible={false}
                importantForAccessibility="no"
              >
                <YdlSymbol name="chart" size="sm" tintColor={colors.body} decorative />
              </View>
            )}
          </>
        ) : null}
      </YdlModalSheetScrollView>
    </YdlBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  value: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  footerIcon: {
    marginTop: 10,
    alignSelf: "flex-start",
    opacity: 0.7,
  },
});
