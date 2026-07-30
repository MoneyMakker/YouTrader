/**
 * App-facing Prop OS command gateway.
 * Mutations only when local/staging + internal_read_only|staging_preview + allowlisted.
 * Never constructs service-role clients.
 */

import { resolveActivationConfigFromEnv } from "../propOs/activation/resolve";
import { evaluateEligibility } from "../propOs/activation/eligibility";
import type { PropOsAccountWriteService, PropOsCommandState } from "../propOs/commands/types";
import { createRpcPropOsWriteService, type PropOsRpcClient } from "../propOs/commands/rpcWriteService";
import { isPropPassEnvironmentAllowed } from "./access";
import { trackPropPassEvent } from "./analytics";

let rpcClient: PropOsRpcClient | null = null;
let testWriteService: PropOsAccountWriteService | null = null;
let inFlight = new Set<string>();

export function registerPropPassRpcClient(client: PropOsRpcClient | null): void {
  rpcClient = client;
}

export function setPropPassTestWriteService(service: PropOsAccountWriteService | null): void {
  testWriteService = service;
}

export function resetPropPassCommandGatewayForTests(): void {
  testWriteService = null;
  inFlight = new Set();
}

/** Test/internal helper — never exposes service-role. */
export function getPropPassRpcClientForTests(): PropOsRpcClient | null {
  return rpcClient;
}

function mutationsAllowed(
  userId: string | null | undefined,
  env: Record<string, string | undefined>,
): boolean {
  if (!userId) return false;
  if (!isPropPassEnvironmentAllowed(env)) return false;
  const { config } = resolveActivationConfigFromEnv(env);
  if (config.killSwitch) return false;
  if (config.mode !== "internal_read_only" && config.mode !== "staging_preview") {
    return false;
  }
  return evaluateEligibility({
    userId,
    config,
    schemaVersionPresent: config.schemaVersionRequired,
  }).eligible;
}

function getWriteService(
  userId: string | null | undefined,
  env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
): PropOsAccountWriteService | null {
  if (testWriteService) return testWriteService;
  const allowed = mutationsAllowed(userId, env);
  if (!rpcClient) {
    if (!allowed) {
      return createRpcPropOsWriteService({
        client: {
          rpc: async () => ({ data: { kind: "forbidden" }, error: null }),
        },
        mutationsAllowed: false,
      });
    }
    return null;
  }
  return createRpcPropOsWriteService({ client: rpcClient, mutationsAllowed: allowed });
}

/**
 * Guard against double submission for the same clientRequestId.
 */
export async function runPropPassCommand<T>(
  clientRequestId: string,
  userId: string | null | undefined,
  run: (svc: PropOsAccountWriteService) => Promise<PropOsCommandState<T>>,
  eventName?: string,
): Promise<PropOsCommandState<T>> {
  const started = Date.now();
  if (inFlight.has(clientRequestId)) {
    return { kind: "conflict", reasonCode: "double_submit" };
  }
  const svc = getWriteService(userId);
  if (!svc) {
    trackPropPassEvent("prop_pass_command_forbidden", { userId, kind: "no_service" });
    return { kind: "forbidden" };
  }
  if (!mutationsAllowed(userId, typeof process !== "undefined" ? process.env : {})) {
    trackPropPassEvent("prop_pass_command_forbidden", { userId });
    return { kind: "forbidden" };
  }

  inFlight.add(clientRequestId);
  try {
    const result = await run(svc);
    if (eventName) {
      trackPropPassEvent(eventName, {
        userId,
        kind: result.kind,
        reasonCodes: result.kind === "conflict" ? [result.reasonCode] : undefined,
      });
    }
    if (result.kind === "conflict") {
      trackPropPassEvent("prop_pass_command_conflict", {
        userId,
        kind: result.reasonCode,
      });
    }
    if (result.kind === "forbidden") {
      trackPropPassEvent("prop_pass_command_forbidden", { userId });
    }
    trackPropPassEvent("prop_pass_command_latency", {
      userId,
      kind: String(Date.now() - started),
    });
    return result;
  } finally {
    inFlight.delete(clientRequestId);
  }
}

export function getPropPassWriteServiceForTests(): PropOsAccountWriteService | null {
  return testWriteService;
}
