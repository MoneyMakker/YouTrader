import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useYdlReduceMotion } from "../ydl/accessibility/useReduceMotion";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import type { BufferViewModel } from "./types";

type Props = {
  buffers: {
    dailyLoss?: BufferViewModel;
    trailingDrawdown?: BufferViewModel;
    totalLoss?: BufferViewModel;
  };
};

/**
 * Buffer Health — values from Prop OS snapshots only.
 * Semantic status + text; color is secondary.
 */
export function BufferHealthSection({ buffers }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme();
  const reduceMotion = useYdlReduceMotion();
  const items = [buffers.dailyLoss, buffers.trailingDrawdown, buffers.totalLoss].filter(
    Boolean,
  ) as BufferViewModel[];

  return (
    <View
      style={styles.wrap}
      accessibilityRole="summary"
      accessibilityLabel={t("propPass.buffer.sectionA11y")}
    >
      <YdlText role="title">{t("propPass.buffer.sectionTitle")}</YdlText>
      {items.map((b) => {
        const unsupported = b.status === "unsupported" || b.ratio == null;
        const fill = unsupported ? 0 : Math.round((b.ratio ?? 0) * 100);
        const statusLabel = t(`propPass.buffer.status.${b.status}`);
        const a11y =
          b.status === "hard"
            ? t(b.accessibilityKey, { label: t(b.labelKey), status: statusLabel })
            : unsupported
              ? t("propPass.a11y.bufferUnsupported", { label: t(b.labelKey) })
              : t(b.accessibilityKey, {
                  label: t(b.labelKey),
                  status: statusLabel,
                  remaining: b.remainingMinor ?? "—",
                  limit: b.limitMinor ?? "—",
                });
        const fillColor =
          b.status === "hard"
            ? theme.colors.status.negative
            : b.status === "warn"
              ? theme.colors.status.warning
              : theme.colors.status.positive;
        return (
          <View
            key={b.id}
            style={[styles.row, { borderColor: theme.colors.border.subtle }]}
            accessibilityLabel={a11y}
            accessibilityRole="text"
          >
            <View style={styles.rowHeader}>
              <YdlText role="body">{t(b.labelKey)}</YdlText>
              <YdlText role="caption" color="text.secondary">
                {statusLabel}
              </YdlText>
            </View>
            {unsupported ? (
              <YdlText role="caption" color="text.secondary">
                {t("propPass.buffer.unavailable")}
              </YdlText>
            ) : (
              <View
                style={[styles.track, { backgroundColor: theme.colors.surface.interactive }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${reduceMotion ? fill : fill}%` as `${number}%`,
                      backgroundColor: fillColor,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: {
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});
