import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { EXPORT_CARD_WIDTH, EXPORT_COLORS } from "../exportDesign";

export function NeonFrame({ children, style, accentColor = EXPORT_COLORS.gold }: { children: React.ReactNode; style?: ViewStyle; accentColor?: string }) {
  const crestWidth = 220;
  const crestLeft = (EXPORT_CARD_WIDTH - 72 * 2 - crestWidth) / 2 + 72;
  return (
    <View style={[styles.shell, style]}>
      <View style={[styles.frameOuter, { borderColor: `${accentColor}B8` }]} />
      <View style={[styles.frameInner, { borderColor: "rgba(156,255,0,0.38)" }]} />
      <Svg width={EXPORT_CARD_WIDTH - 144} height={72} style={styles.crestSvg} pointerEvents="none">
        <Path
          d={`M${crestLeft} 0 L${crestLeft + crestWidth} 0 L${crestLeft + crestWidth - 28} 52 L${crestLeft + crestWidth / 2} 72 L${crestLeft + 28} 52 Z`}
          fill="rgba(8,6,15,0.92)"
          stroke={accentColor}
          strokeWidth={2.5}
        />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "100%",
    flex: 1,
    borderRadius: 58,
    borderWidth: 3,
    borderColor: "rgba(244,201,93,0.72)",
    backgroundColor: "rgba(6,8,13,0.94)",
    paddingHorizontal: 46,
    paddingTop: 52,
    paddingBottom: 38,
    overflow: "hidden",
    justifyContent: "space-between",
    shadowColor: EXPORT_COLORS.gold,
    shadowOpacity: 0.46,
    shadowRadius: 34,
  },
  frameOuter: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 18,
    bottom: 18,
    borderRadius: 48,
    borderWidth: 2,
  },
  frameInner: {
    position: "absolute",
    left: 34,
    right: 34,
    top: 34,
    bottom: 34,
    borderRadius: 38,
    borderWidth: 1,
  },
  crestSvg: {
    position: "absolute",
    top: -2,
    left: 0,
  },
});
