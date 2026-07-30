import { AccessibilityInfo, Platform } from "react-native";

let cachedReduceMotion: boolean | null = null;

/**
 * Resolve Reduce Motion. Cached after first async read; sync fallback is false
 * until known (callers should prefer resolveYdlReduceMotion()).
 */
export function getYdlReduceMotionCached(): boolean {
  return cachedReduceMotion === true;
}

export async function resolveYdlReduceMotion(): Promise<boolean> {
  try {
    const enabled = await AccessibilityInfo.isReduceMotionEnabled();
    cachedReduceMotion = enabled;
    return enabled;
  } catch {
    cachedReduceMotion = false;
    return false;
  }
}

/** Subscribe once at app boot in a later phase; safe no-op helper for now. */
export function subscribeYdlReduceMotion(onChange: (enabled: boolean) => void): () => void {
  const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
    cachedReduceMotion = enabled;
    onChange(enabled);
  });
  void resolveYdlReduceMotion().then(onChange);
  return () => {
    const removable = sub as { remove?: () => void };
    removable.remove?.();
  };
}

export function ydlMotionDuration(ms: number, reduceMotion = getYdlReduceMotionCached()): number {
  if (reduceMotion) return 0;
  return ms;
}

export function ydlNativeDriverDefault(): boolean {
  // Opacity/transform only on native driver; number/progress must stay false.
  return Platform.OS !== "web";
}
