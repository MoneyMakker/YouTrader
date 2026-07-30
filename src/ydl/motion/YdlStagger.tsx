import React, { Children, useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useYdlReduceMotion } from "../accessibility";
import { ydlMotionAssertStaggerCount } from "./performance";
import { resolveYdlStaggerMs } from "./reduceMotion";
import { ydlMotionDurationToken } from "./tokens";

export type YdlStaggerPreset = "tight" | "normal" | "relaxed";

export type YdlStaggerProps = {
  children: React.ReactNode;
  /** Semantic stagger density — keep groups small (≤5). */
  preset?: YdlStaggerPreset;
  /** Tiny vertical offset in px (default 6). Large travel is forbidden. */
  offsetY?: number;
  /** Replay key — change to intentionally re-run entrance (e.g. metric id). */
  entranceKey?: string | number;
  style?: StyleProp<ViewStyle>;
};

const PRESET_MS: Record<YdlStaggerPreset, number> = {
  tight: 24,
  normal: 48,
  relaxed: 72,
};

export const ydlStaggerPresets = PRESET_MS;

function StaggerChild({
  index,
  stepMs,
  offsetY,
  reduceMotion,
  entranceKey,
  child,
}: {
  index: number;
  stepMs: number;
  offsetY: number;
  reduceMotion: boolean;
  entranceKey: string | number;
  child: React.ReactNode;
}) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      index * stepMs,
      withTiming(1, {
        duration: ydlMotionDurationToken.standard,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    );
  }, [entranceKey, index, progress, reduceMotion, stepMs]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * offsetY }],
  }));

  return <Animated.View style={style}>{child}</Animated.View>;
}

/**
 * Small-group entrance stagger. Not for long lists.
 * Reduce Motion → immediate render, no travel.
 */
export function YdlStagger({
  children,
  preset = "normal",
  offsetY = 6,
  entranceKey = "default",
  style,
}: YdlStaggerProps) {
  const reduceMotion = useYdlReduceMotion();
  const items = Children.toArray(children);
  ydlMotionAssertStaggerCount(items.length);
  const stepMs = resolveYdlStaggerMs(PRESET_MS[preset], reduceMotion);
  const travel = reduceMotion ? 0 : Math.min(8, Math.max(0, offsetY));

  return (
    <View style={[styles.col, style]}>
      {items.map((child, index) => (
        <StaggerChild
          key={`${entranceKey}-${index}`}
          index={index}
          stepMs={stepMs}
          offsetY={travel}
          reduceMotion={reduceMotion}
          entranceKey={entranceKey}
          child={child}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    gap: 10,
  },
});
