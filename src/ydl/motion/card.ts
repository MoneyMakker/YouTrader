import { ydlElevation } from "../elevation";
import { ydlPress, type YdlSpringConfig } from "./press";
import { ydlDuration, ydlSpring } from "./tokens";
import type { YdlHapticPreset } from "../haptics";

export type YdlCardInteractionState =
  | "rest"
  | "lift"
  | "press"
  | "release"
  | "focus"
  | "selected"
  | "disabled";

export type YdlCardInteractionConfig = {
  state: YdlCardInteractionState;
  scale: number;
  opacity: number;
  translateY: number;
  durationMs: number;
  spring: YdlSpringConfig;
  elevation: keyof typeof ydlElevation;
  haptic?: YdlHapticPreset;
  useNativeDriver: boolean;
};

export const ydlCardInteraction = {
  rest: {
    state: "rest",
    scale: 1,
    opacity: 1,
    translateY: 0,
    durationMs: ydlDuration.Card,
    spring: ydlSpring.Card,
    elevation: "none",
    useNativeDriver: true,
  },
  lift: {
    state: "lift",
    scale: 1.015,
    opacity: 1,
    translateY: -2,
    durationMs: ydlDuration.Fast,
    spring: ydlSpring.Card,
    elevation: "low",
    useNativeDriver: true,
  },
  press: {
    state: "press",
    scale: ydlPress.card.scaleTo,
    opacity: 1,
    translateY: 1,
    durationMs: ydlDuration.Fast,
    spring: ydlSpring.Button,
    elevation: "none",
    haptic: "Selection",
    useNativeDriver: true,
  },
  release: {
    state: "release",
    scale: 1,
    opacity: 1,
    translateY: 0,
    durationMs: ydlDuration.Card,
    spring: ydlSpring.Card,
    elevation: "none",
    useNativeDriver: true,
  },
  focus: {
    state: "focus",
    scale: 1.01,
    opacity: 1,
    translateY: 0,
    durationMs: ydlDuration.Normal,
    spring: ydlSpring.Glass,
    elevation: "low",
    useNativeDriver: true,
  },
  selected: {
    state: "selected",
    scale: 1,
    opacity: 1,
    translateY: 0,
    durationMs: ydlDuration.Normal,
    spring: ydlSpring.Card,
    elevation: "medium",
    haptic: "Selection",
    useNativeDriver: true,
  },
  disabled: {
    state: "disabled",
    scale: 1,
    opacity: 0.48,
    translateY: 0,
    durationMs: ydlDuration.Fast,
    spring: ydlSpring.Fast,
    elevation: "none",
    useNativeDriver: true,
  },
} as const satisfies Record<YdlCardInteractionState, YdlCardInteractionConfig>;

export function getYdlCardInteraction(state: YdlCardInteractionState): YdlCardInteractionConfig {
  return ydlCardInteraction[state];
}
