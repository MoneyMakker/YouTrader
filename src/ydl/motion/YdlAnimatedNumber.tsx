import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from "react-native";
import {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useYdlReduceMotion } from "../accessibility";
import {
  formatYdlNumber,
  interpolateYdlNumber,
  type YdlNumberFormatOptions,
  type YdlNumberKind,
} from "./number";
import { ydlMotionDurationToken } from "./tokens";

export type YdlAnimatedNumberProps = {
  value: number;
  kind: YdlNumberKind;
  style?: StyleProp<TextStyle>;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
  currency?: string;
  signed?: boolean;
  /** Optional override for screen-reader final string. */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Animates presentation of a number with timing (no spring overshoot).
 * Screen readers receive only the final formatted value.
 * Reduce Motion → immediate update.
 */
export function YdlAnimatedNumber({
  value,
  kind,
  style,
  decimals,
  prefix,
  suffix,
  locale,
  currency,
  signed,
  accessibilityLabel: a11yOverride,
  testID,
}: YdlAnimatedNumberProps) {
  const reduceMotion = useYdlReduceMotion();
  const formatOpts: YdlNumberFormatOptions = useMemo(
    () => ({ decimals, prefix, suffix, locale, currency, signed }),
    [currency, decimals, locale, prefix, signed, suffix],
  );

  const format = useCallback(
    (n: number) => formatYdlNumber(kind, n, formatOpts),
    [formatOpts, kind],
  );
  const finalLabel = a11yOverride ?? format(value);

  const [visual, setVisual] = useState(() => format(value));
  const fromSv = useSharedValue(value);
  const toSv = useSharedValue(value);
  const progress = useSharedValue(1);
  const latestRef = useRef(value);
  const appActive = useRef(AppState.currentState === "active");
  const formatRef = useRef(format);
  formatRef.current = format;

  const publishVisual = useCallback((n: number) => {
    setVisual(formatRef.current(n));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appActive.current = next === "active";
      if (next !== "active") {
        cancelAnimation(progress);
        fromSv.value = latestRef.current;
        toSv.value = latestRef.current;
        progress.value = 1;
        setVisual(formatRef.current(latestRef.current));
      }
    });
    return () => sub.remove();
  }, [fromSv, progress, toSv]);

  useEffect(() => {
    latestRef.current = value;
    if (reduceMotion || !appActive.current) {
      cancelAnimation(progress);
      fromSv.value = value;
      toSv.value = value;
      progress.value = 1;
      setVisual(format(value));
      return;
    }

    const start = fromSv.value + (toSv.value - fromSv.value) * progress.value;
    cancelAnimation(progress);
    fromSv.value = start;
    toSv.value = value;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: ydlMotionDurationToken.emphasized,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [value, reduceMotion, format, fromSv, toSv, progress]);

  useAnimatedReaction(
    () => Math.round(progress.value * 16),
    (step, prev) => {
      if (step === prev) return;
      const t = step / 16;
      const n = interpolateYdlNumber(fromSv.value, toSv.value, t);
      runOnJS(publishVisual)(n);
    },
    [publishVisual],
  );

  return (
    <Text
      testID={testID}
      style={[styles.tabular, style]}
      allowFontScaling
      accessibilityRole="text"
      accessibilityLabel={finalLabel}
      accessible
    >
      {visual}
    </Text>
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ["tabular-nums"],
  },
});
