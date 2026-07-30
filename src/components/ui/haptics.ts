/**
 * UI haptics — thin bridge to YDL presets (expo-haptics + Vibration fallback).
 */
import { runYdlHaptic, ydlHapticPresets } from "../../ydl/haptics";

export function lightHaptic() {
  ydlHapticPresets.ImpactLight();
}

export function successHaptic() {
  ydlHapticPresets.Success();
}

export function warningHaptic() {
  ydlHapticPresets.Warning();
}

/** Selection / chip / secondary control feedback. */
export function selectionHaptic() {
  runYdlHaptic("Selection");
}

export {
  ydlHapticPresets,
  runYdlHaptic,
  type YdlHapticPreset,
} from "../../ydl/haptics";
