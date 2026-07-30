import type { ChallengeStatus } from "./types";

const ACTIVE_LIKE = new Set<ChallengeStatus>(["active", "at_risk"]);

/**
 * Allowed challenge transitions (Phase 0/1B aligned).
 * Reset/breach create new attempts via createChallengeAttempt — do not revive breached.
 */
export function canTransitionChallenge(
  from: ChallengeStatus,
  to: ChallengeStatus,
): boolean {
  if (from === to) return false;
  if (from === "reset" || from === "abandoned") return false;
  if (from === "breached") return to === "abandoned";
  if (from === "passed") return to === "funded" || to === "abandoned";
  if (from === "funded") return to === "abandoned";

  if (ACTIVE_LIKE.has(from)) {
    return (
      to === "at_risk" ||
      to === "active" ||
      to === "breached" ||
      to === "passed" ||
      to === "funded" ||
      to === "reset" ||
      to === "abandoned"
    );
  }
  return false;
}

export function isActiveChallengeStatus(status: ChallengeStatus): boolean {
  return ACTIVE_LIKE.has(status);
}
