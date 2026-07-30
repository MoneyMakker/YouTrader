/**
 * Build a combined accessibility label from visible parts.
 * Filters empty fragments; joins with ". " for VoiceOver pacing.
 */
export function ydlCombinedAccessibilityLabel(
  ...parts: Array<string | null | undefined | false>
): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(". ");
}

/**
 * Decorative vs meaningful icon guidance:
 * - decorative: adjacent text already names the control → hide icon from SR
 * - meaningful: icon-only → supply accessibilityLabel
 */
export function ydlIconAccessibilityProps(options: {
  decorative?: boolean;
  label?: string;
}):
  | {
      accessible: false;
      accessibilityElementsHidden: true;
      importantForAccessibility: "no-hide-descendants";
    }
  | {
      accessible: true;
      accessibilityRole: "image";
      accessibilityLabel: string;
    } {
  if (options.decorative) {
    return {
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: "no-hide-descendants",
    };
  }
  return {
    accessible: true,
    accessibilityRole: "image",
    accessibilityLabel: options.label?.trim() || "Icon",
  };
}
