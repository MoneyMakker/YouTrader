import React, { useMemo } from "react";
import { BlurView } from "expo-blur";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { colors } from "../../theme/colors";

export type GlassCardProps = ViewProps & {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Lighter blur for dense grids (stats chips, achievement badges). */
  compact?: boolean;
  intensity?: number;
  tint?: "dark" | "light" | "default";
};

const DEFAULT_RADIUS = 24;
const COMPACT_RADIUS = 18;

function flattenStyle(style: StyleProp<ViewStyle>) {
  return StyleSheet.flatten(style) ?? {};
}

/**
 * Glassmorphism surface: native blur on iOS, semi-transparent fallback elsewhere.
 * Keep `compact` for lists/grids to limit simultaneous blur layers.
 */
export function GlassCard({
  children,
  style,
  compact = false,
  intensity,
  tint = "dark",
  ...rest
}: GlassCardProps) {
  const flat = flattenStyle(style);
  const borderRadius =
    typeof flat.borderRadius === "number" ? flat.borderRadius : compact ? COMPACT_RADIUS : DEFAULT_RADIUS;
  const padding =
    typeof flat.padding === "number"
      ? flat.padding
      : typeof flat.paddingHorizontal === "number" || typeof flat.paddingVertical === "number"
        ? undefined
        : compact
          ? 12
          : 16;

  const shellStyle = useMemo(
    () => ({
      borderRadius,
      borderWidth: flat.borderWidth ?? 1,
      borderColor: (flat.borderColor as string | undefined) ?? colors.cardBorder,
      overflow: "hidden" as const,
    }),
    [borderRadius, flat.borderColor, flat.borderWidth],
  );

  const layoutStyle: ViewStyle = {
    ...flat,
    backgroundColor: undefined,
    padding: undefined,
    paddingHorizontal: undefined,
    paddingVertical: undefined,
    paddingTop: undefined,
    paddingBottom: undefined,
    paddingLeft: undefined,
    paddingRight: undefined,
  };

  const blurIntensity = intensity ?? (compact ? 22 : 38);

  const contentPaddingStyle: ViewStyle | undefined =
    padding !== undefined
      ? { padding }
      : {
          paddingHorizontal: flat.paddingHorizontal,
          paddingVertical: flat.paddingVertical,
          paddingTop: flat.paddingTop,
          paddingBottom: flat.paddingBottom,
          paddingLeft: flat.paddingLeft,
          paddingRight: flat.paddingRight,
        };

  if (Platform.OS === "ios") {
    return (
      <View style={[shellStyle, layoutStyle]} {...rest}>
        <BlurView intensity={blurIntensity} tint={tint} style={StyleSheet.absoluteFillObject} />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, compact ? styles.iosTintCompact : styles.iosTint]}
        />
        <View style={contentPaddingStyle} pointerEvents="box-none">
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={[shellStyle, layoutStyle, compact ? styles.androidFallbackCompact : styles.androidFallback]} {...rest}>
      <View style={contentPaddingStyle} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iosTint: {
    backgroundColor: "rgba(11, 15, 20, 0.42)",
  },
  iosTintCompact: {
    backgroundColor: "rgba(11, 15, 20, 0.52)",
  },
  androidFallback: {
    backgroundColor: "rgba(11, 15, 20, 0.88)",
  },
  androidFallbackCompact: {
    backgroundColor: "rgba(17, 22, 31, 0.92)",
  },
});
