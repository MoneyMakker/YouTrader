import React, { useCallback, useMemo } from "react";
import { BottomSheetBackdrop, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { YDL_SHEET_COLORS } from "./sheet.constants";
import type { YdlSheetAppearance, YdlSheetBackdropMode } from "./sheet.types";
import { getYdlReduceMotionCached } from "../motion/accessibility";

type Options = {
  mode: YdlSheetBackdropMode;
  appearance: YdlSheetAppearance;
};

export function useYdlSheetBackdrop({ mode, appearance }: Options) {
  const colors = YDL_SHEET_COLORS[appearance];

  return useCallback(
    (props: BottomSheetBackdropProps) => {
      if (mode === "none") return null;
      const reduceMotion = getYdlReduceMotionCached();
      return (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior={mode === "pressable" ? "close" : "none"}
          opacity={reduceMotion ? 0.5 : 0.55}
          style={{ backgroundColor: colors.backdrop }}
        />
      );
    },
    [colors.backdrop, mode],
  );
}

export function ydlSheetAnimationConfigs():
  | { duration: number; dampingRatio: number }
  | undefined {
  if (getYdlReduceMotionCached()) {
    return {
      duration: 1,
      dampingRatio: 1,
    };
  }
  return undefined;
}

export function useYdlSheetAppearanceStyle(appearance: YdlSheetAppearance) {
  const colors = YDL_SHEET_COLORS[appearance];
  return useMemo(
    () => ({
      backgroundStyle: {
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderTopWidth: 1,
      },
    }),
    [colors.background, colors.border],
  );
}
