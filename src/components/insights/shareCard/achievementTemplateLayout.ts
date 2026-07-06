import type { ImageStyle, ViewStyle } from "react-native";

/** Native pixels of the bundled galaxy template. */
export const ACHIEVEMENT_TEMPLATE_NATIVE = {
  width: 664,
  height: 1024,
} as const;

/**
 * Export canvas matches template aspect ratio at 2048px wide.
 * Edge-to-edge artwork — no letterboxing, no crop, no distortion.
 */
export const ACHIEVEMENT_EXPORT_WIDTH = 2048;
export const ACHIEVEMENT_EXPORT_HEIGHT = Math.round(
  (ACHIEVEMENT_EXPORT_WIDTH * ACHIEVEMENT_TEMPLATE_NATIVE.height) / ACHIEVEMENT_TEMPLATE_NATIVE.width,
);

/** Bundled galaxy reward template — sole background for all achievement exports. */
export const ACHIEVEMENT_GALAXY_TEMPLATE = require("../../../../assets/share-templates/youtrader-achievement-galaxy-template.png");

/** @deprecated Use ACHIEVEMENT_GALAXY_TEMPLATE */
export const ACHIEVEMENT_TEMPLATE = ACHIEVEMENT_GALAXY_TEMPLATE;

/** Text overlay as a fraction of the full artwork (below YOUTRADER plaque). */
export const ACHIEVEMENT_REWARD_OVERLAY_FRACTION = {
  left: 0.06,
  top: 0.625,
  width: 0.88,
  height: 0.28,
} as const;

export const ACHIEVEMENT_TEMPLATE_LAYOUT = {
  canvas: { width: ACHIEVEMENT_EXPORT_WIDTH, height: ACHIEVEMENT_EXPORT_HEIGHT },
  native: ACHIEVEMENT_TEMPLATE_NATIVE,
  rewardOverlayFraction: ACHIEVEMENT_REWARD_OVERLAY_FRACTION,
} as const;

/** Full-bleed artwork rect (canvas matches native aspect ratio). */
export function getContainedArtworkRect() {
  return {
    left: 0,
    top: 0,
    width: ACHIEVEMENT_EXPORT_WIDTH,
    height: ACHIEVEMENT_EXPORT_HEIGHT,
    scale: ACHIEVEMENT_EXPORT_WIDTH / ACHIEVEMENT_TEMPLATE_NATIVE.width,
  };
}

export function achievementTemplateImageStyle(): ImageStyle {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: ACHIEVEMENT_EXPORT_WIDTH,
    height: ACHIEVEMENT_EXPORT_HEIGHT,
  };
}

export function achievementRewardOverlayStyle(): ViewStyle {
  const art = getContainedArtworkRect();
  const frac = ACHIEVEMENT_REWARD_OVERLAY_FRACTION;
  return {
    position: "absolute",
    left: art.width * frac.left,
    top: art.height * frac.top,
    width: art.width * frac.width,
    height: art.height * frac.height,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: "10%",
    paddingTop: "8%",
    paddingBottom: "10%",
  };
}

export function achievementScaledFont(sizeAtDesign: number) {
  return Math.round((sizeAtDesign * ACHIEVEMENT_EXPORT_WIDTH) / ACHIEVEMENT_TEMPLATE_NATIVE.width);
}
