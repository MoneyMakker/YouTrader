import type { ColorValue, StyleProp, ViewStyle } from "react-native";
import type { SFSymbol, SymbolType, SymbolWeight } from "expo-symbols";

/**
 * Semantic YouTrader icon names. Prefer these over raw SF Symbol strings.
 * Keep this list small and concept-driven — do not add speculative aliases.
 */
export type YdlSemanticSymbol =
  | "back"
  | "close"
  | "add"
  | "edit"
  | "delete"
  | "search"
  | "settings"
  | "calendar"
  | "chart"
  | "journal"
  | "trade"
  | "profit"
  | "loss"
  | "warning"
  | "success"
  | "lock"
  | "unlock"
  | "share"
  | "info"
  | "notification"
  | "chevronRight";

export type YdlSymbolSize = "sm" | "md" | "lg" | "xl" | number;

export type YdlSymbolWeight = Exclude<SymbolWeight, "unspecified"> | "unspecified";

/** Rendering style where supported (iOS SF Symbols). */
export type YdlSymbolRenderType = Extract<SymbolType, "monochrome" | "hierarchical">;

export type YdlSymbolDefinition = {
  /** iOS SF Symbol name. */
  ios: SFSymbol;
  /**
   * Default accessibility label when the symbol is meaningful and the caller
   * does not supply accessibilityLabel. Decorative mode ignores this.
   */
  defaultLabel: string;
};

export type YdlSymbolProps = {
  name: YdlSemanticSymbol;
  size?: YdlSymbolSize;
  weight?: YdlSymbolWeight;
  type?: YdlSymbolRenderType;
  tintColor?: ColorValue;
  /**
   * When true, hides from screen readers (no label, importantForAccessibility=no).
   * Use for icons next to already-descriptive visible text.
   */
  decorative?: boolean;
  /** Required for meaningful (non-decorative) icons without adjacent text. */
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * INTERNAL / ADVANCED escape hatch.
 * Exists only for rare migration or Storybook validation of a specific SF name
 * that is not yet mapped. Production UI must use `YdlSymbol` + semantic names.
 * Do not import this from feature screens.
 */
export type YdlSymbolUnsafeProps = Omit<YdlSymbolProps, "name"> & {
  /** @internal raw SF Symbol — prefer semantic `name` on YdlSymbol */
  unsafeSfName: SFSymbol;
};
