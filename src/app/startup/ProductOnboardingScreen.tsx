import React from "react";
import { StyleSheet, View } from "react-native";
import { YdlButton, YdlText } from "../../ydl/components";
import { ydlColor } from "../../ydl/color";
import { ydlSpace } from "../../ydl/space";

type Props = {
  title: string;
  body: string;
  cta: string;
  onContinue: () => void;
};

/**
 * First-launch product onboarding — dark terminal, readable contrast.
 * Not a Prop Pass onboarding substitute.
 */
export function ProductOnboardingScreen({ title, body, cta, onContinue }: Props) {
  return (
    <View style={styles.root} testID="product-onboarding-screen">
      <View style={styles.copy}>
        <YdlText role="titleLarge" appearance="dark" align="center">
          {title}
        </YdlText>
        <YdlText role="body" color="text.secondary" appearance="dark" align="center">
          {body}
        </YdlText>
      </View>
      <YdlButton
        label={cta}
        onPress={onContinue}
        appearance="dark"
        testID="product-onboarding-continue"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ydlColor.BackgroundPrimary,
    justifyContent: "space-between",
    paddingHorizontal: ydlSpace.lg,
    paddingTop: ydlSpace.xxl,
    paddingBottom: ydlSpace.xl,
  },
  copy: {
    flex: 1,
    justifyContent: "center",
    gap: ydlSpace.md,
  },
});
