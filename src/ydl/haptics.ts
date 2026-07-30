import { Platform, Vibration } from "react-native";
import * as ExpoHaptics from "expo-haptics";

/**
 * YouTrader Design Language — haptic presets.
 * Prefer expo-haptics on native; Vibration remains a safe fallback.
 */

function vibrate(pattern: number | number[]) {
  try {
    if (Platform.OS === "web") return;
    Vibration.vibrate(pattern);
  } catch {
    // Haptics are optional.
  }
}

async function impact(style: ExpoHaptics.ImpactFeedbackStyle, fallback: number) {
  try {
    if (Platform.OS === "web") return;
    await ExpoHaptics.impactAsync(style);
  } catch {
    vibrate(fallback);
  }
}

async function notification(
  type: ExpoHaptics.NotificationFeedbackType,
  fallback: number | number[],
) {
  try {
    if (Platform.OS === "web") return;
    await ExpoHaptics.notificationAsync(type);
  } catch {
    vibrate(fallback);
  }
}

async function selection() {
  try {
    if (Platform.OS === "web") return;
    await ExpoHaptics.selectionAsync();
  } catch {
    vibrate(8);
  }
}

export const ydlHapticPresets = {
  Selection: () => {
    void selection();
  },
  Success: () => {
    void notification(ExpoHaptics.NotificationFeedbackType.Success, [0, 14, 40, 12]);
  },
  Warning: () => {
    void notification(ExpoHaptics.NotificationFeedbackType.Warning, [0, 20, 35, 20]);
  },
  Error: () => {
    void notification(ExpoHaptics.NotificationFeedbackType.Error, [0, 28, 40, 28, 40, 28]);
  },
  ImpactLight: () => {
    void impact(ExpoHaptics.ImpactFeedbackStyle.Light, 8);
  },
  ImpactMedium: () => {
    void impact(ExpoHaptics.ImpactFeedbackStyle.Medium, 16);
  },
  ImpactHeavy: () => {
    void impact(ExpoHaptics.ImpactFeedbackStyle.Heavy, 28);
  },
} as const;

export type YdlHapticPreset = keyof typeof ydlHapticPresets;

export function runYdlHaptic(preset: YdlHapticPreset) {
  ydlHapticPresets[preset]();
}
