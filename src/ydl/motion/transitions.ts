import { ydlDuration, ydlEasingName, type YdlDurationToken, type YdlSpringToken } from "./tokens";

export type YdlTransitionKind =
  | "push"
  | "modal"
  | "sheet"
  | "hero"
  | "fade"
  | "scale"
  | "blur"
  | "shared";

export type YdlTransitionPreset = {
  kind: YdlTransitionKind;
  durationKey: YdlDurationToken;
  durationMs: number;
  springKey: YdlSpringToken;
  easing: keyof typeof ydlEasingName;
  entering: { opacity?: number; scale?: number; translateY?: number; translateX?: number; blur?: number };
  active: { opacity?: number; scale?: number; translateY?: number; translateX?: number; blur?: number };
  exiting: { opacity?: number; scale?: number; translateY?: number; translateX?: number; blur?: number };
  useNativeDriver: boolean;
  notes?: string;
};

function transition(
  kind: YdlTransitionKind,
  durationKey: YdlDurationToken,
  springKey: YdlSpringToken,
  easing: keyof typeof ydlEasingName,
  entering: YdlTransitionPreset["entering"],
  active: YdlTransitionPreset["active"],
  exiting: YdlTransitionPreset["exiting"],
  useNativeDriver: boolean,
  notes?: string,
): YdlTransitionPreset {
  return {
    kind,
    durationKey,
    durationMs: ydlDuration[durationKey],
    springKey,
    easing,
    entering,
    active,
    exiting,
    useNativeDriver,
    notes,
  };
}

/** Requestable screen transitions — implement later; consume via getYdlTransition(). */
export const ydlTransitions = {
  push: transition(
    "push",
    "Normal",
    "Normal",
    "standard",
    { opacity: 0, translateX: 24 },
    { opacity: 1, translateX: 0 },
    { opacity: 0, translateX: -12 },
    true,
  ),
  modal: transition(
    "modal",
    "Modal",
    "Modal",
    "decelerate",
    { opacity: 0, scale: 0.96, translateY: 20 },
    { opacity: 1, scale: 1, translateY: 0 },
    { opacity: 0, scale: 0.98, translateY: 12 },
    true,
  ),
  sheet: transition(
    "sheet",
    "Modal",
    "Modal",
    "decelerate",
    { opacity: 0, translateY: 40 },
    { opacity: 1, translateY: 0 },
    { opacity: 0, translateY: 40 },
    true,
  ),
  hero: transition(
    "hero",
    "Hero",
    "Hero",
    "softOut",
    { opacity: 0, scale: 0.92, translateY: 24 },
    { opacity: 1, scale: 1, translateY: 0 },
    { opacity: 0, scale: 1.02 },
    true,
  ),
  fade: transition(
    "fade",
    "Normal",
    "Normal",
    "standard",
    { opacity: 0 },
    { opacity: 1 },
    { opacity: 0 },
    true,
  ),
  scale: transition(
    "scale",
    "Card",
    "Card",
    "softOut",
    { opacity: 0, scale: 0.9 },
    { opacity: 1, scale: 1 },
    { opacity: 0, scale: 0.96 },
    true,
  ),
  blur: transition(
    "blur",
    "Modal",
    "Glass",
    "softOut",
    { opacity: 0, blur: 12 },
    { opacity: 1, blur: 0 },
    { opacity: 0, blur: 8 },
    false,
    "blur often requires non-native driver / BlurView opacity pair",
  ),
  shared: transition(
    "shared",
    "Hero",
    "Hero",
    "emphasized",
    { opacity: 0.85, scale: 0.98 },
    { opacity: 1, scale: 1 },
    { opacity: 0.9, scale: 0.99 },
    true,
    "shared-element placeholder; pair with measured layouts later",
  ),
} as const;

export function getYdlTransition(kind: YdlTransitionKind): YdlTransitionPreset {
  return ydlTransitions[kind];
}
