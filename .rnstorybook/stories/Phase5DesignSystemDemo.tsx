import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  YdlBadge,
  YdlBanner,
  YdlButton,
  YdlCard,
  YdlChip,
  YdlEmptyState,
  YdlListItem,
  YdlSkeleton,
  YdlSkeletonCard,
  YdlText,
} from "../../src/ydl/components";
import type { YdlAppearance } from "../../src/ydl/tokens";
import type { YdlTypographyRole } from "../../src/ydl/tokens";

const ROLES: YdlTypographyRole[] = [
  "display",
  "titleLarge",
  "title",
  "heading",
  "body",
  "bodyEmphasized",
  "callout",
  "label",
  "labelEmphasized",
  "caption",
  "numericLarge",
  "numeric",
  "numericCompact",
];

function Screen({
  appearance,
  children,
  title,
}: {
  appearance: YdlAppearance;
  children: React.ReactNode;
  title: string;
}) {
  const bg = appearance === "light" ? "#F7F8FA" : "#05070A";
  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.pad}>
      <YdlText role="heading" appearance={appearance}>
        {title}
      </YdlText>
      {children}
    </ScrollView>
  );
}

export function Phase5TextDemo({
  variant,
}: {
  variant: "roles" | "long" | "largeText" | "numeric" | "light" | "dark";
}) {
  const appearance: YdlAppearance = variant === "light" ? "light" : "dark";
  return (
    <Screen appearance={appearance} title={`YdlText / ${variant}`}>
      {variant === "numeric" ? (
        <YdlText role="numericLarge" tabular appearance={appearance}>
          1,284.50
        </YdlText>
      ) : variant === "long" ? (
        <YdlText role="body" appearance={appearance}>
          Long localized explanation that must remain readable without clipping when Dynamic Type
          grows and when the copy wraps across several lines in a premium trading journal.
        </YdlText>
      ) : (
        ROLES.map((role) => (
          <YdlText key={role} role={role} appearance={appearance}>
            {role}
            {variant === "largeText" ? " · large" : ""}
          </YdlText>
        ))
      )}
    </Screen>
  );
}

export function Phase5ButtonDemo({
  variant,
}: {
  variant:
    | "variants"
    | "sizes"
    | "loading"
    | "disabled"
    | "iconLeading"
    | "fullWidth"
    | "long"
    | "largeText"
    | "light"
    | "dark";
}) {
  const appearance: YdlAppearance = variant === "light" ? "light" : "dark";
  const [n, setN] = useState(0);
  return (
    <Screen appearance={appearance} title={`YdlButton / ${variant}`}>
      <YdlText role="caption" appearance={appearance}>
        presses: {n}
      </YdlText>
      {variant === "sizes" ? (
        (["small", "medium", "large"] as const).map((size) => (
          <YdlButton key={size} size={size} label={size} onPress={() => setN((x) => x + 1)} appearance={appearance} />
        ))
      ) : variant === "loading" ? (
        <YdlButton label="Saving" loading onPress={() => setN((x) => x + 1)} appearance={appearance} />
      ) : variant === "disabled" ? (
        <YdlButton label="Disabled" disabled onPress={() => setN((x) => x + 1)} appearance={appearance} />
      ) : variant === "iconLeading" ? (
        <YdlButton label="Add trade" leadingSymbol="add" onPress={() => setN((x) => x + 1)} appearance={appearance} />
      ) : variant === "fullWidth" ? (
        <YdlButton label="Continue" fullWidth onPress={() => setN((x) => x + 1)} appearance={appearance} />
      ) : variant === "long" || variant === "largeText" ? (
        <YdlButton
          label="Very long localized primary action label that should wrap safely"
          onPress={() => setN((x) => x + 1)}
          appearance={appearance}
        />
      ) : (
        (["primary", "secondary", "tertiary", "destructive"] as const).map((v) => (
          <YdlButton key={v} variant={v} label={v} onPress={() => setN((x) => x + 1)} appearance={appearance} />
        ))
      )}
    </Screen>
  );
}

export function Phase5CardDemo({
  variant,
}: {
  variant: "default" | "outlined" | "elevated" | "interactive" | "selected" | "long" | "light" | "dark";
}) {
  const appearance: YdlAppearance = variant === "light" ? "light" : "dark";
  const map = {
    default: "default",
    outlined: "outlined",
    elevated: "elevated",
    interactive: "interactive",
    selected: "selected",
    long: "default",
    light: "default",
    dark: "default",
  } as const;
  return (
    <Screen appearance={appearance} title={`YdlCard / ${variant}`}>
      <YdlCard
        variant={map[variant]}
        appearance={appearance}
        onPress={variant === "interactive" ? () => undefined : undefined}
        accessibilityLabel="Demo card"
      >
        <YdlText role="heading" appearance={appearance}>
          Card title
        </YdlText>
        <YdlText role="body" color="text.secondary" appearance={appearance}>
          {variant === "long"
            ? "Long content body that expands without a fixed card height so Dynamic Type and localization remain readable."
            : "Restrained card content."}
        </YdlText>
      </YdlCard>
    </Screen>
  );
}

