/** App terminal palette — bridged from YDL core (pixel-identical to prior App.tsx values). */
import { ydlCore } from "../ydl/color";

export const C = {
  bg: ydlCore.bg,
  card: ydlCore.card,
  card2: ydlCore.card2,
  card3: ydlCore.card3,
  border: ydlCore.border,
  text: ydlCore.text,
  sub: ydlCore.sub,
  muted: ydlCore.muted,
  green: ydlCore.green,
  greenSoft: ydlCore.greenSoft,
  red: ydlCore.red,
  redSoft: ydlCore.redSoft,
  yellow: ydlCore.yellow,
  yellowSoft: ydlCore.yellowSoft,
  purple: ydlCore.purple,
  purpleSoft: ydlCore.purpleSoft,
  orange: ydlCore.orange,
  white: ydlCore.white,
} as const;
