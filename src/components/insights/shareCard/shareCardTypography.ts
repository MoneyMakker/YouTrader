import { EXPORT_CARD_HEIGHT, EXPORT_CARD_WIDTH } from "../exportDesign";
import { STAT_TEMPLATE_NATIVE_WIDTH } from "./statTemplateLayout";

/** Render canvas width — all typography scales from this. */
export const SHARE_CARD_RENDER_WIDTH = EXPORT_CARD_WIDTH;
export const SHARE_CARD_RENDER_HEIGHT = EXPORT_CARD_HEIGHT;

/** Scale a design-unit size (measured on native template art) to export pixels. */
export function scaleFromTemplate(sizeAtNative: number, nativeWidth = STAT_TEMPLATE_NATIVE_WIDTH) {
  return Math.round((sizeAtNative * SHARE_CARD_RENDER_WIDTH) / nativeWidth);
}

/** Percentage of card height — keeps labels readable at any export resolution. */
export function fontFromCardHeight(ratio: number) {
  return Math.max(12, Math.round(SHARE_CARD_RENDER_HEIGHT * ratio));
}

/** Uniform label size for all six stat blocks (+~22% vs prior 11pt design). */
export const STAT_LABEL_DESIGN_SIZE = 14;
export const STAT_LABEL_FONT_RATIO = 0.0138;

export function statLabelFontSize() {
  return Math.max(scaleFromTemplate(STAT_LABEL_DESIGN_SIZE), fontFromCardHeight(STAT_LABEL_FONT_RATIO));
}

/** Value sizes (+~35% vs prior) with auto-fit tiers for long strings. */
export function statValueDesignSize(value: string) {
  const len = value.replace(/\s/g, "").length;
  if (len >= 12) return 28;
  if (len >= 9) return 33;
  if (len >= 7) return 38;
  return 44;
}

export function statValueFontSize(value: string) {
  const design = statValueDesignSize(value);
  const ratio =
    design >= 44 ? 0.042 : design >= 38 ? 0.036 : design >= 33 ? 0.031 : 0.026;
  return Math.max(scaleFromTemplate(design), fontFromCardHeight(ratio));
}

export function statValueMinimumScale(value: string) {
  const len = value.replace(/\s/g, "").length;
  if (len >= 12) return 0.42;
  if (len >= 9) return 0.48;
  if (len >= 7) return 0.52;
  return 0.58;
}

export const STAT_BOX_PADDING = {
  horizontal: "8%" as const,
  vertical: "10%" as const,
};
