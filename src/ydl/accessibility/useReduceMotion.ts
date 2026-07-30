import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Local Reduce Motion subscription. No global mutable cache / event bus.
 * Prefer this hook in components; Lottie/sheets may still use motion helpers.
 */
export function useYdlReduceMotion(initial = false): boolean {
  const [enabled, setEnabled] = useState(initial);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setEnabled(value);
      })
      .catch(() => {
        if (mounted) setEnabled(false);
      });

    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setEnabled(value);
    });

    return () => {
      mounted = false;
      const removable = sub as { remove?: () => void };
      removable.remove?.();
    };
  }, []);

  return enabled;
}
