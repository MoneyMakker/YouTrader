import type { AchievementStatSlot, AchievementStatTone } from "./achievementStatSlots";
import { t } from "../../../i18n";
import { statLabelFontSize, statValueFontSize } from "./shareCardTypography";
import { STAT_BOX_SLOTS, STAT_EXPORT_HEIGHT, STAT_EXPORT_WIDTH, STAT_TEXT, type StatSlot } from "./statTemplateLayout";

export type StatTextLayer = {
  label: string;
  value: string;
  tone: AchievementStatTone;
  rect: { x: number; y: number; w: number; h: number };
  labelSize: number;
  valueSize: number;
};

function slotToPx(slot: StatSlot) {
  return {
    x: (slot.left / 100) * STAT_EXPORT_WIDTH,
    y: (slot.top / 100) * STAT_EXPORT_HEIGHT,
    w: (slot.width / 100) * STAT_EXPORT_WIDTH,
    h: (slot.height / 100) * STAT_EXPORT_HEIGHT,
  };
}

function toneFill(tone: AchievementStatTone) {
  if (tone === "white") return STAT_TEXT.white;
  if (tone === "purple") return STAT_TEXT.purple;
  if (tone === "red") return STAT_TEXT.red;
  if (tone === "gold") return STAT_TEXT.gold;
  return STAT_TEXT.green;
}

/** Shrink value font so long strings stay inside the stat box. */
export function fitValueFontSize(value: string, maxWidth: number, startSize: number) {
  const len = Math.max(1, value.replace(/\s/g, "").length);
  let size = startSize;
  const minSize = Math.round(startSize * 0.42);
  while (size > minSize && len * size * 0.56 > maxWidth * 0.92) {
    size -= 2;
  }
  return size;
}

export function buildStatTextLayers(slots: AchievementStatSlot[]): StatTextLayer[] {
  const labelSize = statLabelFontSize();
  return STAT_BOX_SLOTS.map((slot, index) => {
    const stat = slots[index] ?? { label: t("trades"), value: "0", tone: "white" as const };
    const rect = slotToPx(slot);
    const baseValueSize = statValueFontSize(stat.value);
    const valueSize = fitValueFontSize(stat.value, rect.w * 0.84, baseValueSize);
    return {
      label: stat.label,
      value: stat.value,
      tone: stat.tone,
      rect,
      labelSize,
      valueSize,
    };
  });
}

export function toneFillColor(tone: AchievementStatTone) {
  return toneFill(tone);
}

export const STAT_CARD_EXPORT_WIDTH = STAT_EXPORT_WIDTH;
export const STAT_CARD_EXPORT_HEIGHT = STAT_EXPORT_HEIGHT;
