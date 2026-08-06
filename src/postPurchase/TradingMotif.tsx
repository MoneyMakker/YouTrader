/**
 * TradingMotif — restrained candlestick animation behind the brand mark.
 * Five softly breathing bars in a slow staggered rise. Reduce Motion → static.
 */
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

const BAR_COLORS = [
  "rgba(163,255,18,0.32)",
  "rgba(163,255,18,0.18)",
  "rgba(163,255,18,0.44)",
  "rgba(163,255,18,0.22)",
  "rgba(163,255,18,0.36)",
];

const BAR_BASE_HEIGHTS = [10, 16, 24, 18, 28];
const BAR_WICK_HEIGHTS = [6, 8, 10, 7, 9];

type Props = {
  reduceMotion: boolean;
};

export function TradingMotif({ reduceMotion }: Props) {
  const anims = useRef(BAR_BASE_HEIGHTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduceMotion) {
      anims.forEach((v) => v.setValue(0.5));
      return;
    }
    const loops = anims.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 420),
          Animated.timing(v, { toValue: 1, duration: 2400, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 2400, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion]);

  return (
    <View style={styles.row} pointerEvents="none" accessibilityElementsHidden>
      {BAR_BASE_HEIGHTS.map((base, i) => {
        const grow = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
        const fade = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
        return (
          <Animated.View key={i} style={[styles.barWrap, { opacity: fade }]}>
            <View style={[styles.wick, { height: BAR_WICK_HEIGHTS[i] }]} />
            <Animated.View
              style={[
                styles.bar,
                { height: base, backgroundColor: BAR_COLORS[i] },
                { transform: [{ translateY: grow }] },
              ]}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 9,
    height: 40,
  },
  barWrap: { alignItems: "center" },
  wick: { width: 1.5, backgroundColor: "rgba(163,255,18,0.28)", borderRadius: 1 },
  bar: { width: 7, borderRadius: 2 },
});