export function Phase5BadgeDemo({
  variant,
}: {
  variant: "tones" | "withSymbol" | "long" | "largeText";
}) {
  return (
    <Screen appearance="dark" title={`YdlBadge / ${variant}`}>
      {(["neutral", "positive", "negative", "warning", "info"] as const).map((tone) => (
        <YdlBadge
          key={tone}
          tone={tone}
          label={variant === "long" || variant === "largeText" ? `${tone} long status label` : tone}
          symbol={variant === "withSymbol" ? "chart" : undefined}
        />
      ))}
    </Screen>
  );
}

export function Phase5ChipDemo({
  variant,
}: {
  variant: "default" | "selected" | "disabled" | "withSymbol" | "long" | "light" | "dark";
}) {
  const appearance: YdlAppearance = variant === "light" ? "light" : "dark";
  return (
    <Screen appearance={appearance} title={`YdlChip / ${variant}`}>
      <YdlChip
        label={variant === "long" ? "Very long chip label for localization" : "Chip"}
        selected={variant === "selected"}
        disabled={variant === "disabled"}
        leadingSymbol={variant === "withSymbol" ? "search" : undefined}
        onPress={() => undefined}
        appearance={appearance}
      />
    </Screen>
  );
}

export function Phase5ListItemDemo({
  variant,
}: {
  variant:
    | "title"
    | "subtitle"
    | "trailing"
    | "selected"
    | "disabled"
    | "destructive"
    | "long"
    | "largeText";
}) {
  return (
    <Screen appearance="dark" title={`YdlListItem / ${variant}`}>
      <YdlListItem
        title={variant === "long" || variant === "largeText" ? "Very long localized settings title" : "Title"}
        subtitle={
          variant === "title"
            ? undefined
            : variant === "long"
              ? "Long subtitle that wraps across lines without a fixed row height."
              : "Subtitle"
        }
        trailingValue={variant === "trailing" ? "55%" : undefined}
        selected={variant === "selected"}
        disabled={variant === "disabled"}
        destructive={variant === "destructive"}
        onPress={variant === "disabled" ? undefined : () => undefined}
      />
    </Screen>
  );
}

export function Phase5EmptyDemo({
  variant,
}: {
  variant: "none" | "one" | "two" | "long" | "largeText" | "dark";
}) {
  return (
    <Screen appearance="dark" title={`YdlEmptyState / ${variant}`}>
      <YdlEmptyState
        title="No trades yet"
        description={
          variant === "long" || variant === "largeText"
            ? "Long empty-state description explaining what to do next without crowding the layout."
            : "Log your first trade to start the improvement loop."
        }
        primaryActionLabel={variant === "none" ? undefined : "Add trade"}
        onPrimaryAction={variant === "none" ? undefined : () => undefined}
        secondaryActionLabel={variant === "two" ? "Learn more" : undefined}
        onSecondaryAction={variant === "two" ? () => undefined : undefined}
      />
    </Screen>
  );
}

export function Phase5SkeletonDemo({
  variant,
}: {
  variant: "static" | "animated" | "text" | "circle" | "card";
}) {
  const animated = variant === "animated";
  return (
    <Screen appearance="dark" title={`YdlSkeleton / ${variant}`}>
      {variant === "card" ? (
        <YdlSkeletonCard animated={animated} />
      ) : (
        <View style={{ gap: 10 }}>
          <YdlSkeleton shape={variant === "circle" ? "circle" : variant === "text" ? "text" : "rectangle"} animated={animated} />
          {variant === "static" ? <YdlText role="caption">Reduce Motion → static</YdlText> : null}
        </View>
      )}
    </Screen>
  );
}

export function Phase5BannerDemo({
  variant,
}: {
  variant: "tones" | "action" | "dismiss" | "long" | "largeText" | "dark";
}) {
  return (
    <Screen appearance="dark" title={`YdlBanner / ${variant}`}>
      {(["info", "success", "warning", "error"] as const).map((tone) => (
        <YdlBanner
          key={tone}
          tone={tone}
          title={`${tone} title`}
          body={
            variant === "long" || variant === "largeText"
              ? "Long banner body that must remain readable with action and dismiss controls."
              : "Short body"
          }
          actionLabel={variant === "action" ? "Review" : undefined}
          onAction={variant === "action" ? () => undefined : undefined}
          onDismiss={variant === "dismiss" ? () => undefined : undefined}
          dismissAccessibilityLabel={variant === "dismiss" ? "Dismiss banner" : undefined}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 12 },
});
