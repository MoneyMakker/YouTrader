import type { PropOsActivationResult } from "../propOs/activation/types";
import type { PropOsActivatedReadModel } from "../propOs/activation/readService";
import { mapActivatedReadModelToViewModel } from "./mapViewModel";
import type { ChallengeSummary, PropPassUiState } from "./types";

/**
 * Deterministic map: activation result → exactly one PropPassUiState.
 * Never invents score 0 for unavailable states.
 */
export function mapActivationToPropPassUiState(input: {
  entryAllowed: boolean;
  loading: boolean;
  result: PropOsActivationResult<PropOsActivatedReadModel> | null;
}): PropPassUiState {
  if (!input.entryAllowed) return { kind: "disabled" };
  if (input.loading) return { kind: "loading" };
  if (!input.result) return { kind: "disabled" };

  const { result } = input;
  if (result.ok) {
    return {
      kind: "available",
      model: mapActivatedReadModelToViewModel(result.data.readModel),
    };
  }

  switch (result.gate) {
    case "activation_off":
    case "ineligible":
    case "missing_user":
    case "schema_incompatible":
    case "evaluation_error":
      return { kind: "disabled" };
    case "no_account":
      return { kind: "no_account" };
    case "no_active_challenge":
      return { kind: "no_active_challenge" };
    case "multiple_active_challenges": {
      const challenges: ChallengeSummary[] = (result.data?.readModel.activeChallenges ?? []).map(
        (c) => ({
          id: c.id,
          status: c.status,
          startedAt: c.startedAt,
          ruleSetVersion: c.ruleSetVersion,
        }),
      );
      return { kind: "challenge_selection_required", challenges };
    }
    case "missing_rule_snapshot":
      return { kind: "missing_rule_snapshot" };
    case "no_shadow_snapshot":
      return { kind: "no_shadow_snapshot" };
    case "stale_snapshot":
      return { kind: "stale_snapshot", reasonCodes: result.reasonCodes };
    case "incomplete_data":
      return { kind: "incomplete_data", reasonCodes: result.reasonCodes };
    case "unsupported_calculation":
      return { kind: "unsupported", reasonCodes: result.reasonCodes };
    case "integrity_mismatch":
      return { kind: "integrity_error" };
    case "repository_unavailable":
      return { kind: "repository_unavailable" };
    case "available":
      return { kind: "disabled" };
    default:
      return { kind: "disabled" };
  }
}

/**
 * Enrich selection-required with challenges from a partial read model peek.
 * Used when activation returns fail without data payload.
 */
export function mapSelectionRequired(
  challenges: ChallengeSummary[],
): PropPassUiState {
  return { kind: "challenge_selection_required", challenges };
}
