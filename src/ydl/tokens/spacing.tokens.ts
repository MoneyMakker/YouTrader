/** Restrained spacing scale (pt). */
export const ydlSpace = {
  0: 0,
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
  // Named aliases (legacy-compatible)
  none: 0,
  xxxs: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
  huge: 64,
} as const;

export const ydlSpaceSemantic = {
  screenHorizontal: ydlSpace[16],
  sectionGap: ydlSpace[24],
  cardPadding: ydlSpace[16],
  controlGap: ydlSpace[8],
  inlineGap: ydlSpace[6],
} as const;

/** @deprecated Prefer numeric keys or ydlSpaceSemantic. */
export const ydlSpaceStep = {
  0: 0,
  1: 8,
  2: 16,
  3: 24,
  4: 32,
  5: 40,
  6: 48,
  8: 64,
} as const;

export type YdlSpaceToken = keyof typeof ydlSpace;
