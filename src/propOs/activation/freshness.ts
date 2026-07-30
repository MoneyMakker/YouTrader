import type { SnapshotFreshnessInput, SnapshotFreshnessResult } from "./types";

/**
 * Snapshot freshness: version/revision mismatches always stale.
 * Time alone never proves freshness; maxAge is only a secondary rejector.
 */
export function evaluateSnapshotFreshness(input: SnapshotFreshnessInput): SnapshotFreshnessResult {
  const reasons: string[] = [];

  if (!input.allowedCalculationVersions.includes(input.calculationVersion)) {
    reasons.push("unsupported_calculation_version");
  }
  if (!input.allowedConfidencePolicyVersions.includes(input.confidencePolicyVersion)) {
    reasons.push("unsupported_confidence_policy_version");
  }
  if (
    input.currentInputRevision != null &&
    input.snapshotInputRevision !== input.currentInputRevision
  ) {
    reasons.push("input_revision_mismatch");
  }
  if (
    input.currentRuleSetVersion != null &&
    input.ruleSetVersion !== input.currentRuleSetVersion
  ) {
    reasons.push("rule_set_version_mismatch");
  }

  if (input.maxAgeMs != null) {
    const calculated = Date.parse(input.calculatedAt);
    const now = Date.parse(input.nowUtc);
    if (!Number.isFinite(calculated) || !Number.isFinite(now)) {
      reasons.push("invalid_timestamp");
    } else if (now - calculated > input.maxAgeMs) {
      reasons.push("max_age_exceeded");
    }
  }

  return { fresh: reasons.length === 0, reasons };
}
