import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useYdlReduceMotion } from "../ydl/accessibility/useReduceMotion";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import {
  bufferRemainingPercent,
  bufferUsedMinor,
  bufferUsedPercent,
  mapBufferDisplayStatus,
  moneyOrDash,
  type BufferDisplayStatus,
} from "./presentation";
import type { BufferViewModel } from "./types";

type Props = {
  buffers: {
    dailyLoss?: BufferViewModel;
    trailingDrawdown?: BufferViewModel;
    totalLoss?: BufferViewModel;
  };
  currency?: string;
};

function statusTone(
  status: BufferDisplayStatus,
  theme: ReturnType<typeof useYdlTheme>,
): string {
  switch (status) {
    case "healthy":
      return theme.colors.status.positive;
    case "caution":
      return theme.colors.status.warning;
    case "danger":
      return theme.colors.status.negative;
    default:
      return theme.colors.text.tertiary;
  }
}

/**
 * Buffer Health — server snapshot values only; client formats money for display.
 */
export function BufferHealthSection({ buffers, currency = "USD" }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const reduceMotion = useYdlReduceMotion();
  const items: Array<{ key: string; buffer?: BufferViewModel; explainKey: string }> = [
    {
      key: "daily",
      buffer: buffers.dailyLoss,
      explainKey: "propPass.buffer.explain.dailyLoss",
    },
    {
      key: "trailing",
      buffer: buffers.trailingDrawdown,
      explainKey: "propPass.buffer.explain.trailingDrawdown",
    },
    {
      key: "max",
      buffer: buffers.totalLoss,
      explainKey: "propPass.buffer.explain.totalLoss",
    },
  ];

  return (
    <View
      style={styles.wrap}
      accessibilityRole="summary"
      accessibilityLabel={t("propPass.buffer.sectionA11y")}
      testID="prop-pass-buffer-health"
    >
      <YdlText role="label">{t("propPass.buffer.sectionTitle")}</YdlText>
      {items.map(({ key, buffer, explainKey }) => {
        const displayStatus = mapBufferDisplayStatus(buffer);
        const statusLabel = t(`propPass.buffer.displayStatus.${displayStatus}`);
        const used = moneyOrDash(bufferUsedMinor(buffer), currency);
        const available = moneyOrDash(buffer?.remainingMinor ?? null, currency);
        const usedPct = bufferUsedPercent(buffer);
        const remainPct = bufferRemainingPercent(buffer);
        const fill =
          displayStatus === "unavailable"
            ? 0
            : key === "daily"
              ? (usedPct ?? 0)
              : Math.max(0, 100 - (remainPct ?? 0));
        const tone = statusTone(displayStatus, theme);
        const a11y =
          displayStatus === "unavailable"
            ? t("propPass.a11y.bufferUnsupported", {
                label: buffer ? t(buffer.labelKey) : key,
              })
            : t("propPass.a11y.bufferStatusMoney", {
                label: buffer ? t(buffer.labelKey) : key,
                status: statusLabel,
                used: used.a11y,
                available: available.a11y,
              });

        return (
          <View
            key={key}
            style={[styles.card, { backgroundColor: theme.colors.surface.card }]}
            accessibilityLabel={a11y}
            accessibilityRole="text"
          >
            <View style={styles.rowHeader}>
              <YdlText role="bodyEmphasized">
                {buffer ? t(buffer.labelKey) : key}
              </YdlText>
              <YdlText role="caption" style={{ color: tone }}>
                {statusLabel}
              </YdlText>
            </View>
            {displayStatus === "unavailable" ? (
              <YdlText role="caption" color="text.secondary">
                {t("propPass.buffer.unavailable")}
              </YdlText>
            ) : (
              <>
                <Metric
                  label={
                    key === "daily"
                      ? t("propPass.buffer.usedToday")
                      : t("propPass.buffer.used")
                  }
                  value={used.display}
                />
                <Metric label={t("propPass.buffer.available")} value={available.display} />
                {usedPct != null ? (
                  <YdlText role="caption" color="text.secondary">
                    {t("propPass.buffer.percentUsed", { percent: usedPct })}
                  </YdlText>
                ) : null}
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
                        backgroundColor: tone,
                      },
                    ]}
                  />
                </View>
                <YdlText role="body" color="text.secondary">
                  {t(explainKey, { available: available.display })}
                </YdlText>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <YdlText role="caption" color="text.secondary">
        {label}
      </YdlText>
      <YdlText role="bodyEmphasized">{value}</YdlText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: {
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metric: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 4,
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});
