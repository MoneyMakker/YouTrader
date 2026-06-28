import { Platform, Vibration } from "react-native";

function vibrate(pattern: number | number[]) {
  try {
    if (Platform.OS === "web") return;
    Vibration.vibrate(pattern);
  } catch {
    // Haptics are optional in this safe UI pass.
  }
}

export function lightHaptic() {
  vibrate(8);
}

export function successHaptic() {
  vibrate([0, 14, 40, 12]);
}

export function warningHaptic() {
  vibrate([0, 20, 35, 20]);
}
