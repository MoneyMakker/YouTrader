/**
 * Authenticated RPC write service for Phase 2C trade assignment.
 */

import { hashPropOsCommandPayload } from "../commands/hash";
import type { PropOsCommandState } from "../commands/types";
import type { PropOsRpcClient } from "../commands/rpcWriteService";
import type {
  AssignTradesCommand,
  AssignmentCommandResult,
  PropOsTradeAssignmentWriteService,
  ReassignTradesCommand,
  RemoveTradeAssignmentsCommand,
} from "./types";

function mapRpcJson<T>(data: unknown): PropOsCommandState<T> {
  if (!data || typeof data !== "object") return { kind: "repository_unavailable" };
  const row = data as Record<string, unknown>;
  const kind = String(row.kind ?? "");
  if (kind === "success") return { kind: "success", value: row.value as T };
  if (kind === "validation_error") {
    return {
      kind: "validation_error",
      fieldErrors: (row.fieldErrors ?? {}) as Record<string, string>,
    };
  }
  if (kind === "conflict") {
    return { kind: "conflict", reasonCode: String(row.reasonCode ?? "conflict") };
  }
  if (kind === "forbidden") return { kind: "forbidden" };
  if (kind === "repository_unavailable") return { kind: "repository_unavailable" };
  return { kind: "unexpected_error" };
}

function sanitizeError(err: { message: string; code?: string } | null): PropOsCommandState<never> {
  if (!err) return { kind: "unexpected_error" };
  const msg = err.message.toLowerCase();
  if (msg.includes("permission") || err.code === "42501") return { kind: "forbidden" };
  if (msg.includes("timeout") || msg.includes("network") || msg.includes("fetch")) {
    return { kind: "repository_unavailable" };
  }
  return { kind: "unexpected_error" };
}

export function createRpcAssignmentWriteService(input: {
  client: PropOsRpcClient;
  mutationsAllowed: boolean;
}): PropOsTradeAssignmentWriteService {
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
    assignTrades(cmd: AssignTradesCommand) {
      const sorted = [...cmd.tradeClientIds].sort();
      return call<AssignmentCommandResult>(
        "prop_os_cmd_assign_trades",
        "assign_trades",
        cmd.clientRequestId,
        {
          accountId: cmd.accountId,
          challengeId: cmd.challengeId,
          tradeClientIds: sorted,
          source: cmd.source ?? "manual",
        },
        {
          p_account_id: cmd.accountId,
          p_challenge_id: cmd.challengeId,
          p_trade_client_ids: sorted,
          p_source: cmd.source ?? "manual",
          p_reason_code: cmd.reasonCode ?? null,
          p_allow_reassign: false,
        },
      );
    },

    reassignTrades(cmd: ReassignTradesCommand) {
      const sorted = [...cmd.tradeClientIds].sort();
      return call<AssignmentCommandResult>(
        "prop_os_cmd_reassign_trades",
        "reassign_trades",
        cmd.clientRequestId,
        {
          accountId: cmd.accountId,
          challengeId: cmd.challengeId,
          tradeClientIds: sorted,
          confirmReassignment: true,
          source: cmd.source ?? "manual",
        },
        {
          p_account_id: cmd.accountId,
          p_challenge_id: cmd.challengeId,
          p_trade_client_ids: sorted,
          p_confirm: true,
          p_source: cmd.source ?? "manual",
          p_reason_code: cmd.reasonCode ?? null,
        },
      );
    },

    removeTradeAssignments(cmd: RemoveTradeAssignmentsCommand) {
      const sorted = [...cmd.tradeClientIds].sort();
      return call<AssignmentCommandResult>(
        "prop_os_cmd_remove_trade_assignments",
        "remove_trade_assignments",
        cmd.clientRequestId,
        {
          accountId: cmd.accountId,
          tradeClientIds: sorted,
        },
        {
          p_account_id: cmd.accountId,
          p_trade_client_ids: sorted,
          p_reason_code: cmd.reasonCode ?? null,
        },
      );
    },
  };
}
