import type { AchievementRewardOverlayCopy } from "./achievementHelpers";
import {
  ACHIEVEMENT_EXPORT_HEIGHT,
  ACHIEVEMENT_EXPORT_WIDTH,
  ACHIEVEMENT_REWARD_OVERLAY_FRACTION,
  achievementScaledFont,
} from "./achievementTemplateLayout";

/** Design px at native template width (664) — maps to ~18–32 / 12–18 on export. */
export const ACHIEVEMENT_LABEL_DESIGN = 16;
export const ACHIEVEMENT_TITLE_DESIGN_MAX = 38;
export const ACHIEVEMENT_TITLE_DESIGN_MIN = 20;
export const ACHIEVEMENT_DESC_DESIGN_MAX = 20;
export const ACHIEVEMENT_DESC_DESIGN_MIN = 14;
export const ACHIEVEMENT_DATE_DESIGN = 14;

export const ACHIEVEMENT_TITLE_MAX_LINES = 3;
export const ACHIEVEMENT_DESC_MAX_LINES = 2;

const H_PAD_RATIO = 0.1;
const V_PAD_TOP_RATIO = 0.08;
const V_PAD_BOTTOM_RATIO = 0.1;
const GAP_KICKER_TITLE_DESIGN = 8;
const GAP_TITLE_DESC_DESIGN = 8;
const GAP_DESC_DETAIL_DESIGN = 6;

export type AchievementTitleLayout = {
  fontSize: number;
  lineHeight: number;
  lines: string[];
};

export type AchievementTextBlockLayout = {
  fontSize: number;
  lineHeight: number;
  lines: string[];
};

export type AchievementShareTextLayout = {
  safe: { x: number; y: number; w: number; h: number; cx: number; maxTextWidth: number };
  kicker: { y: number; fontSize: number; letterSpacing: number };
  title: AchievementTitleLayout & { y: number };
  description?: AchievementTextBlockLayout & { y: number };
  detail?: { y: number; fontSize: number };
};

export function estimateTextWidth(text: string, fontSize: number, letterSpacing = 0): number {
  if (!text) return 0;
  const avgChar = fontSize * 0.54;
  return text.length * avgChar + Math.max(0, text.length - 1) * letterSpacing;
}

function ellipsizeLine(text: string, maxWidth: number, fontSize: number): string {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && estimateTextWidth(`${trimmed}…`, fontSize) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

export function wrapTextLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number,
  allowEllipsize: boolean,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else if (allowEllipsize) {
      lines.push(ellipsizeLine(word, maxWidth, fontSize));
      current = "";
    } else {
      current = word;
    }

    if (lines.length >= maxLines) {
      if (allowEllipsize) {
        lines[maxLines - 1] = ellipsizeLine(
          current ? `${lines[maxLines - 1]} ${current}`.trim() : lines[maxLines - 1],
          maxWidth,
          fontSize,
        );
      } else if (current && lines.length < maxLines) {
        lines.push(current);
      }
      return lines.slice(0, maxLines);
    }
  }

  if (current) {
    if (lines.length >= maxLines) {
      if (allowEllipsize) {
        lines[maxLines - 1] = ellipsizeLine(`${lines[maxLines - 1]} ${current}`.trim(), maxWidth, fontSize);
      }
    } else {
      lines.push(current);
    }
  }

  return lines.slice(0, maxLines);
}

function blockHeight(lines: string[], lineHeight: number, fontSize: number) {
  if (!lines.length) return 0;
  return fontSize * 0.88 + Math.max(0, lines.length - 1) * lineHeight;
}

function titleBlock(title: string, maxWidth: number, designSize: number, allowEllipsize: boolean): AchievementTitleLayout {
  const fontSize = achievementScaledFont(designSize);
  const lineHeight = Math.round(fontSize * 1.14);
  const lines = wrapTextLines(title.trim().toUpperCase(), maxWidth, fontSize, ACHIEVEMENT_TITLE_MAX_LINES, allowEllipsize);
  return { fontSize, lineHeight, lines };
}

