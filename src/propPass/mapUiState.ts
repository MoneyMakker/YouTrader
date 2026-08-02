import type { PropOsActivationResult } from "../propOs/activation/types";
import type { PropOsActivatedReadModel } from "../propOs/activation/readService";
import type { AccountReadModel } from "../propOs/accounts/types";
import { mapActivatedReadModelToViewModel } from "./mapViewModel";
import type { ChallengeSummary, PropPassTerminalModel, PropPassUiState } from "./types";

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
      return { kind: "disabled" };
    case "schema_incompatible":
      return { kind: "unsupported", reasonCodes: result.reasonCodes };
    case "evaluation_error":
      // A gateway evaluation failure is operational, not a product-access
      // decision. Preserve a retryable state instead of showing setup or a
      // normal unavailable screen to an entitled customer.
      return { kind: "repository_unavailable" };
    case "no_account":
      return { kind: "no_account" };
    case "no_active_challenge":
      return mapNoActiveChallenge(result.data?.readModel ?? null);
    case "multiple_active_challenges": {
      const challenges: ChallengeSummary[] = (result.data?.readModel.activeChallenges ?? []).map(
        (c) => ({
          id: c.id,
          status: c.status,
          startedAt: c.startedAt,
          ruleSetVersion: c.ruleSetVersion,
        }),
      );
      return {
        kind: "challenge_selection_required",
        challenges,
        accountId: result.data?.readModel.account?.id ?? null,
      };
    }
    case "missing_rule_snapshot":
      return { kind: "missing_rule_snapshot" };
    case "no_shadow_snapshot":
      return {
        kind: "no_shadow_snapshot",
        assignmentContext: assignmentContext(result.data?.readModel ?? null),
      };
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

function assignmentContext(readModel: AccountReadModel | null) {
  const account = readModel?.account;
  const challenge = readModel?.activeChallenge;
  if (!account || !challenge) return undefined;
  return {
    accountId: account.id,
    accountStatus: account.status,
    challengeId: challenge.id,
    challengeStatus: challenge.status,
    challengeStartedAt: challenge.startedAt,
  };
}

function mapNoActiveChallenge(readModel: AccountReadModel | null): PropPassUiState {
  const account = readModel?.account;
  const latest = readModel?.historicalAttempts[0];
  if (!account || !latest) return { kind: "no_active_challenge" };
  const payload =
    readModel.latestShadowSnapshot?.challenge_id === latest.id
      ? (readModel.latestShadowSnapshot.payload as Record<string, unknown>)
      : null;
  const accountState = (payload?.accountState ?? {}) as Record<string, unknown>;
  const buffers = Array.isArray(payload?.buffers)
    ? (payload!.buffers as Array<{ id?: string; remainingMinor?: number }>)
    : [];
  const target = buffers.find((buffer) => buffer.id === "target_distance");
  const breachReasons = Array.isArray(payload?.breachReasons)
    ? (payload!.breachReasons as PropPassTerminalModel["breachReasons"])
    : [];
  const model: PropPassTerminalModel = {
    account: {
      id: account.id,
      displayName: account.label,
      firmName: account.firmKey ?? undefined,
      accountSize: { minor: account.accountSizeMinor, currency: account.currency },
      lifecycleStatus: account.status,
    },
    challenge: {
      id: latest.id,
      status: latest.status,
      startedAt: latest.startedAt,
      endedAt: latest.endedAt,
    },
    breachReasons,
    metrics: payload
      ? {
          equityMinor: typeof accountState.equityMinor === "number" ? accountState.equityMinor : null,
          profitRemainingMinor:
            typeof target?.remainingMinor === "number" ? target.remainingMinor : null,
          currency: account.currency,
        }
      : null,
  };
  return ["passed", "funded"].includes(latest.status)
    ? { kind: "challenge_passed", model }
    : ["breached", "abandoned"].includes(latest.status)
      ? { kind: "challenge_failed", model }
      : { kind: "no_active_challenge" };
}

/**
 * Enrich selection-required with challenges from a partial read model peek.
 * Used when activation returns fail without data payload.
 */
export function mapSelectionRequired(
  challenges: ChallengeSummary[],
  accountId: string | null = null,
): PropPassUiState {
  return { kind: "challenge_selection_required", challenges, accountId };
}
