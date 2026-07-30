/**
 * Gesture helper configs — thresholds only.
 * Pair with PanResponder / Gesture Handler in later phases (no dependency added here).
 */

export const ydlGesture = {
  swipeDelete: {
    direction: "horizontal" as const,
    activationDistance: 24,
    completeDistance: 96,
    velocityThreshold: 0.35,
    rubberBand: true,
  },
  pullToRefresh: {
    direction: "vertical" as const,
    activationDistance: 64,
    maxPull: 120,
    snapDurationMs: 220,
  },
  sheetDismiss: {
    direction: "vertical" as const,
    activationDistance: 12,
    dismissDistance: 120,
    velocityThreshold: 0.45,
  },
  cardDrag: {
    direction: "both" as const,
    activationDistance: 8,
    maxOffset: 16,
  },
  longPress: {
    minDurationMs: 420,
    maxMove: 10,
  },
  pinchChart: {
    minScale: 0.85,
    maxScale: 2.5,
    focalLock: true,
  },
} as const;

export type YdlGestureToken = keyof typeof ydlGesture;

export function getYdlGesture(token: YdlGestureToken) {
  return ydlGesture[token];
}
