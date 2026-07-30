import { ydlDuration, ydlSpring } from "./tokens";
import type { YdlHapticPreset } from "../haptics";

export type YdlSpringConfig = {
  damping: number;
  stiffness: number;
  mass: number;
};

export type YdlPressInteraction = {
  scaleTo: number;
  opacityTo: number;
  durationMs: number;
  spring: YdlSpringConfig;
  haptic?: YdlHapticPreset;
  useNativeDriver: boolean;
};

export const ydlPress = {
  buttonPrimary: {
    scaleTo: 0.975,
    opacityTo: 1,
    durationMs: ydlDuration.Button,
    spring: ydlSpring.Button,
    haptic: "ImpactLight",
    useNativeDriver: true,
  },
  buttonSecondary: {
    scaleTo: 0.98,
    opacityTo: 0.92,
    durationMs: ydlDuration.Button,
    spring: ydlSpring.Button,
    haptic: "Selection",
    useNativeDriver: true,
  },
  card: {
    scaleTo: 0.985,
    opacityTo: 1,
    durationMs: ydlDuration.Fast,
    spring: ydlSpring.Card,
    haptic: "Selection",
    useNativeDriver: true,
  },
  listItem: {
    scaleTo: 0.99,
    opacityTo: 0.94,
    durationMs: ydlDuration.Fast,
    spring: ydlSpring.Fast,
    useNativeDriver: true,
  },
  icon: {
    scaleTo: 0.92,
    opacityTo: 0.9,
    durationMs: ydlDuration.Fast,
    spring: ydlSpring.Fast,
    haptic: "Selection",
    useNativeDriver: true,
  },
} as const satisfies Record<string, YdlPressInteraction>;

export type YdlPressToken = keyof typeof ydlPress;
