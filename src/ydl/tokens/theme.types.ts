import type { YdlSemanticColors } from "./color.semantic";
import type { ydlSpace } from "./spacing.tokens";
import type { ydlRadius } from "./radius.tokens";
import type { ydlTypographyRoles } from "./typography.tokens";
import type { ydlElevation } from "./elevation.tokens";
import type { ydlOpacity } from "./opacity.tokens";
import type { ydlLayout } from "./layout.tokens";

export type YdlAppearance = "light" | "dark";

export type YdlTheme = {
  appearance: YdlAppearance;
  colors: YdlSemanticColors;
  space: typeof ydlSpace;
  radius: typeof ydlRadius;
  typography: typeof ydlTypographyRoles;
  elevation: typeof ydlElevation;
  opacity: typeof ydlOpacity;
  layout: typeof ydlLayout;
};
