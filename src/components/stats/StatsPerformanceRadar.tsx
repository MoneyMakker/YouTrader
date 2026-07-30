import React, { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Stop } from "react-native-svg";
import { t } from "../../i18n";
import { MetricPillRow, TerminalGlassCard } from "../../app/ai/sharedUi";
import { C } from "../../app/theme";
import { styles } from "../../app/styles";
import { YdlAnimatedPressable } from "../../ydl/motion";
import { MetricExplanationSheet } from "./MetricExplanationSheet";

/** Axis shape for the radar — kept local so Phase 3 does not require committing radarAxes. */
export type StatsPerformanceRadarAxis = {
  key: string;
  label: string;
  value: string;
  score: number;
  target: string;
  explanation: string;
};

const RADAR_PRO_ONLY_KEYS = new Set(["consistency", "recovery", "profitFactor"]);

export function StatsPerformanceRadar({
  axes,
  isPremium,
  onUpgrade,
}: {
  axes: StatsPerformanceRadarAxis[];
  isPremium: boolean;
  onUpgrade: () => void;
}) {
  const [selected, setSelected] = useState<{ label: string; value: string; target: string; explanation: string } | null>(null);
  const size = 286;
  const center = size / 2;
  const maxR = 102;
  const lockedBaselineR = maxR * 0.22;
  const isAxisLocked = (key: string) => !isPremium && RADAR_PRO_ONLY_KEYS.has(key);
  const points = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axes.length;
    const locked = isAxisLocked(axis.key);
    const r = locked ? lockedBaselineR : (Math.max(18, Math.min(100, axis.score)) / 100) * maxR;
    return {
      ...axis,
      locked,
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
      lx: center + Math.cos(angle) * (maxR + 34),
      ly: center + Math.sin(angle) * (maxR + 34),
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
  const visibleAxes = isPremium ? axes : axes.filter((axis) => !isAxisLocked(axis.key));
  const profileScore = Math.round(
    visibleAxes.reduce((sum, axis) => sum + Math.max(0, Math.min(100, axis.score)), 0) / Math.max(1, visibleAxes.length),
  );

  return (
    <TerminalGlassCard>
      <Text style={styles.terminalSectionTitle} accessibilityRole="header">{t("tradingRadar")}</Text>
      <View style={styles.premiumRadarWrap}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.purple} stopOpacity="0.28" />
              <Stop offset="1" stopColor="#D36BFF" stopOpacity="0.12" />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75, 1].map((ring) => (
            <Circle key={ring} cx={center} cy={center} r={maxR * ring} stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill="none" />
          ))}
          {points.map((point) => (
            <Line key={`axis-${point.label}`} x1={center} y1={center} x2={point.lx} y2={point.ly} stroke="rgba(255,255,255,0.055)" strokeWidth={1} />
          ))}
          <Polygon points={polygon} fill="url(#radarFill)" stroke={C.purple} strokeWidth={3} />
          {points.map((point) => (
            <Circle key={`dot-${point.label}`} cx={point.x} cy={point.y} r={5.5} fill={C.purple} stroke="rgba(0,0,0,0.72)" strokeWidth={2} />
          ))}
        </Svg>
        <View style={styles.premiumRadarCenter}>
          <Text style={styles.premiumRadarScore}>{profileScore}</Text>
          <Text style={styles.premiumRadarLabel}>{isPremium ? "PROFILE" : "PREVIEW"}</Text>
        </View>
        {points.map((point) => (
          <YdlAnimatedPressable
            key={`label-${point.label}`}
            accessibilityRole="button"
            accessibilityLabel={
              point.locked
                ? `${point.label}. Pro. Opens upgrade`
                : `${point.label}. ${point.value}. Opens metric explanation`
            }
            accessibilityHint={point.locked ? undefined : point.explanation}
            haptic={point.locked ? false : "selection"}
            scaleOnPress
            opacityOnPress
            onPress={() => {
              if (point.locked) {
                onUpgrade();
                return;
              }
              setSelected({ label: point.label, value: point.value, target: point.target, explanation: point.explanation });
            }}
            style={[styles.premiumRadarAxisLabel, point.locked && styles.premiumRadarAxisLabelLocked, { left: Math.max(0, Math.min(size - 86, point.lx - 43)), top: Math.max(0, Math.min(size - 38, point.ly - 18)) }]}
          >
            <Text style={styles.premiumRadarAxisText} accessible={false}>
              {point.label}
            </Text>
            <Text
              style={[styles.premiumRadarAxisValue, point.locked && styles.premiumRadarAxisValueLocked]}
              accessible={false}
            >
              {point.locked ? "PRO" : point.value}
            </Text>
          </YdlAnimatedPressable>
        ))}
      </View>
      <MetricPillRow
        items={axes.map((axis) => ({
          label: axis.label,
          value: isAxisLocked(axis.key) ? "PRO" : axis.value,
          tone: isAxisLocked(axis.key) ? "grey" : axis.score >= 65 ? "purple" : "grey",
        }))}
      />
      <MetricExplanationSheet
        visible={!!selected}
        content={selected}
        onClose={() => setSelected(null)}
      />
    </TerminalGlassCard>
  );
}

