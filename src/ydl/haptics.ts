import { Platform } from "react-native";
import * as ExpoHaptics from "expo-haptics";

/**
 * YouTrader Design Language — canonical haptic intents.
 * Only this module talks to expo-haptics. Callers use semantic intents.
 * Unavailable platforms / failures no-op (no Vibration fallback).
 */

export type YdlHapticIntent =
  | "selection"
  | "success"
  | "warning"
  | "error"
  | "impactLight"
  | "impactMedium"
  | "impactHeavy";

/** @deprecated Prefer YdlHapticIntent + runYdlHaptic. Kept for existing callers. */
export type YdlHapticPreset =
  | "Selection"
  | "Success"
  | "Warning"
  | "Error"
  | "ImpactLight"
  | "ImpactMedium"
  | "ImpactHeavy";

const PRESET_TO_INTENT: Record<YdlHapticPreset, YdlHapticIntent> = {
  Selection: "selection",
  Success: "success",
  Warning: "warning",
  Error: "error",
  ImpactLight: "impactLight",
  ImpactMedium: "impactMedium",
  ImpactHeavy: "impactHeavy",
};

function canUseNativeHaptics(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

async function runIntent(intent: YdlHapticIntent): Promise<void> {
  if (!canUseNativeHaptics()) return;

  try {
    switch (intent) {
      case "selection":
        await ExpoHaptics.selectionAsync();
        return;
      case "success":
        await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
        return;
      case "warning":
        await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning);
        return;
      case "error":
        await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error);
        return;
      case "impactLight":
        await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
        return;
      case "impactMedium":
        await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
        return;
      case "impactHeavy":
        await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy);
        return;
      default: {
        const _exhaustive: never = intent;
        return _exhaustive;
      }
    }
  } catch {
    // Haptics are optional; never crash the UI.
  }
}

export function runYdlHaptic(intent: YdlHapticIntent | YdlHapticPreset): void {
  const resolved: YdlHapticIntent =
    intent in PRESET_TO_INTENT
      ? PRESET_TO_INTENT[intent as YdlHapticPreset]
      : (intent as YdlHapticIntent);
  void runIntent(resolved);
}

/** Semantic intent map (canonical). */
export const ydlHapticIntents = {
  selection: () => runYdlHaptic("selection"),
  success: () => runYdlHaptic("success"),
  warning: () => runYdlHaptic("warning"),
  error: () => runYdlHaptic("error"),
  impactLight: () => runYdlHaptic("impactLight"),
  impactMedium: () => runYdlHaptic("impactMedium"),
  impactHeavy: () => runYdlHaptic("impactHeavy"),
} as const;

/**
 * Legacy preset names used across existing UI.
 * Implementations delegate to semantic intents only.
 */
export const ydlHapticPresets = {
  Selection: ydlHapticIntents.selection,
  Success: ydlHapticIntents.success,
  Warning: ydlHapticIntents.warning,
  Error: ydlHapticIntents.error,
  ImpactLight: ydlHapticIntents.impactLight,
  ImpactMedium: ydlHapticIntents.impactMedium,
  ImpactHeavy: ydlHapticIntents.impactHeavy,
} as const;

export function lightHaptic() {
  runYdlHaptic("impactLight");
}

export function successHaptic() {
  runYdlHaptic("success");
}

export function warningHaptic() {
  runYdlHaptic("warning");
}

export function selectionHaptic() {
  runYdlHaptic("selection");
}
