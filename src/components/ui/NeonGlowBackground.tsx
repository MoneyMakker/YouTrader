import React, { memo, useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { C } from "../../theme/colors";

type Props = {
  style?: StyleProp<ViewStyle>;
  intensity?: "low" | "medium";
};

function NeonGlowBackgroundBase({ style, intensity = "low" }: Props) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 14000, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 14000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-16, 18] });
  const opacity = intensity === "medium" ? 0.22 : 0.14;

  return (
    <View pointerEvents="none" style={[styles.root, style]}>
      <Animated.View style={[styles.line, styles.lineGreen, { opacity, transform: [{ translateX }, { rotate: "-10deg" }] }]} />
      <Animated.View style={[styles.line, styles.linePurple, { opacity: opacity * 0.9, transform: [{ translateX }, { rotate: "8deg" }] }]} />
      <View style={styles.orbGreen} />
      <View style={styles.orbPurple} />
    </View>
  );
}

export const NeonGlowBackground = memo(NeonGlowBackgroundBase);

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  line: {
    position: "absolute",
    left: -60,
    right: -60,
    height: 1,
    borderRadius: 999,
  },
  lineGreen: {
    top: "22%",
    backgroundColor: C.green,
  },
  linePurple: {
    top: "64%",
    backgroundColor: C.purple,
  },
  orbGreen: {
    position: "absolute",
    right: -80,
    top: -70,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(163,255,18,0.055)",
  },
  orbPurple: {
    position: "absolute",
    left: -96,
    bottom: -110,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(176,38,255,0.060)",
  },
});
