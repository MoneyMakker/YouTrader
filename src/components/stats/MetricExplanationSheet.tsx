import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import {
  YdlBottomSheetModal,
  YdlModalSheetScrollView,
  YDL_SHEET_COLORS,
  type YdlSheetAppearance,
} from "../../ydl/sheets";
import {
  YdlBadge,
  YdlCard,
  YdlIconButton,
  YdlSectionHeader,
  YdlText,
} from "../../ydl/components";
import { YdlSymbol } from "../../ydl/symbols";
import { announceYdlAccessibility, useYdlReduceMotion } from "../../ydl/accessibility";
import {
  YdlAnimatedNumber,
  YdlFade,
  YdlStagger,
  parseYdlMetricDisplay,
} from "../../ydl/motion";
import { resolveYdlTheme, ydlSpace } from "../../ydl/tokens";
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
 * Phase 3–6 production reference: read-only radar metric explanation.
 * Phase 6 hardens a11y grouping and token presentation; copy/values unchanged.
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
  const sheetColors = YDL_SHEET_COLORS[appearance];
  const theme = resolveYdlTheme(appearance);
  const reduceMotion = useYdlReduceMotion();

  const a11yLabel = useMemo(() => {
    if (!content) return t("metricDefault");
    return `${content.label}. ${content.value}`;
  }, [content]);

  const parsed = useMemo(
    () => (content ? parseYdlMetricDisplay(content.value) : null),
    [content],
  );

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
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: ydlSpace[16],
            paddingBottom: ydlSpace[24],
            gap: ydlSpace[12],
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.headerRow, { gap: ydlSpace[8] }]}>
          <View style={styles.headerText} accessibilityRole="header">
            <View style={[styles.titleRow, { gap: ydlSpace[8] }]}>
              <YdlSymbol name="info" size="md" tintColor={sheetColors.title} decorative />
              <YdlSectionHeader
                title={content?.label || t("metricDefault")}
                tintColor={sheetColors.title}
                appearance={appearance}
              />
            </View>
          </View>
          <YdlIconButton
            symbol="close"
            accessibilityLabel={t("close")}
            onPress={onClose}
            tintColor={sheetColors.title}
            haptic="selection"
            testID="metric-explanation-close"
          />
        </View>

        {content ? (
          <YdlFade visible={visible} enter={!reduceMotion} key={content.label}>
            <YdlStagger entranceKey={content.label} preset="tight" offsetY={5}>
              <YdlCard
                variant="outlined"
                appearance={appearance}
                accessibilityLabel={`${content.label} details`}
                testID="metric-explanation-card"
              >
                {parsed ? (
                  <YdlAnimatedNumber
                    value={parsed.value}
                    kind={parsed.kind}
                    decimals={parsed.decimals}
                    style={[
                      theme.typography.numericLarge,
                      { color: theme.colors.text.primary, fontWeight: "900" },
                    ]}
                    accessibilityLabel={content.value}
                    testID="metric-explanation-value"
                  />
                ) : (
                  <YdlText
                    role="numericLarge"
                    appearance={appearance}
                    accessibilityLabel={content.value}
                    testID="metric-explanation-value"
                    style={{ fontWeight: "900" }}
                  >
                    {content.value}
                  </YdlText>
                )}
                <YdlText
                  role="bodyEmphasized"
                  color="text.secondary"
                  appearance={appearance}
                  testID="metric-explanation-body"
                >
                  {content.explanation}
                </YdlText>
                <YdlBadge
                  tone="info"
                  label={`${t("targetPrefix")}: ${content.target}`}
                  symbol="chart"
                  appearance={appearance}
                  testID="metric-explanation-target"
                />
              </YdlCard>
              {reduceMotion ? null : (
                <View
                  style={[styles.footerIcon, { marginTop: ydlSpace[8] }]}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  <YdlSymbol name="chart" size="sm" tintColor={sheetColors.body} decorative />
                </View>
              )}
            </YdlStagger>
          </YdlFade>
        ) : null}
      </YdlModalSheetScrollView>
    </YdlBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {},
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerIcon: {
    alignSelf: "flex-start",
    opacity: 0.7,
  },
});
