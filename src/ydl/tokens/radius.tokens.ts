/** Small semantic radius system. */
export const ydlRadius = {
  none: 0,
  small: 8,
  medium: 14,
  large: 18,
  card: 24,
  control: 14,
  pill: 9999,
  modal: 28,
  // Legacy aliases
  xs: 8,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 28,
  full: 9999,
  chip: 14,
  cardCompact: 18,
  sheet: 28,
} as const;

export const ydlRadiusScale = {
  none: ydlRadius.none,
  xs: ydlRadius.small,
  sm: ydlRadius.medium,
  md: ydlRadius.large,
  lg: ydlRadius.card,
  xl: ydlRadius.modal,
  full: ydlRadius.pill,
} as const;

export type YdlRadiusToken = keyof typeof ydlRadius;
