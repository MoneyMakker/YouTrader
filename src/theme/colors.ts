/** Shared graphite palette — bridged from YDL legacy (pixel-identical). */
import { ydlLegacyGraphite } from "../ydl/color";

export const C = {
  bg: ydlLegacyGraphite.bg,
  card: ydlLegacyGraphite.card,
  card2: ydlLegacyGraphite.card2,
  text: ydlLegacyGraphite.text,
  sub: ydlLegacyGraphite.sub,
  muted: ydlLegacyGraphite.muted,
  white: ydlLegacyGraphite.white,
  green: ydlLegacyGraphite.green,
  greenSoft: ydlLegacyGraphite.greenSoft,
  purple: ydlLegacyGraphite.purple,
  purpleSoft: ydlLegacyGraphite.purpleSoft,
  red: ydlLegacyGraphite.red,
  redSoft: ydlLegacyGraphite.redSoft,
  yellow: ydlLegacyGraphite.yellow,
  yellowSoft: ydlLegacyGraphite.yellowSoft,
  border: ydlLegacyGraphite.border,
} as const;

export const colors = { ...C, cardBorder: C.border };
