import type { AnimationObject } from "lottie-react-native";

/**
 * Semantic playback modes for YDL Lottie.
 * Reduce Motion overrides continuous modes to a static frame.
 */
export type YdlLottiePlayback =
  | { mode: "static"; progress?: number }
  | { mode: "once"; speed?: number }
  | { mode: "loop"; speed?: number }
  | { mode: "controlled"; progress: number };

export type YdlLottieProps = {
  /** Local AnimationObject or Metro `require(...)` module id. No remote URLs. */
  source: AnimationObject | number;
  width: number;
  height: number;
  playback: YdlLottiePlayback;
  accessibilityLabel: string;
  onComplete?: () => void;
  /** Test / story override for Reduce Motion. */
  reduceMotionOverride?: boolean;
};
