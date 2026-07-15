import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { C } from "../../../theme/colors";

export type CountUpTextProps = Omit<TextProps, "children"> & {
  value: number;
  from?: number;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  formatValue?: (value: number) => string;
  textStyle?: StyleProp<TextStyle>;
};

export function CountUpText({
  value,
  from = 0,
  durationMs = 900,
  decimals = 0,
  prefix = "",
  suffix = "",
  formatValue,
  textStyle,
  ...rest
}: CountUpTextProps) {
  const animatedValue = useRef(new Animated.Value(from)).current;
  const [displayValue, setDisplayValue] = useState(from);

  useEffect(() => {
    const listenerId = animatedValue.addListener(({ value: nextValue }) => {
      setDisplayValue(nextValue);
    });

    Animated.timing(animatedValue, {
      toValue: value,
      duration: durationMs,
      useNativeDriver: false,
    }).start();

    return () => {
      animatedValue.removeListener(listenerId);
    };
  }, [animatedValue, durationMs, value]);

  const formatted = formatValue ? formatValue(displayValue) : `${prefix}${displayValue.toFixed(decimals)}${suffix}`;

  return (
    <Text {...rest} style={[{ color: C.text, fontVariant: ["tabular-nums"] }, textStyle]}>
      {formatted}
    </Text>
  );
}
