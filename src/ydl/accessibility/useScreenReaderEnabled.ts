import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Screen-reader enabled state where the platform reports it.
 * Local hook state only — no shared store.
 */
export function useYdlScreenReaderEnabled(initial = false): boolean {
  const [enabled, setEnabled] = useState(initial);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (mounted) setEnabled(value);
      })
      .catch(() => {
        if (mounted) setEnabled(false);
      });

    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", (value) => {
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
