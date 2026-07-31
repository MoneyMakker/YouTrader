/**
 * YouTrader Design Language — material / glass tokens.
 * Values match GlassCard (src/components/ui/GlassCard.tsx) — do not drift.
 */
export const ydlMaterial = {
  glass: {
    intensityDefault: 38,
    intensityCompact: 22,
    /** ProValueModal GlassCard intensity={52} in host. */
    intensityModal: 52,
    tintDefault: "dark" as const,
    tintLight: "light" as const,
    tintSystem: "default" as const,
  },
  iosTint: {
    default: "rgba(11, 15, 20, 0.42)",
    compact: "rgba(11, 15, 20, 0.52)",
  },
  androidFallback: {
    default: "rgba(11, 15, 20, 0.88)",
    compact: "rgba(17, 22, 31, 0.92)",
  },
} as const;

export type YdlMaterialTint = "dark" | "light" | "default";
