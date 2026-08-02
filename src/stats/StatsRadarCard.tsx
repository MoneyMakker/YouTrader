/**
 * Visual Performance Radar — lime SVG, journal-derived scores only.
 * Insufficient data: empty grid + exact progress (no fabricated polygon).
 */

import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Polygon } from "react-native-svg";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import {
  buildPerformanceRadar,
  RADAR_MIN_TRADES,
  type PerformanceRadarModel,
} from "./performanceRadar";
import type { Trade } from "../app/types";

const SIZE = 280;
const CENTER = SIZE / 2;
const MAX_R = 96;
const LIME = "#A3FF12";
const GRID = "rgba(255,255,255,0.10)";
const AXIS = "rgba(255,255,255,0.06)";

type Props = {
  trades: Trade[];
  /** Optional precomputed model (avoids double calc when parent already has it). */
  model?: PerformanceRadarModel;
};

function axisPoint(index: number, total: number, score01: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  const r = score01 * MAX_R;
  return {
    x: CENTER + Math.cos(angle) * r,
    y: CENTER + Math.sin(angle) * r,
    lx: CENTER + Math.cos(angle) * (MAX_R + 28),
    ly: CENTER + Math.sin(angle) * (MAX_R + 28),
  };
}

export function StatsRadarCard({ trades, model: modelProp }: Props) {
  const theme = useYdlTheme("dark");
  const model = useMemo(() => modelProp ?? buildPerformanceRadar(trades), [modelProp, trades]);
  const axisCount = model.ready ? model.axes.length : 5;
  const needed = Math.max(0, RADAR_MIN_TRADES - model.tradeCount);

  const polygon = useMemo(() => {
    if (!model.ready || !model.axes.length) return null;
    return model.axes
      .map((axis, index) => {
        const score = Math.max(0, Math.min(100, Number(axis.score) || 0)) / 100;
        const p = axisPoint(index, model.axes.length, Math.max(0.12, score));
        return `${p.x},${p.y}`;
      })
      .join(" ");
  }, [model]);

  const a11y =
    model.ready && model.axes.length
      ? `Performance Radar. ${model.axes.map((a) => `${a.label} ${a.score}`).join(". ")}`
      : `Performance Radar. ${model.tradeCount} of ${RADAR_MIN_TRADES} trades. Log ${needed} more trades to unlock your complete performance profile.`;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.colors.surface.card }]}
      testID="stats-radar"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={a11y}
    >
      <YdlText role="label">Performance Radar</YdlText>
      {!model.ready ? (
        <>
          <YdlText role="body" color="text.secondary">
            {needed > 0
              ? `Log ${needed} more trade${needed === 1 ? "" : "s"} to unlock your complete performance profile.`
              : model.insufficientMessage}
          </YdlText>
          <YdlText role="caption" color="text.secondary" testID="stats-radar-progress">
            {`${model.tradeCount} of ${RADAR_MIN_TRADES} trades`}
          </YdlText>
        </>
      ) : null}

      <View style={styles.wrap}>
        <Svg width={SIZE} height={SIZE}>
          {[0.25, 0.5, 0.75, 1].map((ring) => (
            <Circle
              key={ring}
              cx={CENTER}
              cy={CENTER}
              r={MAX_R * ring}
              stroke={GRID}
              strokeWidth={1}
              fill="none"
            />
          ))}
          {Array.from({ length: axisCount }, (_, index) => {
            const tip = axisPoint(index, axisCount, 1);
            return (
              <Line
                key={`axis-${index}`}
                x1={CENTER}
                y1={CENTER}
                x2={tip.lx}
                y2={tip.ly}
                stroke={AXIS}
                strokeWidth={1}
              />
            );
          })}
          {polygon ? (
            <Polygon
              points={polygon}
              fill="rgba(163,255,18,0.16)"
              stroke={LIME}
              strokeWidth={2.5}
            />
          ) : (
            <Polygon
              points={Array.from({ length: axisCount }, (_, index) => {
                const p = axisPoint(index, axisCount, 0.22);
                return `${p.x},${p.y}`;
              }).join(" ")}
              fill="none"
              stroke="rgba(163,255,18,0.22)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}
          {model.ready
            ? model.axes.map((axis, index) => {
                const score = Math.max(0, Math.min(100, Number(axis.score) || 0)) / 100;
                const p = axisPoint(index, model.axes.length, Math.max(0.12, score));
                return (
                  <Circle
                    key={axis.key}
                    cx={p.x}
                    cy={p.y}
                    r={4.5}
                    fill={LIME}
                    stroke="rgba(0,0,0,0.55)"
                    strokeWidth={1.5}
                  />
                );
              })
            : null}
        </Svg>
        {model.ready
          ? model.axes.map((axis, index) => {
              const tip = axisPoint(index, model.axes.length, 1);
              return (
                <View
                  key={`label-${axis.key}`}
                  style={[
                    styles.axisLabel,
                    {
                      left: Math.max(0, Math.min(SIZE - 88, tip.lx - 44)),
                      top: Math.max(0, Math.min(SIZE - 36, tip.ly - 16)),
                    },
                  ]}
                  pointerEvents="none"
                >
                  <YdlText role="caption" color="text.secondary" numberOfLines={2} style={{ textAlign: "center" }}>
                    {axis.label}
                  </YdlText>
                  <YdlText role="caption" style={{ color: LIME }} numberOfLines={1}>
                    {axis.score == null ? "—" : String(axis.score)}
                  </YdlText>
                </View>
              );
            })
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, gap: 10 },
  wrap: { alignSelf: "center", width: SIZE, height: SIZE },
  axisLabel: {
    position: "absolute",
    width: 88,
    alignItems: "center",
  },
});
