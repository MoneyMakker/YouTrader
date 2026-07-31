import { ydlThemeDark } from "./theme.dark";
import { ydlThemeLight } from "./theme.light";
import type { YdlAppearance, YdlTheme } from "./theme.types";
import {
  resolveYdlSemanticColor,
  type YdlSemanticColorPath,
} from "./color.semantic";

/**
 * Resolve a stable theme object for light/dark.
 * No global mutable singleton — callers pass appearance or use hooks.
 * App remains dark-terminal by default; light is explicit (sheets / system).
 */
export function resolveYdlTheme(appearance: YdlAppearance | null | undefined): YdlTheme {
  return appearance === "light" ? ydlThemeLight : ydlThemeDark;
}

/**
 * Product appearance for core surfaces.
 * YouTrader is a dark-terminal app. Following iOS Light mode here put
 * light-theme ink (#0E141D) on dark shell surfaces — invisible headings.
 * Light theme remains available only via explicit `appearance="light"` overrides
 * (sheets / Storybook), never via system scheme for the main product shell.
 */
export function useYdlColorScheme(): YdlAppearance {
  return "dark";
}

export function useYdlTheme(override?: YdlAppearance): YdlTheme {
  const product = useYdlColorScheme();
  return resolveYdlTheme(override ?? product);
}

export function useYdlSemanticColor(path: YdlSemanticColorPath, override?: YdlAppearance): string {
  const theme = useYdlTheme(override);
  return resolveYdlSemanticColor(theme.colors, path).color;
}

/**
 * Provider decision: **not required**.
 * Existing screens use terminal dark `C` / local sheet appearance.
 * Optional override for Storybook / tests via `override` arg on hooks.
 * Do not nest a competing ThemeProvider around the whole app in Phase 5.
 */
