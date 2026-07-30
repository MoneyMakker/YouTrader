import { ydlSemanticColorsDark } from "./color.semantic";
import { ydlElevation } from "./elevation.tokens";
import { ydlLayout } from "./layout.tokens";
import { ydlOpacity } from "./opacity.tokens";
import { ydlRadius } from "./radius.tokens";
import { ydlSpace } from "./spacing.tokens";
import { ydlTypographyRoles } from "./typography.tokens";
import type { YdlTheme } from "./theme.types";

export const ydlThemeDark: YdlTheme = {
  appearance: "dark",
  colors: ydlSemanticColorsDark,
  space: ydlSpace,
  radius: ydlRadius,
  typography: ydlTypographyRoles,
  elevation: ydlElevation,
  opacity: ydlOpacity,
  layout: ydlLayout,
};
