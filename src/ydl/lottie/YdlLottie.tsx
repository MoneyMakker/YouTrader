import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import LottieView from "lottie-react-native";
import { getYdlReduceMotionCached, subscribeYdlReduceMotion } from "../motion/accessibility";
import { YDL_LOTTIE_REDUCE_MOTION_PROGRESS } from "./lottie.constants";
import type { YdlLottieProps } from "./lottie.types";

/**
 * Canonical Lottie adapter. All direct lottie-react-native usage stays here.
 * Remote URLs are intentionally unsupported — pass require() or a local AnimationObject.
 */
export function YdlLottie({
  source,
  width,
  height,
  playback,
  accessibilityLabel,
  onComplete,
  reduceMotionOverride,
}: YdlLottieProps) {
  const [reduceMotion, setReduceMotion] = useState(
    reduceMotionOverride ?? getYdlReduceMotionCached(),
  );

  useEffect(() => {
    if (reduceMotionOverride !== undefined) {
      setReduceMotion(reduceMotionOverride);
      return;
    }
    return subscribeYdlReduceMotion(setReduceMotion);
  }, [reduceMotionOverride]);

  const resolved = useMemo(() => {
    if (reduceMotion) {
      if (playback.mode === "controlled") {
        return { autoPlay: false, loop: false, progress: playback.progress };
      }
      if (playback.mode === "static") {
        return {
          autoPlay: false,
          loop: false,
          progress: playback.progress ?? YDL_LOTTIE_REDUCE_MOTION_PROGRESS,
        };
      }
      // once / loop → static first frame
      return {
        autoPlay: false,
        loop: false,
        progress: YDL_LOTTIE_REDUCE_MOTION_PROGRESS,
      };
    }

    switch (playback.mode) {
      case "static":
        return {
          autoPlay: false,
          loop: false,
          progress: playback.progress ?? YDL_LOTTIE_REDUCE_MOTION_PROGRESS,
          speed: 1,
        };
      case "once":
        return { autoPlay: true, loop: false, speed: playback.speed ?? 1 };
      case "loop":
        return { autoPlay: true, loop: true, speed: playback.speed ?? 1 };
      case "controlled":
        return { autoPlay: false, loop: false, progress: playback.progress, speed: 1 };
      default: {
        const _exhaustive: never = playback;
        return _exhaustive;
      }
    }
  }, [playback, reduceMotion]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width, height }}
    >
      <LottieView
        // Metro `require()` is a number at runtime; Lottie typings expect AnimationObject | uri.
        source={source as React.ComponentProps<typeof LottieView>["source"]}
        style={{ width, height }}
        autoPlay={resolved.autoPlay}
        loop={resolved.loop}
        speed={"speed" in resolved ? resolved.speed : 1}
        progress={"progress" in resolved ? resolved.progress : undefined}
        onAnimationFinish={(isCancelled) => {
          if (!isCancelled) onComplete?.();
        }}
        resizeMode="contain"
      />
    </View>
  );
}
