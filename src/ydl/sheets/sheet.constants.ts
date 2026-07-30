import type { YdlSheetAppearance } from "./sheet.types";

/** Default fixed snap points for compact reference sheets. */
export const YDL_SHEET_SNAP_COMPACT = ["28%", "55%"] as const;

/** Taller fixed snap points for long-content demos. */
export const YDL_SHEET_SNAP_EXPANDED = ["40%", "75%", "92%"] as const;

export const YDL_SHEET_HANDLE_HEIGHT = 24;

export const YDL_SHEET_COLORS: Record<
  YdlSheetAppearance,
  {
    background: string;
    handle: string;
    backdrop: string;
    title: string;
    body: string;
    border: string;
  }
> = {
  dark: {
    background: "#0E141D",
    handle: "#3A4558",
    backdrop: "rgba(0, 0, 0, 0.55)",
    title: "#F4F7FB",
    body: "#A7B0C0",
    border: "#1F2A3A",
  },
  light: {
    background: "#F7F8FA",
    handle: "#C5CAD3",
    backdrop: "rgba(15, 23, 35, 0.35)",
    title: "#0E141D",
    body: "#4A5568",
    border: "#D7DCE5",
  },
};
