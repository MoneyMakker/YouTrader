import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { YdlSymbol, type YdlSemanticSymbol } from "../symbols";
import { useYdlTheme, type YdlAppearance } from "../tokens";
import { YdlText } from "./YdlText";
import { YdlButton } from "./YdlButton";
import { YdlIconButton } from "./YdlIconButton";

export type YdlBannerTone = "info" | "success" | "warning" | "error";

export type YdlBannerProps = {
  title: string;
  body?: string;
  tone?: YdlBannerTone;
  symbol?: YdlSemanticSymbol;
  actionLabel?: string;
  onAction?: () => void;
  /** Required when dismissible. */
  dismissAccessibilityLabel?: string;
  onDismiss?: () => void;
  appearance?: YdlAppearance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const TONE_SYMBOL: Record<YdlBannerTone, YdlSemanticSymbol> = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "warning",
};

export function YdlBanner({
  title,
  body,
  tone = "info",
  symbol,
  actionLabel,
  onAction,
  dismissAccessibilityLabel,
  onDismiss,
  appearance,
  style,
  testID,
}: YdlBannerProps) {
  const theme = useYdlTheme(appearance);
  const status = theme.colors.status;
  const palette = {
    info: { fg: status.info, bg: status.infoSoft },
    success: { fg: status.positive, bg: status.positiveSoft },
    warning: { fg: status.warning, bg: status.warningSoft },
    error: { fg: status.negative, bg: status.negativeSoft },
  }[tone];

  if (onDismiss && !dismissAccessibilityLabel?.trim()) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[YdlBanner] onDismiss requires dismissAccessibilityLabel");
    }
  }

  const a11y = `${tone}. ${title}${body ? `. ${body}` : ""}`;

  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={a11y}
      style={[
        styles.banner,
        {
          backgroundColor: palette.bg,
          borderColor: palette.fg,
          borderRadius: theme.radius.large,
          padding: theme.space[12],
          gap: theme.space[8],
        },
        style,
      ]}
    >
      <View style={styles.topRow}>
        <YdlSymbol
          name={symbol ?? TONE_SYMBOL[tone]}
          size="md"
          tintColor={palette.fg}
          decorative
        />
        <View style={styles.textCol}>
          <YdlText role="labelEmphasized" appearance={appearance} style={{ color: palette.fg }}>
            {title}
          </YdlText>
          {body ? (
            <YdlText role="callout" color="text.secondary" appearance={appearance}>
              {body}
            </YdlText>
          ) : null}
        </View>
        {onDismiss ? (
          <YdlIconButton
            symbol="close"
            accessibilityLabel={dismissAccessibilityLabel || "Dismiss"}
            onPress={onDismiss}
            tintColor={theme.colors.icon.secondary}
            haptic="selection"
          />
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <YdlButton
          label={actionLabel}
          onPress={onAction}
          variant="tertiary"
          size="small"
          appearance={appearance}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
});
