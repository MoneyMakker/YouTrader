import type { ImageStyle, ViewStyle } from "react-native";

/** Native pixels of the bundled galaxy template. */
export const ACHIEVEMENT_TEMPLATE_NATIVE = {
  width: 664,
  height: 1024,
} as const;

/**
 * High-res export at native card aspect ratio (664×1024 → 1080×1665).
 * Keeps artwork proportions — no stretch or crop.
 */
export const ACHIEVEMENT_EXPORT_WIDTH = 1080;
export const ACHIEVEMENT_EXPORT_HEIGHT = Math.round(
  (ACHIEVEMENT_EXPORT_WIDTH * ACHIEVEMENT_TEMPLATE_NATIVE.height) / ACHIEVEMENT_TEMPLATE_NATIVE.width,
);

/** Bundled galaxy reward template — sole background for all achievement exports. */
export const ACHIEVEMENT_GALAXY_TEMPLATE = require("../../../../assets/share-templates/youtrader-achievement-galaxy-template.png");

/** @deprecated Use ACHIEVEMENT_GALAXY_TEMPLATE */
export const ACHIEVEMENT_TEMPLATE = ACHIEVEMENT_GALAXY_TEMPLATE;

/** Text overlay below the YOUTRADER plaque — inside frame safe area. */
export const ACHIEVEMENT_REWARD_OVERLAY_FRACTION = {
  left: 0.08,
  top: 0.64,
  width: 0.84,
  height: 0.26,
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
