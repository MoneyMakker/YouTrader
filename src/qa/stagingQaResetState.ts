/**
 * Staging QA reset state machine — pure / Node-testable.
 * Production builds must never import the UI overlay that exposes these IDs.
 */

export type StagingQaResetPhase =
  | "idle"
  | "reset_requested"
  | "clearing_app_storage"
  | "clearing_auth_session"
  | "clearing_oauth_state"
  | "clearing_user_cache"
  | "applying_target_mode"
  | "persisted"
  | "reset_complete"
  | "reset_failed";

export const STAGING_QA_RESET_A11Y = {
  inProgress: "qa.reset.in-progress",
  complete: "qa.reset.complete",
  failed: "qa.reset.failed",
  mode: "qa.reset.mode",
  phase: "qa.reset.phase",
} as const;

export const STAGING_QA_RESET_STATUS_KEY = "yt-qa-reset-status-v1";

export type StagingQaResetStatusSnapshot = {
  phase: StagingQaResetPhase;
  mode: string | null;
  error: string | null;
  updatedAt: number;
};

export function createResetStatus(
  phase: StagingQaResetPhase,
  mode: string | null = null,
  error: string | null = null,
): StagingQaResetStatusSnapshot {
  return { phase, mode, error, updatedAt: Date.now() };
}

export function isResetTerminal(phase: StagingQaResetPhase): boolean {
  return phase === "reset_complete" || phase === "reset_failed";
}

export function a11yIdForResetPhase(phase: StagingQaResetPhase): string | null {
  if (phase === "reset_complete") return STAGING_QA_RESET_A11Y.complete;
  if (phase === "reset_failed") return STAGING_QA_RESET_A11Y.failed;
  if (phase === "idle") return null;
  return STAGING_QA_RESET_A11Y.inProgress;
}

/** Ordered phases for a successful wipe (excluding idle / failed). */
export const STAGING_QA_RESET_SUCCESS_ORDER: StagingQaResetPhase[] = [
  "reset_requested",
  "clearing_oauth_state",
  "clearing_app_storage",
  "clearing_auth_session",
  "clearing_user_cache",
  "applying_target_mode",
  "persisted",
  "reset_complete",
];

export function assertResetPhaseTransition(
  from: StagingQaResetPhase,
  to: StagingQaResetPhase,
): boolean {
  if (to === "reset_failed") return from !== "idle";
  if (from === "idle" && to === "reset_requested") return true;
  const i = STAGING_QA_RESET_SUCCESS_ORDER.indexOf(from);
  const j = STAGING_QA_RESET_SUCCESS_ORDER.indexOf(to);
  if (i < 0 || j < 0) return false;
  return j === i + 1 || (from === to && from === "reset_complete");
}

export function serializeResetStatus(s: StagingQaResetStatusSnapshot): string {
  return JSON.stringify(s);
}

export function parseResetStatus(raw: string | null): StagingQaResetStatusSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StagingQaResetStatusSnapshot;
    if (!parsed || typeof parsed.phase !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
