import { AccessibilityInfo } from "react-native";

/**
 * Announce important asynchronous UI outcomes to screen readers.
 * Keep messages short; do not announce routine presses.
 */
export function announceYdlAccessibility(message: string): void {
  const trimmed = message.trim();
  if (!trimmed) return;
  try {
    AccessibilityInfo.announceForAccessibility(trimmed);
  } catch {
    // no-op — announcements must never crash UI
  }
}
