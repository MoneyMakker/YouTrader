import type { AchievementRewardOverlayCopy } from "./achievementHelpers";
import { achievementTitleFontSize } from "./achievementHelpers";
import {
  ACHIEVEMENT_EXPORT_HEIGHT,
  ACHIEVEMENT_EXPORT_WIDTH,
  ACHIEVEMENT_REWARD_OVERLAY_FRACTION,
  achievementScaledFont,
} from "./achievementTemplateLayout";

export type AchievementSvgTextLayer = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: "500" | "600" | "700" | "900";
  fill: string;
  letterSpacing?: number;
};

const TEXT = {
  kicker: "#B8FF00",
  title: "#F7F8FA",
  description: "rgba(247,248,250,0.82)",
  detail: "#E8D4FF",
};

export function buildAchievementSvgLayers(copy: AchievementRewardOverlayCopy): AchievementSvgTextLayer[] {
  const frac = ACHIEVEMENT_REWARD_OVERLAY_FRACTION;
  const ox = ACHIEVEMENT_EXPORT_WIDTH * frac.left;
  const oy = ACHIEVEMENT_EXPORT_HEIGHT * frac.top;
  const ow = ACHIEVEMENT_EXPORT_WIDTH * frac.width;
  const oh = ACHIEVEMENT_EXPORT_HEIGHT * frac.height;
  const cx = ox + ow / 2;

  const kickerSize = achievementScaledFont(48);
  const titleSize = achievementScaledFont(achievementTitleFontSize(copy.title));
  const descriptionSize = achievementScaledFont(34);
  const detailSize = achievementScaledFont(46);

  const layers: AchievementSvgTextLayer[] = [];
  let y = oy + oh * 0.14;

  layers.push({
    text: copy.kicker,
    x: cx,
    y,
    fontSize: kickerSize,
    fontWeight: "700",
    fill: TEXT.kicker,
    letterSpacing: 7,
  });

  y += kickerSize * 1.15 + achievementScaledFont(32);
  layers.push({
    text: copy.title,
    x: cx,
    y,
    fontSize: titleSize,
    fontWeight: "900",
    fill: TEXT.title,
  });

  if (copy.description) {
    y += titleSize * 1.05 + achievementScaledFont(34);
    layers.push({
      text: copy.description,
      x: cx,
      y,
      fontSize: descriptionSize,
      fontWeight: "500",
      fill: TEXT.description,
    });
  }

  if (copy.detail) {
    y += descriptionSize * 1.2 + achievementScaledFont(36);
    layers.push({
      text: copy.detail,
      x: cx,
      y,
      fontSize: detailSize,
      fontWeight: "600",
      fill: TEXT.detail,
    });
  }

  return layers;
}
