/**
 * Storybook / demo-only visual regression gallery.
 * Deterministic fixtures — no auth, network, or business services.
 * Production entry must not import this module.
 *
 * Radar fixture is an inline token-faithful surface (same copy/values as
 * MetricExplanationSheet) so Maestro capture does not depend on modal present().
 */
import React from "react";
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
  YdlText,
} from "../../src/ydl/components";
import type { YdlAppearance } from "../../src/ydl/tokens";
import { resolveYdlTheme } from "../../src/ydl/tokens";

export const PHASE6_METRIC_FIXTURE = {
  label: "Win Rate",
  value: "55%",
  target: "≥ 50%",
  explanation: "Share of winning trades in the selected window.",
} as const;

export type Phase6VisualGalleryProps = {
  appearance?: YdlAppearance;
  /** largeText | reduceMotion | dark | light | default */
  variant?: "default" | "dark" | "light" | "largeText" | "reduceMotion";
};

export function Phase6VisualRegressionGallery({
  appearance: appearanceProp,
  variant = "default",
}: Phase6VisualGalleryProps) {
  const appearance: YdlAppearance =
    appearanceProp ?? (variant === "light" ? "light" : "dark");
  const theme = resolveYdlTheme(appearance);

  return (
    <ScrollView
      testID="ydl-visual-gallery"
      style={{ flex: 1, backgroundColor: theme.colors.background.primary }}
      contentContainerStyle={styles.pad}
    >
      <YdlText role="heading" appearance={appearance} testID="ydl-vr-title">
        YDL Visual Regression
      </YdlText>

      <View testID="ydl-vr-buttons" style={styles.section}>
        <YdlText role="labelEmphasized" appearance={appearance}>
          Buttons
        </YdlText>
        <YdlButton label="Primary" onPress={() => undefined} appearance={appearance} />
        <YdlButton label="Secondary" variant="secondary" onPress={() => undefined} appearance={appearance} />
        <YdlButton label="Delete" variant="destructive" onPress={() => undefined} appearance={appearance} />
        <YdlButton label="Disabled" disabled onPress={() => undefined} appearance={appearance} />
        <YdlButton label="Loading" loading onPress={() => undefined} appearance={appearance} />
      </View>

      <View testID="ydl-vr-cards" style={styles.section}>
        <YdlCard variant="default" appearance={appearance}>
          <YdlText role="heading" appearance={appearance}>
            Default card
          </YdlText>
        </YdlCard>
        <YdlCard
          variant="interactive"
          appearance={appearance}
          accessibilityLabel="Interactive card"
          onPress={() => undefined}
        >
          <YdlText role="body" appearance={appearance}>
            Interactive
          </YdlText>
        </YdlCard>
        <YdlCard variant="selected" appearance={appearance} accessibilityLabel="Selected card">
          <YdlText role="body" appearance={appearance}>
            Selected
          </YdlText>
        </YdlCard>
      </View>

      <View testID="ydl-vr-badges-chips" style={styles.section}>
        <YdlBadge tone="positive" label="positive" appearance={appearance} />
        <YdlBadge tone="negative" label="negative" appearance={appearance} />
        <YdlChip label="Chip" selected onPress={() => undefined} appearance={appearance} />
        <YdlChip label="Static chip" appearance={appearance} />
      </View>

      <View testID="ydl-vr-list" style={styles.section}>
        <YdlListItem title="Normal row" subtitle="Subtitle" onPress={() => undefined} appearance={appearance} />
        <YdlListItem title="Selected" selected onPress={() => undefined} appearance={appearance} />
        <YdlListItem title="Destructive" destructive onPress={() => undefined} appearance={appearance} />
      </View>

      <View testID="ydl-vr-empty" style={styles.section}>
        <YdlEmptyState
          title="No trades yet"
          description="Log your first trade to start the improvement loop."
          primaryActionLabel="Add trade"
          onPrimaryAction={() => undefined}
          appearance={appearance}
        />
      </View>

      <View testID="ydl-vr-skeleton" style={styles.section}>
        <YdlSkeleton shape="text" animated={false} appearance={appearance} />
        <YdlSkeleton shape="rectangle" height={40} animated={false} appearance={appearance} />
      </View>

      <View testID="ydl-vr-banners" style={styles.section}>
        <YdlBanner tone="info" title="Info" body="Body" appearance={appearance} />
        <YdlBanner tone="success" title="Success" body="Body" appearance={appearance} />
        <YdlBanner tone="warning" title="Warning" body="Body" appearance={appearance} />
        <YdlBanner tone="error" title="Error" body="Body" appearance={appearance} />
      </View>

      <View testID="ydl-vr-radar-fixture" style={styles.section}>
        <YdlText role="labelEmphasized" appearance={appearance}>
          Radar fixture (no auth)
        </YdlText>
        <YdlCard
          variant="outlined"
          appearance={appearance}
          accessibilityLabel={`${PHASE6_METRIC_FIXTURE.label} details`}
          testID="metric-explanation-card"
        >
          <YdlText role="labelEmphasized" appearance={appearance} testID="metric-explanation-label">
            {PHASE6_METRIC_FIXTURE.label}
          </YdlText>
          <YdlText
            role="numericLarge"
            appearance={appearance}
            accessibilityLabel={PHASE6_METRIC_FIXTURE.value}
            testID="metric-explanation-value"
            style={{ fontWeight: "900" }}
          >
            {PHASE6_METRIC_FIXTURE.value}
          </YdlText>
          <YdlText
            role="bodyEmphasized"
            color="text.secondary"
            appearance={appearance}
            testID="metric-explanation-body"
          >
            {PHASE6_METRIC_FIXTURE.explanation}
          </YdlText>
          <YdlBadge
            tone="info"
            label={`Target: ${PHASE6_METRIC_FIXTURE.target}`}
            appearance={appearance}
            testID="metric-explanation-target"
          />
        </YdlCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 16, paddingBottom: 48 },
  section: { gap: 10 },
});
