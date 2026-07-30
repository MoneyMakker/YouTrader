import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { YdlLottie } from "../../src/ydl/lottie";

// Storybook-only demo asset — must not be imported from production code.
const demoSource = require("../assets/ydl-pulse-demo.json");

type Variant = "once" | "loop" | "controlled" | "reduceMotion";

export function Phase2LottieDemo({ variant }: { variant: Variant }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (variant !== "controlled") return;
    const id = setInterval(() => {
      setProgress((p) => (p >= 1 ? 0 : Number((p + 0.05).toFixed(2))));
    }, 120);
    return () => clearInterval(id);
  }, [variant]);

  if (variant === "once") {
    return (
      <View style={styles.wrap} testID="lottie-once">
        <Text style={styles.title}>Autoplay once</Text>
        <YdlLottie
          source={demoSource}
          width={120}
          height={120}
          playback={{ mode: "once" }}
          accessibilityLabel="Pulse animation plays once"
        />
      </View>
    );
  }

  if (variant === "loop") {
    return (
      <View style={styles.wrap} testID="lottie-loop">
        <Text style={styles.title}>Looping</Text>
        <YdlLottie
          source={demoSource}
          width={120}
          height={120}
          playback={{ mode: "loop", speed: 1.1 }}
          accessibilityLabel="Pulse animation looping"
        />
      </View>
    );
  }

  if (variant === "controlled") {
    return (
      <View style={styles.wrap} testID="lottie-controlled">
        <Text style={styles.title}>Controlled progress {progress.toFixed(2)}</Text>
        <YdlLottie
          source={demoSource}
          width={120}
          height={120}
          playback={{ mode: "controlled", progress }}
          accessibilityLabel="Pulse animation controlled progress"
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setProgress(0)}
          style={styles.btn}
        >
          <Text style={styles.btnLabel}>Reset</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="lottie-reduce-motion">
      <Text style={styles.title}>Reduce Motion → static frame</Text>
      <YdlLottie
        source={demoSource}
        width={120}
        height={120}
        playback={{ mode: "loop" }}
        reduceMotionOverride
        accessibilityLabel="Pulse animation static under reduce motion"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#05070B",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  title: { color: "#F4F7FB", fontSize: 18, fontWeight: "700" },
  btn: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3447",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnLabel: { color: "#7CFFB2", fontWeight: "600" },
});
