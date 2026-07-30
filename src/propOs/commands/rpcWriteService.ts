import type {
  ArchiveAccountResult,
  ArchivePropAccountCommand,
  ClearActiveChallengeSelectionCommand,
  CreateAccountResult,
  CreateChallengeAttemptCommand,
  CreateChallengeResult,
  CreatePropAccountCommand,
  PreferenceResult,
  PropOsAccountWriteService,
  PropOsCommandState,
  SelectActiveChallengeCommand,
  SetDefaultAccountCommand,
} from "./types";
import { hashPropOsCommandPayload } from "./hash";

/** Narrow RPC client surface — authenticated session only. */
export type PropOsRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

function mapRpcJson<T>(data: unknown): PropOsCommandState<T> {
  if (!data || typeof data !== "object") {
    return { kind: "repository_unavailable" };
  }
  const row = data as Record<string, unknown>;
  const kind = String(row.kind ?? "");
  if (kind === "success") {
    return { kind: "success", value: row.value as T };
  }
  if (kind === "validation_error") {
    const fieldErrors = (row.fieldErrors ?? {}) as Record<string, string>;
    return { kind: "validation_error", fieldErrors };
  }
  if (kind === "conflict") {
    return { kind: "conflict", reasonCode: String(row.reasonCode ?? "conflict") };
  }
  if (kind === "forbidden") return { kind: "forbidden" };
  if (kind === "repository_unavailable") return { kind: "repository_unavailable" };
  if (kind === "unexpected_error") {
    return {
      kind: "unexpected_error",
      correlationId: row.correlationId ? String(row.correlationId) : undefined,
    };
  }
  // Idempotent replay may nest value under success shape already handled
  return { kind: "unexpected_error" };
}

function sanitizeError(err: { message: string; code?: string } | null): PropOsCommandState<never> {
  if (!err) return { kind: "unexpected_error" };
  const msg = err.message.toLowerCase();
  if (msg.includes("unauthenticated") || err.code === "42501") {
    return { kind: "forbidden" };
  }
  if (msg.includes("timeout") || msg.includes("network") || msg.includes("fetch")) {
    return { kind: "repository_unavailable" };
  }
  return { kind: "unexpected_error" };
}

/**
 * Authenticated RPC write service. Never uses service-role.
 * Activation/allowlist gating must happen in the App command gateway before call.
 */
export function createRpcPropOsWriteService(input: {
  client: PropOsRpcClient;
  /** When false, all commands return forbidden without RPC. */
  mutationsAllowed: boolean;
}): PropOsAccountWriteService {
  const { client, mutationsAllowed } = input;

  async function call<T>(
    fn: string,
    commandType: string,
    requestId: string,
    payloadForHash: unknown,
    args: Record<string, unknown>,
  ): Promise<PropOsCommandState<T>> {
    if (!mutationsAllowed) return { kind: "forbidden" };
    const hash = hashPropOsCommandPayload(commandType, payloadForHash);
    try {
      const { data, error } = await client.rpc(fn, {
        p_request_id: requestId,
        p_request_hash: hash,
        ...args,
      });
      if (error) return sanitizeError(error);
      return mapRpcJson<T>(data);
    } catch {
      return { kind: "repository_unavailable" };
    }
  }

  return {
    createPropAccount(cmd: CreatePropAccountCommand) {
      return call<CreateAccountResult>(
        "prop_os_cmd_create_account",
        "create_account",
        cmd.clientRequestId,
        cmd,
        {
          p_label: cmd.label,
          p_firm_key: cmd.firmKey ?? "",
          p_account_size_minor: cmd.accountSizeMinor,
          p_currency: cmd.currency,
          p_firm_timezone: cmd.firmTimezone,
        },
      );
    },

    createChallengeAttempt(cmd: CreateChallengeAttemptCommand) {
      return call<CreateChallengeResult>(
        "prop_os_cmd_create_challenge_attempt",
        "create_challenge_attempt",
        cmd.clientRequestId,
        cmd,
        {
          p_account_id: cmd.accountId,
          p_template_id: cmd.templateId,
          p_template_version: cmd.templateVersion,
          p_rule_snapshot: cmd.ruleSnapshot,
          p_phase: cmd.phase,
          p_started_at: cmd.startedAtUtc ?? null,
          p_reset_of: cmd.resetOfChallengeId ?? null,
        },
      );
    },

    setDefaultAccount(cmd: SetDefaultAccountCommand) {
      return call<PreferenceResult>(
        "prop_os_cmd_set_default_account",
        "set_default_account",
        cmd.clientRequestId,
        cmd,
        { p_account_id: cmd.accountId },
      );
    },

    archivePropAccount(cmd: ArchivePropAccountCommand) {
      return call<ArchiveAccountResult>(
        "prop_os_cmd_archive_account",
        "archive_account",
        cmd.clientRequestId,
        cmd,
        {
          p_account_id: cmd.accountId,
          p_confirm_active: cmd.confirmActive,
        },
      );
    },

    selectActiveChallenge(cmd: SelectActiveChallengeCommand) {
      return call<PreferenceResult>(
        "prop_os_cmd_select_challenge",
        "select_active_challenge",
        cmd.clientRequestId,
        cmd,
        {
          p_account_id: cmd.accountId,
          p_challenge_id: cmd.challengeId,
        },
      );
    },

    clearActiveChallengeSelection(cmd: ClearActiveChallengeSelectionCommand) {
      return call<PreferenceResult>(
        "prop_os_cmd_clear_challenge_selection",
        "clear_active_challenge_selection",
        cmd.clientRequestId,
        cmd,
        { p_account_id: cmd.accountId },
      );
    },
  };
}
