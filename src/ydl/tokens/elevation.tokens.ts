/**
 * Semantic elevation — restrained iOS shadows + Android elevation.
 * Prefer borders/tonal surfaces over heavy shadows. Never animate these.
 */

export const ydlShadowColor = {
  neutral: "rgba(0,0,0,0.28)",
  card: "rgba(0,0,0,0.35)",
  lime: "rgba(163,255,18,0.22)",
  purple: "rgba(176,38,255,0.22)",
  red: "rgba(255,59,95,0.20)",
  yellow: "rgba(255,209,102,0.18)",
} as const;

export type YdlElevationStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

export const ydlElevation = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: ydlShadowColor.neutral,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: ydlShadowColor.neutral,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  floating: {
    shadowColor: ydlShadowColor.card,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  modal: {
    shadowColor: ydlShadowColor.card,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
  },
  // Legacy aliases
  low: {
    shadowColor: ydlShadowColor.neutral,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  medium: {
    shadowColor: ydlShadowColor.card,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  high: {
    shadowColor: ydlShadowColor.card,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
  },
} as const satisfies Record<string, YdlElevationStyle>;

export type YdlElevationToken = keyof typeof ydlElevation;

export const ydlToneBorder = {
  lime: "rgba(163,255,18,0.30)",
  purple: "rgba(176,38,255,0.30)",
  red: "rgba(255,59,95,0.28)",
  yellow: "rgba(255,209,102,0.28)",
  neutral: "rgba(255,255,255,0.10)",
} as const;