function descBlock(text: string, maxWidth: number, designSize: number, allowEllipsize: boolean): AchievementTextBlockLayout {
  const fontSize = achievementScaledFont(designSize);
  const lineHeight = Math.round(fontSize * 1.2);
  const lines = wrapTextLines(text, maxWidth, fontSize, ACHIEVEMENT_DESC_MAX_LINES, allowEllipsize);
  return { fontSize, lineHeight, lines };
}

function stackHeight(
  copy: AchievementRewardOverlayCopy,
  maxWidth: number,
  titleDesign: number,
  descDesign: number,
  allowEllipsize: boolean,
) {
  const kickerSize = achievementScaledFont(ACHIEVEMENT_LABEL_DESIGN);
  const gapMd = achievementScaledFont(GAP_KICKER_TITLE_DESIGN);
  const gapSm = achievementScaledFont(GAP_TITLE_DESC_DESIGN);
  const gapXs = achievementScaledFont(GAP_DESC_DETAIL_DESIGN);

  const title = titleBlock(copy.title, maxWidth, titleDesign, allowEllipsize);
  let height = kickerSize + gapMd + blockHeight(title.lines, title.lineHeight, title.fontSize);

  if (copy.description) {
    const desc = descBlock(copy.description, maxWidth, descDesign, allowEllipsize);
    height += gapSm + blockHeight(desc.lines, desc.lineHeight, desc.fontSize);
    if (copy.detail) {
      height += gapXs + achievementScaledFont(ACHIEVEMENT_DATE_DESIGN);
    }
  } else if (copy.detail) {
    height += gapSm + achievementScaledFont(ACHIEVEMENT_DATE_DESIGN);
  }

  return height;
}

function widthFits(block: AchievementTitleLayout | AchievementTextBlockLayout, maxWidth: number) {
  return block.lines.every((line) => estimateTextWidth(line, block.fontSize) <= maxWidth * 1.02);
}

export function pickAchievementTitleLayout(title: string, maxWidthPx: number): AchievementTitleLayout {
  for (let design = ACHIEVEMENT_TITLE_DESIGN_MAX; design >= ACHIEVEMENT_TITLE_DESIGN_MIN; design -= 1) {
    const block = titleBlock(title, maxWidthPx, design, false);
    if (widthFits(block, maxWidthPx)) return block;
  }
  return titleBlock(title, maxWidthPx, ACHIEVEMENT_TITLE_DESIGN_MIN, true);
}

function pickDescriptionLayout(text: string, maxWidthPx: number, allowEllipsize: boolean) {
  for (let design = ACHIEVEMENT_DESC_DESIGN_MAX; design >= ACHIEVEMENT_DESC_DESIGN_MIN; design -= 1) {
    const block = descBlock(text, maxWidthPx, design, false);
    if (widthFits(block, maxWidthPx)) return block;
  }
  return descBlock(text, maxWidthPx, ACHIEVEMENT_DESC_DESIGN_MIN, allowEllipsize);
}

