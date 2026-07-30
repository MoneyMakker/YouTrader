export const ydlOpacity = {
  disabled: 0.4,
  pressed: 0.72,
  muted: 0.7,
  overlay: 0.55,
  skeleton: 0.35,
  skeletonPulseMin: 0.28,
  skeletonPulseMax: 0.55,
} as const;

export type YdlOpacityToken = keyof typeof ydlOpacity;
