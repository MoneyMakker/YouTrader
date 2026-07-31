import React, { useEffect } from "react";
import { Dimensions } from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
  useSafeAreaInsets,
  type Metrics,
} from "react-native-safe-area-context";
import { logStartupPerf } from "../lib/startupPerf";

/**
 * Release/TestFlight can leave native safe-area insets unset. Without initial
 * metrics, SafeAreaProvider renders null children → permanent black screen.
 *
 * Seed with real initialWindowMetrics when available; otherwise use a zero-inset
 * frame fallback so children commit immediately. Native onInsetsChange still
 * overrides after mount — never invent fake inset values from screen size.
 */
const FALLBACK_METRICS: Metrics = {
  frame: {
    x: 0,
    y: 0,
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

export const youTraderInitialSafeAreaMetrics: Metrics =
  initialWindowMetrics ?? FALLBACK_METRICS;

type Props = {
  children: React.ReactNode;
};

function SafeAreaMetricsProbe() {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    logStartupPerf(
      `safe_area_insets top=${insets.top} right=${insets.right} bottom=${insets.bottom} left=${insets.left}`,
    );
  }, [insets.bottom, insets.left, insets.right, insets.top]);
  return null;
}

export function YouTraderSafeAreaProvider({ children }: Props) {
  return (
    <SafeAreaProvider
      initialMetrics={
        initialWindowMetrics ?? {
          frame: {
            x: 0,
            y: 0,
            width: Dimensions.get("window").width,
            height: Dimensions.get("window").height,
          },
          insets: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          },
        }
      }
      style={{ flex: 1 }}
    >
      <SafeAreaMetricsProbe />
      {children}
    </SafeAreaProvider>
  );
}