export function buildAchievementShareTextLayout(copy: AchievementRewardOverlayCopy): AchievementShareTextLayout {
  const frac = ACHIEVEMENT_REWARD_OVERLAY_FRACTION;
  const ox = ACHIEVEMENT_EXPORT_WIDTH * frac.left;
  const oy = ACHIEVEMENT_EXPORT_HEIGHT * frac.top;
  const ow = ACHIEVEMENT_EXPORT_WIDTH * frac.width;
  const oh = ACHIEVEMENT_EXPORT_HEIGHT * frac.height;
  const cx = ox + ow / 2;

  const padH = ow * H_PAD_RATIO;
  const padTop = oh * V_PAD_TOP_RATIO;
  const padBottom = oh * V_PAD_BOTTOM_RATIO;
  const safeY = oy + padTop;
  const safeH = oh - padTop - padBottom;
  const maxTextWidth = ow - padH * 2;

  let chosenTitleDesign = ACHIEVEMENT_TITLE_DESIGN_MIN;
  let chosenDescDesign = ACHIEVEMENT_DESC_DESIGN_MIN;

  outer: for (let titleDesign = ACHIEVEMENT_TITLE_DESIGN_MAX; titleDesign >= ACHIEVEMENT_TITLE_DESIGN_MIN; titleDesign -= 1) {
    for (let descDesign = ACHIEVEMENT_DESC_DESIGN_MAX; descDesign >= ACHIEVEMENT_DESC_DESIGN_MIN; descDesign -= 1) {
      const height = stackHeight(copy, maxTextWidth, titleDesign, descDesign, false);
      const title = titleBlock(copy.title, maxTextWidth, titleDesign, false);
      if (!widthFits(title, maxTextWidth)) continue;
      if (copy.description) {
        const desc = descBlock(copy.description, maxTextWidth, descDesign, false);
        if (!widthFits(desc, maxTextWidth)) continue;
      }
      if (height <= safeH) {
        chosenTitleDesign = titleDesign;
        chosenDescDesign = descDesign;
        break outer;
      }
    }
  }

  if (chosenTitleDesign === ACHIEVEMENT_TITLE_DESIGN_MIN) {
    for (let titleDesign = ACHIEVEMENT_TITLE_DESIGN_MAX; titleDesign >= ACHIEVEMENT_TITLE_DESIGN_MIN; titleDesign -= 1) {
      const height = stackHeight(copy, maxTextWidth, titleDesign, chosenDescDesign, true);
      if (height <= safeH) {
        chosenTitleDesign = titleDesign;
        break;
      }
    }
  }

  const kickerSize = achievementScaledFont(ACHIEVEMENT_LABEL_DESIGN);
  const kickerSpacing = achievementScaledFont(2);
  const gapMd = achievementScaledFont(GAP_KICKER_TITLE_DESIGN);
  const gapSm = achievementScaledFont(GAP_TITLE_DESC_DESIGN);
  const gapXs = achievementScaledFont(GAP_DESC_DETAIL_DESIGN);

  const allowEllipsize = chosenTitleDesign === ACHIEVEMENT_TITLE_DESIGN_MIN;
  const titleLayout = titleBlock(copy.title, maxTextWidth, chosenTitleDesign, allowEllipsize);
  const descAllowEllipsize = chosenDescDesign === ACHIEVEMENT_DESC_DESIGN_MIN;

  let y = safeY + kickerSize * 0.15;
  const kicker = { y: y + kickerSize * 0.85, fontSize: kickerSize, letterSpacing: kickerSpacing };
  y += kickerSize + gapMd;

  const titleFirstBaseline = y + titleLayout.fontSize * 0.88;
  y += blockHeight(titleLayout.lines, titleLayout.lineHeight, titleLayout.fontSize) + gapSm;

  let description: AchievementShareTextLayout["description"];
  if (copy.description) {
    const desc = pickDescriptionLayout(copy.description, maxTextWidth, descAllowEllipsize);
    description = {
      y: y + desc.fontSize * 0.88,
      fontSize: desc.fontSize,
      lines: desc.lines,
      lineHeight: desc.lineHeight,
    };
    y += blockHeight(desc.lines, desc.lineHeight, desc.fontSize) + gapXs;
  }

  let detail: AchievementShareTextLayout["detail"];
  if (copy.detail) {
    const dateSize = achievementScaledFont(ACHIEVEMENT_DATE_DESIGN);
    detail = {
      y: Math.min(y + dateSize * 0.88, safeY + safeH - dateSize * 0.2),
      fontSize: dateSize,
    };
  }

  return {
    safe: { x: ox + padH, y: safeY, w: maxTextWidth, h: safeH, cx, maxTextWidth },
    kicker,
    title: { ...titleLayout, y: titleFirstBaseline },
    description,
    detail,
  };
}

/** @deprecated Use pickAchievementTitleLayout — kept for RN preview card. */
export function achievementTitleDesignSize(title: string): number {
  const frac = ACHIEVEMENT_REWARD_OVERLAY_FRACTION;
  const ow = ACHIEVEMENT_EXPORT_WIDTH * frac.width;
  const maxTextWidth = ow * (1 - H_PAD_RATIO * 2);
  for (let design = ACHIEVEMENT_TITLE_DESIGN_MAX; design >= ACHIEVEMENT_TITLE_DESIGN_MIN; design -= 1) {
    const block = titleBlock(title, maxTextWidth, design, false);
    if (widthFits(block, maxTextWidth)) return design;
  }
  return ACHIEVEMENT_TITLE_DESIGN_MIN;
}
