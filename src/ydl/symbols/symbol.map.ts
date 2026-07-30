import type { SFSymbol } from "expo-symbols";
import type { YdlSemanticSymbol, YdlSymbolDefinition, YdlSymbolSize } from "./symbol.types";

export const YDL_SYMBOL_SIZE_PX: Record<"sm" | "md" | "lg" | "xl", number> = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
};

export function resolveYdlSymbolSize(size: YdlSymbolSize = "md"): number {
  if (typeof size === "number") return size;
  return YDL_SYMBOL_SIZE_PX[size];
}

/**
 * Canonical semantic → SF Symbol map (YouTrader concepts only).
 */
export const YDL_SYMBOL_MAP: Record<YdlSemanticSymbol, YdlSymbolDefinition> = {
  back: { ios: "chevron.left", defaultLabel: "Back" },
  close: { ios: "xmark", defaultLabel: "Close" },
  add: { ios: "plus", defaultLabel: "Add" },
  edit: { ios: "pencil", defaultLabel: "Edit" },
  delete: { ios: "trash", defaultLabel: "Delete" },
  search: { ios: "magnifyingglass", defaultLabel: "Search" },
  settings: { ios: "gearshape", defaultLabel: "Settings" },
  calendar: { ios: "calendar", defaultLabel: "Calendar" },
  chart: { ios: "chart.bar.fill", defaultLabel: "Chart" },
  journal: { ios: "book.fill", defaultLabel: "Journal" },
  trade: { ios: "arrow.left.arrow.right", defaultLabel: "Trade" },
  profit: { ios: "chart.line.uptrend.xyaxis", defaultLabel: "Profit" },
  loss: { ios: "chart.line.downtrend.xyaxis", defaultLabel: "Loss" },
  warning: { ios: "exclamationmark.triangle.fill", defaultLabel: "Warning" },
  success: { ios: "checkmark.circle.fill", defaultLabel: "Success" },
  lock: { ios: "lock.fill", defaultLabel: "Locked" },
  unlock: { ios: "lock.open.fill", defaultLabel: "Unlocked" },
  share: { ios: "square.and.arrow.up", defaultLabel: "Share" },
  info: { ios: "info.circle", defaultLabel: "Information" },
  notification: { ios: "bell.fill", defaultLabel: "Notifications" },
  chevronRight: { ios: "chevron.right", defaultLabel: "More" },
};

const FALLBACK_SEMANTIC: YdlSemanticSymbol = "info";

export function isYdlSemanticSymbol(value: string): value is YdlSemanticSymbol {
  return Object.prototype.hasOwnProperty.call(YDL_SYMBOL_MAP, value);
}

/**
 * Resolve a semantic name safely. Unknown names fall back to `info`
 * (no throw — production must not crash on a mapping miss).
 */
export function resolveYdlSymbol(name: string): {
  semantic: YdlSemanticSymbol;
  definition: YdlSymbolDefinition;
  known: boolean;
} {
  if (isYdlSemanticSymbol(name)) {
    return { semantic: name, definition: YDL_SYMBOL_MAP[name], known: true };
  }
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(`[YdlSymbol] Unknown semantic symbol "${name}"; falling back to "${FALLBACK_SEMANTIC}".`);
  }
  return {
    semantic: FALLBACK_SEMANTIC,
    definition: YDL_SYMBOL_MAP[FALLBACK_SEMANTIC],
    known: false,
  };
}

/** @internal used by advanced escape hatch only */
export function asSfSymbol(name: string): SFSymbol {
  return name as SFSymbol;
}
