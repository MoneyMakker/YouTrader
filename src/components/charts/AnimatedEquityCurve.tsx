import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { PremiumGlassCard } from "../ui/PremiumGlassCard";
import { YouTraderLottie } from "../ui/YouTraderLottie";
import { C } from "../../theme/colors";

type TradeLike = {
  id?: string;
  date: string;
  pnl: number;
};

type EquityPoint = {
  date: string;
  pnl: number;
  cumulative: number;
  tradeCount: number;
  x: number;
  y: number;
  isHigh: boolean;
};

type Props = {
  trades: TradeLike[];
  period?: "day" | "week" | "month" | "year";
  isPro?: boolean;
  onPointPress?: (point: EquityPoint) => void;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(0)}`;
}

function buildDailyEquity(trades: TradeLike[]) {
  const byDate = new Map<string, { pnl: number; tradeCount: number }>();
  trades.forEach((trade) => {
    const current = byDate.get(trade.date) || { pnl: 0, tradeCount: 0 };
    current.pnl += trade.pnl;
    current.tradeCount += 1;
    byDate.set(trade.date, current);
  });

  let cumulative = 0;
  let high = Number.NEGATIVE_INFINITY;
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => {
      cumulative += row.pnl;
      const isHigh = cumulative > high;
      high = Math.max(high, cumulative);
      return { date, pnl: row.pnl, cumulative, tradeCount: row.tradeCount, isHigh };
    });
}

function AnimatedEquityCurveBase({ trades, period = "month", isPro = false, onPointPress }: Props) {
  const { width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [selected, setSelected] = useState<EquityPoint | null>(null);

  const chartWidth = Math.max(280, Math.min(720, width - 58));
  const chartHeight = isPro ? 190 : 170;
  const pad = 18;

  const points = useMemo(() => {
    const rows = buildDailyEquity(trades).slice(period === "year" ? -120 : -54);
    if (!rows.length) return [];
    const values = rows.map((point) => point.cumulative);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = Math.max(1, max - min);
    const innerWidth = chartWidth - pad * 2;
    const innerHeight = chartHeight - pad * 2;
    return rows.map((point, index) => ({
      ...point,
      x: pad + (rows.length === 1 ? innerWidth / 2 : (index / (rows.length - 1)) * innerWidth),
      y: pad + innerHeight - ((point.cumulative - min) / range) * innerHeight,
    }));
  }, [chartHeight, chartWidth, period, trades]);

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 760,
      useNativeDriver: false,
    }).start();
  }, [points.length, progress]);

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const dashLength = Math.max(300, points.length * 42);
  const strokeDashoffset = progress.interpolate({ inputRange: [0, 1], outputRange: [dashLength, 0] });

  const minY = Math.min(...points.map((point) => point.y), chartHeight / 2);
  const maxY = Math.max(...points.map((point) => point.y), chartHeight / 2);
  const drawdownDepth = maxY - minY;
  const hasDrawdown = drawdownDepth > chartHeight * 0.32;

  if (!points.length) {
    return (
      <PremiumGlassCard glow="green" style={styles.emptyCard}>
        <YouTraderLottie slot="emptyState" />
        <Text style={styles.emptyTitle}>No equity curve yet</Text>
        <Text style={styles.emptyText}>Log your first trade to see a live equity curve.</Text>
      </PremiumGlassCard>
    );
  }

  return (
    <View style={styles.wrap}>
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="equityLine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={C.purple} stopOpacity="0.85" />
            <Stop offset="1" stopColor={C.green} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {[0.25, 0.5, 0.75].map((line) => (
          <Line
            key={line}
            x1={pad}
            x2={chartWidth - pad}
            y1={chartHeight * line}
            y2={chartHeight * line}
            stroke="rgba(255,255,255,0.065)"
            strokeWidth={1}
          />
        ))}
        {hasDrawdown ? (
          <Path
            d={path}
            stroke="rgba(255,59,95,0.18)"
            strokeWidth={11}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}
        <AnimatedPath
          d={path}
          stroke="url(#equityLine)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${dashLength} ${dashLength}`}
          strokeDashoffset={strokeDashoffset}
          fill="none"
        />
        {points.map((point, index) => {
          const pointOpacity = progress.interpolate({
            inputRange: [Math.max(0, index / points.length - 0.08), Math.min(1, index / points.length + 0.12)],
            outputRange: [0, 1],
            extrapolate: "clamp",
          });
          const color = point.pnl >= 0 ? C.green : C.red;
          return (
            <React.Fragment key={`${point.date}-${index}`}>
              {point.isHigh && point.cumulative > 0 ? (
                <AnimatedCircle cx={point.x} cy={point.y} r={11} fill={C.green} opacity={pointOpacity} />
              ) : null}
              <AnimatedCircle
                cx={point.x}
                cy={point.y}
                r={point.isHigh && point.cumulative > 0 ? 5.5 : 4.2}
                fill={color}
                stroke={C.bg}
                strokeWidth={1.5}
                opacity={pointOpacity}
                onPress={() => {
                  setSelected(point);
                  onPointPress?.(point);
                }}
              />
            </React.Fragment>
          );
        })}
      </Svg>
      {selected ? (
        <Pressable onPress={() => setSelected(null)} style={styles.tooltip}>
          <Text style={styles.tooltipDate}>{selected.date}</Text>
          <Text style={[styles.tooltipPnl, { color: selected.pnl >= 0 ? C.green : C.red }]}>
            Day {money(selected.pnl)}
          </Text>
          <Text style={styles.tooltipMeta}>
            Equity {money(selected.cumulative)} • {selected.tradeCount} trades
          </Text>
          {selected.isHigh && selected.cumulative > 0 ? (
            <Text style={styles.tooltipGlow}>Profit Explosion</Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

export const AnimatedEquityCurve = memo(AnimatedEquityCurveBase);

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    alignItems: "center",
  },
  emptyCard: {
    marginTop: 10,
    minHeight: 160,
    alignItems: "center",
  },
  emptyTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },
  emptyText: {
    color: C.sub,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    textAlign: "center",
  },
  tooltip: {
    position: "absolute",
    top: 12,
    left: 18,
    right: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(163,255,18,0.28)",
    backgroundColor: "rgba(2,5,8,0.88)",
    padding: 12,
  },
  tooltipDate: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "900",
  },
  tooltipPnl: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },
  tooltipMeta: {
    color: C.text,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  tooltipGlow: {
    color: C.green,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 6,
    textTransform: "uppercase",
  },
});
