import { useCallback, useEffect, useRef, useState } from "react";
import type { PropOsActivationResult } from "../propOs/activation/types";
import type { PropOsActivatedReadModel } from "../propOs/activation/readService";
import { isPropPassEntryVisible, resolvePropPassAccess } from "./access";
import { trackPropPassEvent } from "./analytics";
import { getPropPassGateway, peekPropPassAvailability } from "./gatewayClient";
import { mapActivationToPropPassUiState } from "./mapUiState";
import type { PropPassUiState } from "./types";

const LOAD_TIMEOUT_MS = 8_000;

export type PropPassAvailabilityController = {
  entryVisible: boolean;
  uiState: PropPassUiState;
  refresh: (opts?: { selectedChallengeId?: string | null }) => void;
  selectChallengePreview: (challengeId: string) => void;
  /** Staging-only, non-persistent selection. */
  previewChallengeId: string | null;
};

/**
 * Single client-facing Prop Pass state source.
 * Does not scatter activation checks across screens.
 */
export function usePropPassAvailability(input: {
  userId: string | null | undefined;
  accountId?: string | null;
  enabled?: boolean;
}): PropPassAvailabilityController {
  const [previewChallengeId, setPreviewChallengeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PropOsActivationResult<PropOsActivatedReadModel> | null>(
    null,
  );
  const seq = useRef(0);

  const access = resolvePropPassAccess(undefined, peekPropPassAvailability(input.userId));
  const entryVisible =
    (input.enabled ?? true) &&
    isPropPassEntryVisible(undefined, peekPropPassAvailability(input.userId));

  const refresh = useCallback(
    (opts?: { selectedChallengeId?: string | null }) => {
      if (!entryVisible) {
        setResult(null);
        setLoading(false);
        return;
      }
      const my = ++seq.current;
      setLoading(true);
      const started = Date.now();
      const gateway = getPropPassGateway();
      if (!gateway) {
        setResult({
          ok: false,
          mode: "off",
          gate: "evaluation_error",
          reasonCodes: ["gateway_unavailable"],
          diagnostics: [],
          data: null,
        });
        setLoading(false);
        return;
      }

      const timer = setTimeout(() => {
        if (seq.current !== my) return;
        setResult({
          ok: false,
          mode: access.mode,
          gate: "repository_unavailable",
          reasonCodes: ["repository_timeout"],
          diagnostics: [],
          data: null,
        });
        setLoading(false);
        trackPropPassEvent("prop_pass_repository_fallback_displayed", {
          kind: "repository_unavailable",
          mode: access.mode,
          userId: input.userId,
        });
      }, LOAD_TIMEOUT_MS);

      void gateway
        .getActivatedReadModel({
          userId: input.userId,
          accountId: input.accountId ?? null,
          selectedChallengeId: opts?.selectedChallengeId ?? previewChallengeId,
        })
        .then((res) => {
          if (seq.current !== my) return;
          clearTimeout(timer);
          setResult(res);
          setLoading(false);
          const kind = mapActivationToPropPassUiState({
            entryAllowed: entryVisible,
            loading: false,
            result: res,
          }).kind;
          const failCodes =
            res.ok === false ? res.reasonCodes : ([] as string[]);
          trackPropPassEvent("prop_pass_ui_state_resolved", {
            kind,
            mode: res.mode,
            userId: input.userId,
            reasonCodes: failCodes,
          });
          if (kind === "challenge_selection_required") {
            trackPropPassEvent("prop_pass_challenge_selection_required", {
              kind,
              mode: res.mode,
              userId: input.userId,
            });
          }
          if (kind === "stale_snapshot") {
            trackPropPassEvent("prop_pass_stale_snapshot_displayed", {
              kind,
              mode: res.mode,
              userId: input.userId,
              reasonCodes: failCodes,
            });
          }
          if (kind === "incomplete_data") {
            trackPropPassEvent("prop_pass_incomplete_data_displayed", {
              kind,
              mode: res.mode,
              userId: input.userId,
            });
          }
          if (kind === "repository_unavailable") {
            trackPropPassEvent("prop_pass_repository_fallback_displayed", {
              kind,
              mode: res.mode,
              userId: input.userId,
            });
          }
          void started;
        })
        .catch(() => {
          if (seq.current !== my) return;
          clearTimeout(timer);
          setResult({
            ok: false,
            mode: access.mode,
            gate: "repository_unavailable",
            reasonCodes: ["repository_exception"],
            diagnostics: [],
            data: null,
          });
          setLoading(false);
        });
    },
    [
      access.mode,
      entryVisible,
      input.accountId,
      input.userId,
      previewChallengeId,
    ],
  );

  useEffect(() => {
    if (entryVisible) {
      trackPropPassEvent("prop_pass_entry_visible", {
        mode: access.mode,
        userId: input.userId,
      });
    }
  }, [access.mode, entryVisible, input.userId]);

  useEffect(() => {
    if (!entryVisible) {
      setResult(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [entryVisible, refresh]);

  const uiState = mapActivationToPropPassUiState({
    entryAllowed: entryVisible,
    loading,
    result,
  });

  // Patch challenges onto selection_required from fail payload
  const enriched: PropPassUiState =
    uiState.kind === "challenge_selection_required" &&
    result &&
    !result.ok &&
    result.data?.readModel
      ? {
          kind: "challenge_selection_required",
          challenges: result.data.readModel.activeChallenges.map((c) => ({
            id: c.id,
            status: c.status,
            startedAt: c.startedAt,
            ruleSetVersion: c.ruleSetVersion,
          })),
        }
      : uiState;

  return {
    entryVisible,
    uiState: enriched,
    refresh,
    previewChallengeId,
    selectChallengePreview: (challengeId: string) => {
      // Staging-only local preview — non-persistent, non-production.
      setPreviewChallengeId(challengeId);
      refresh({ selectedChallengeId: challengeId });
    },
  };
}
