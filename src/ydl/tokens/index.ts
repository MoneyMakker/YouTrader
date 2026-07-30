/**
 * Canonical YDL design tokens — Phase 5.
 * Feature code: import from `src/ydl/tokens` (or `src/ydl/components` for UI).
 * Prefer semantic colors via theme hooks — not primitive palette.
 */

export {
  ydlPrimitiveColor,
  ydlCore,
  ydlLegacyGraphite,
  type YdlPrimitiveColorName,
} from "./color.primitive";

export {
  ydlSemanticColorsDark,
  ydlSemanticColorsLight,
  ydlColor,
  resolveYdlSemanticColor,
  type YdlSemanticColors,
  type YdlSemanticColorPath,
  type YdlColorToken,
} from "./color.semantic";

export {
  ydlSpace,
  ydlSpaceSemantic,
  ydlSpaceStep,
  type YdlSpaceToken,
} from "./spacing.tokens";

export {
  ydlRadius,
  ydlRadiusScale,
  type YdlRadiusToken,
} from "./radius.tokens";

export {
  ydlTypographyRoles,
  ydlTypography,
  ydlFontSize,
  resolveYdlTypographyRole,
  type YdlTypographyRole,
  type YdlTypographyToken,
} from "./typography.tokens";

export {
  ydlElevation,
  ydlShadowColor,
  ydlToneBorder,
  type YdlElevationToken,
  type YdlElevationStyle,
} from "./elevation.tokens";

export { ydlOpacity, type YdlOpacityToken } from "./opacity.tokens";

export { ydlLayout, type YdlLayoutToken } from "./layout.tokens";

export type { YdlAppearance, YdlTheme } from "./theme.types";
export { ydlThemeDark } from "./theme.dark";
export { ydlThemeLight } from "./theme.light";
export {
  resolveYdlTheme,
  useYdlTheme,
  useYdlColorScheme,
  useYdlSemanticColor,
} from "./theme";

import { ydlLegacyGraphite } from "./color.primitive";

export const ydlLegacy = {
  graphite: {
    ...ydlLegacyGraphite,
    cardBorder: ydlLegacyGraphite.border,
  },
} as const;
