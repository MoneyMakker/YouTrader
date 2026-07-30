/**
 * Lazy App-facing Prop OS gateway. Must not delay startup.
 * Service-role credentials must never be constructed here.
 */

import {
  createPropOsAppGateway,
  type PropOsAppGateway,
} from "../propOs/activation/appGateway";
import type { PropOsAvailability } from "../propOs/activation/types";
import { tryCreatePropPassAccountsFactory } from "./authenticatedFactory";
import type { PropOsReadTransport } from "../propOs/accounts/authenticatedReadTransport";
import type { SupabasePropOsReadClient } from "../propOs/accounts/authenticatedReadTransport";

let gateway: PropOsAppGateway | null = null;
let initFailed = false;
/** Test-only transport injection before first gateway create. */
let testTransport: PropOsReadTransport | null = null;
/** App-provided authenticated client (publishable key session only). */
let appSupabaseClient: SupabasePropOsReadClient | null | undefined = undefined;

export function resetPropPassGatewayForTests(): void {
  gateway = null;
  initFailed = false;
  testTransport = null;
  appSupabaseClient = undefined;
}

/** Integration tests only — inject authenticated RLS transport before getPropPassGateway(). */
export function setPropPassTestReadTransport(transport: PropOsReadTransport | null): void {
  testTransport = transport;
  gateway = null;
  initFailed = false;
}

/**
 * App bootstrap may register the authenticated Supabase client.
 * Must never pass a service-role client.
 */
export function registerPropPassSupabaseClient(
  client: SupabasePropOsReadClient | null,
): void {
  appSupabaseClient = client;
  gateway = null;
  initFailed = false;
}

/**
 * Sync peek — never touches Prop OS repositories.
 */
export function peekPropPassAvailability(
  userId: string | null | undefined,
): PropOsAvailability {
  const g = getPropPassGateway();
  if (!g) {
    return {
      mode: "off",
      eligible: false,
      gate: "activation_off",
      reasonCodes: ["gateway_unavailable"],
      killSwitch: false,
    };
  }
  return g.peekAvailability(userId);
}

export function getPropPassGateway(): PropOsAppGateway | null {
  if (initFailed) return null;
  if (gateway) return gateway;
  try {
    const env = typeof process !== "undefined" ? process.env : {};
    const accountsFactory = tryCreatePropPassAccountsFactory({
      env,
      transport: testTransport ?? undefined,
      supabaseClient: testTransport ? null : appSupabaseClient ?? null,
    });
    gateway = createPropOsAppGateway({
      env,
      accountsFactory: accountsFactory ?? undefined,
      getSchemaVersion: async () => "prop-os-schema-v0",
    });
    return gateway;
  } catch {
    initFailed = true;
    return null;
  }
}
