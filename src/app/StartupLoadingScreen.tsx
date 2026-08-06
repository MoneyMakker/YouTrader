import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const GREEN = "#A3FF12";

type Props = {
  status?: string;
  error?: boolean;
  onRetry?: () => void;
  onSignOut?: () => void;
};

export function StartupLoadingScreen({ status, error = false, onRetry, onSignOut }: Props) {
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const draw = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      draw.setValue(1);
      reveal.setValue(1);
      breathe.setValue(0);
      progress.setValue(0.42);
      return;
    }
    Animated.parallel([
      Animated.timing(draw, { toValue: 1, duration: 820, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(reveal, { toValue: 1, duration: 360, delay: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    breathing.start();
    const line = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 0.72, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(progress, { toValue: 0.38, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    line.start();
    return () => { breathing.stop(); line.stop(); };
  }, [reduceMotion]);

  const haloScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const haloOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.16] });
  const drawOffset = draw.interpolate({ inputRange: [0, 1], outputRange: [180, 0] });
  const wordOpacity = reveal;
  const lineWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [18, 142] });

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]} accessibilityRole="progressbar" accessibilityLabel={t("startup.voiceOver")}>
      <View style={styles.center}>
        <Animated.View pointerEvents="none" style={[styles.halo, { transform: [{ scale: haloScale }], opacity: haloOpacity }]} />
        <Svg width={76} height={76} viewBox="0 0 76 76" pointerEvents="none">
          <AnimatedPath
            d="M14 15 L38 61 L62 15 M26 39 L50 39"
            fill="none"
            stroke={GREEN}
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="180"
            strokeDashoffset={drawOffset}
          />
          <Path d="M48 30 L58 20" stroke="rgba(255,255,255,0.7)" strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
        </Svg>
        <Animated.Text style={[styles.wordmark, { opacity: wordOpacity }]}>{t("startup.wordmark")}</Animated.Text>
        <Animated.View style={[styles.progressTrack, { opacity: wordOpacity }]}>
          <Animated.View style={[styles.progressFill, { width: lineWidth }]} />
        </Animated.View>
        <Animated.Text style={[styles.status, { opacity: wordOpacity }]}>{error ? t("startup.failureBody") : (status || t("startup.preparingWorkspace"))}</Animated.Text>
        {error ? (
          <View style={styles.actions}>
            {onRetry ? <Pressable onPress={onRetry} accessibilityRole="button" style={styles.primary}><Text style={styles.primaryText}>{t("startup.tryAgain")}</Text></Pressable> : null}
            {onSignOut ? <Pressable onPress={onSignOut} accessibilityRole="button" style={styles.secondary}><Text style={styles.secondaryText}>{t("startup.signInAgain")}</Text></Pressable> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#030506", alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center", width: "100%", paddingHorizontal: 24, transform: [{ translateY: -18 }] },
  halo: { position: "absolute", width: 136, height: 136, borderRadius: 68, backgroundColor: "rgba(163,255,18,0.16)" },
  wordmark: { color: "#F7F8F8", fontSize: 29, lineHeight: 34, fontWeight: "700", letterSpacing: -0.5, marginTop: 16 },
  progressTrack: { height: 2, width: 148, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 2, overflow: "hidden", marginTop: 22 },
  progressFill: { height: 2, backgroundColor: GREEN, borderRadius: 2 },
  status: { color: "rgba(220,224,225,0.58)", fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 13, textAlign: "center" },
  actions: { width: "100%", maxWidth: 280, alignItems: "center", marginTop: 24, gap: 10 },
  primary: { minHeight: 46, width: "100%", borderRadius: 14, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#05070A", fontSize: 15, fontWeight: "800" },
  secondary: { minHeight: 40, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "rgba(220,224,225,0.62)", fontSize: 14, fontWeight: "700" },
});
