import { useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";

/**
 * Shared responsive layout helpers for YouTrader.
 *
 * Single source of truth for tablet/iPad detection and adaptive sizing so screens
 * (Journal, Stats, AI Analytics, Calendar, Settings) do not duplicate breakpoint logic.
 *
 * iPhone layouts are preserved: `isTablet` is false on phones, so existing phone
 * styles keep rendering unchanged. Tablet branches only activate at >= TABLET_BREAKPOINT.
 */

// 768pt is the smallest iPad logical width (portrait). Large phones stay below this.
export const TABLET_BREAKPOINT = 768;
// 11" iPad landscape / 13" iPad portrait and up — used for 3-column command layouts.
export const WIDE_TABLET_BREAKPOINT = 1024;

export type ResponsiveLayout = {
  width: number;
  height: number;
  /** True on any tablet-width device (iPad / large Android tablet). */
  isTablet: boolean;
  /** True specifically on an iPad-class device (iOS + tablet width). */
  isIPad: boolean;
  /** True when wide enough for a 3-column command-center layout. */
  isWideTablet: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  /** Number of dashboard columns to render (1 on phone, 2–3 on iPad). */
  columns: 1 | 2 | 3;
  /** Outer horizontal padding for the active screen size. */
  contentPadding: number;
  /** Gap between cards/columns. */
  gutter: number;
  /** Max readable content width (prevents over-stretched single columns). */
  maxContentWidth: number;
};

/** Detect iPad/tablet using platform + screen width (no native dependency required). */
export function isTabletWidth(width: number) {
  return width >= TABLET_BREAKPOINT;
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isTablet = isTabletWidth(width);
    const isIPad = isTablet && Platform.OS === "ios";
    const isWideTablet = width >= WIDE_TABLET_BREAKPOINT;
    const isLandscape = width >= height;

    const columns: 1 | 2 | 3 = !isTablet ? 1 : isWideTablet ? 3 : 2;

    return {
      width,
      height,
      isTablet,
      isIPad,
      isWideTablet,
      isLandscape,
      isPortrait: !isLandscape,
      columns,
      contentPadding: isTablet ? 24 : 16,
      gutter: isTablet ? 16 : 12,
      // On iPad use the full width (minus padding); cap only on extremely wide screens.
      maxContentWidth: isTablet ? Math.min(width, 1366) : width,
    };
  }, [width, height]);
}
