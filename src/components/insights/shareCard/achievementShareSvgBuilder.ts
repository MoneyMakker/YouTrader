import type { Achievement } from "../../../analytics/achievements";
import type { AchievementRewardOverlayCopy } from "./achievementHelpers";
import { buildAchievementShareTextLayout } from "./achievementShareTextLayout";
import { resolveAchievementTextTheme } from "./achievementTextTheme";

export type AchievementSvgTextLayer = {
  text: string;
  lines?: string[];
  x: number;
  y: number;
  fontSize: number;
  lineHeight?: number;
  fontWeight: "500" | "600" | "700" | "900";
  fill: string;
  letterSpacing?: number;
  shadowFill?: string;
  shadowDy?: number;
};

function appendLayer(
  layers: AchievementSvgTextLayer[],
  layer: AchievementSvgTextLayer,
  withShadow: boolean,
) {
  if (withShadow && layer.shadowFill) {
    layers.push({
      ...layer,
      fill: layer.shadowFill,
      y: layer.y + (layer.shadowDy ?? 2),
    });
  }
  layers.push(layer);
}

export function buildAchievementSvgLayers(
  copy: AchievementRewardOverlayCopy,
  item?: Achievement | null,
): AchievementSvgTextLayer[] {
  const layout = buildAchievementShareTextLayout(copy);
  const theme = resolveAchievementTextTheme(item);
  const layers: AchievementSvgTextLayer[] = [];

  appendLayer(
    layers,
    {
      text: copy.kicker,
      x: layout.safe.cx,
      y: layout.kicker.y,
      fontSize: layout.kicker.fontSize,
      fontWeight: "700",
      fill: theme.kicker,
      letterSpacing: layout.kicker.letterSpacing,
      shadowFill: theme.titleShadow,
    },
    true,
  );

  appendLayer(
    layers,
    {
      text: layout.title.lines.join("\n"),
      lines: layout.title.lines,
      x: layout.safe.cx,
      y: layout.title.y,
      fontSize: layout.title.fontSize,
      lineHeight: layout.title.lineHeight,
      fontWeight: "900",
      fill: theme.title,
      shadowFill: theme.titleShadow,
      shadowDy: 3,
    },
    true,
  );

  if (copy.description && layout.description) {
    appendLayer(
      layers,
      {
        text: layout.description.lines.join("\n"),
        lines: layout.description.lines,
        x: layout.safe.cx,
        y: layout.description.y,
        fontSize: layout.description.fontSize,
        lineHeight: layout.description.lineHeight,
        fontWeight: "500",
        fill: theme.description,
        shadowFill: theme.titleShadow,
        shadowDy: 2,
      },
      true,
    );
  }

  if (copy.detail && layout.detail) {
    appendLayer(
      layers,
      {
        text: copy.detail,
        x: layout.safe.cx,
        y: layout.detail.y,
        fontSize: layout.detail.fontSize,
        fontWeight: "600",
        fill: theme.detail,
      },
      false,
    );
  }

  return layers;
}
