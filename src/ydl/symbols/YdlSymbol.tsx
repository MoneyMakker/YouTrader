import React, { useMemo } from "react";
import { Platform, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { asSfSymbol, resolveYdlSymbol, resolveYdlSymbolSize } from "./symbol.map";
import { AndroidSymbolFallback } from "./AndroidSymbolFallback";
import type { YdlSymbolProps, YdlSymbolUnsafeProps } from "./symbol.types";

const DISABLED_OPACITY = 0.38;

/**
 * Canonical YouTrader symbol. Consumers pass semantic names only.
 * Direct `expo-symbols` imports stay in this directory.
 */
export function YdlSymbol({
  name,
  size = "md",
  weight = "regular",
  type = "monochrome",
  tintColor,
  decorative = false,
  accessibilityLabel,
  disabled = false,
  style,
  testID,
}: YdlSymbolProps) {
  const resolved = resolveYdlSymbol(name);
  const px = resolveYdlSymbolSize(size);
  const label = decorative
    ? undefined
    : accessibilityLabel ?? resolved.definition.defaultLabel;

  const a11yProps = decorative
    ? ({
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants" as const,
      } as const)
    : ({
        accessible: true,
        accessibilityRole: "image" as const,
        accessibilityLabel: label,
      } as const);

  const fallback = useMemo(
    () => (
      <AndroidSymbolFallback
        semantic={resolved.semantic}
        size={px}
        tintColor={tintColor}
      />
    ),
    [px, resolved.semantic, tintColor],
  );

  return (
    <View
      testID={testID}
      style={[{ opacity: disabled ? DISABLED_OPACITY : 1 }, style]}
      {...a11yProps}
    >
      {Platform.OS === "ios" ? (
        <SymbolView
          name={resolved.definition.ios}
          size={px}
          weight={weight === "unspecified" ? "regular" : weight}
          type={type}
          tintColor={tintColor}
          fallback={fallback}
          accessible={false}
          importantForAccessibility="no"
        />
      ) : (
        fallback
      )}
    </View>
  );
}

/**
 * @internal Advanced escape hatch for unmapped SF names (migration / Storybook).
 * Prefer `YdlSymbol` with a semantic name. Do not use from production feature screens.
 */
export function YdlSymbolUnsafe({
  unsafeSfName,
  size = "md",
  weight = "regular",
  type = "monochrome",
  tintColor,
  decorative = false,
  accessibilityLabel,
  disabled = false,
  style,
  testID,
}: YdlSymbolUnsafeProps) {
  const px = resolveYdlSymbolSize(size);
  const label = decorative ? undefined : accessibilityLabel ?? unsafeSfName;
  const a11yProps = decorative
    ? ({
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants" as const,
      } as const)
    : ({
        accessible: true,
        accessibilityRole: "image" as const,
        accessibilityLabel: label,
      } as const);

  const fallback = (
    <AndroidSymbolFallback semantic="info" size={px} tintColor={tintColor} />
  );

  return (
    <View
      testID={testID}
      style={[{ opacity: disabled ? DISABLED_OPACITY : 1 }, style]}
      {...a11yProps}
    >
      {Platform.OS === "ios" ? (
        <SymbolView
          name={asSfSymbol(unsafeSfName)}
          size={px}
          weight={weight === "unspecified" ? "regular" : weight}
          type={type}
          tintColor={tintColor}
          fallback={fallback}
          accessible={false}
          importantForAccessibility="no"
        />
      ) : (
        fallback
      )}
    </View>
  );
}
