import { t } from "../../i18n";
import type { Lang } from "../types";
import { MOODS } from "../constants";

export function moodTranslationKey(key: string) {
  const normalized = String(key || "").toLowerCase();
  if (normalized === "focused") return "moodFocused";
  if (normalized === "angry") return "moodAngry";
  if (normalized === "fomo") return "moodFomo";
  if (normalized === "foggy") return "moodFoggy";
  if (normalized === "sick") return "moodSick";
  if (normalized === "tired") return "moodTired";
  if (normalized === "oops") return "moodOops";
  if (normalized === "reckless") return "moodReckless";
  if (normalized === "gambling") return "moodGambling";
  if (normalized === "patient") return "moodPatient";
  if (normalized === "greedy") return "moodGreedy";
  return null;
}

export function moodLabel(key: string, _lang?: Lang) {
  const m = MOODS.find((x) => x.key === key);
  const translationKey = moodTranslationKey(key);
  const label = translationKey ? t(translationKey) : key;
  return m ? `${m.emoji} ${label}` : label;
}


