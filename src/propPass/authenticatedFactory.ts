/**
 * Application-boundary factory for authenticated Prop OS reads.
 * Instantiated only for local/staging + internal_read_only|staging_preview.
 *
 * Does not import App config modules (avoids RN/i18n in Node QA).
 * App injects the authenticated Supabase client; tests inject PropOsReadTransport.
 */

import { createAccountManagementService } from "../propOs/accounts/service";
import type { AccountManagementService } from "../propOs/accounts/service";
import { createAuthenticatedPropOsReadStore } from "../propOs/accounts/authenticatedReadStore";
import {
  createSupabasePropOsReadTransport,
  type PropOsReadTransport,
  type SupabasePropOsReadClient,
} from "../propOs/accounts/authenticatedReadTransport";
import { resolveActivationConfigFromEnv } from "../propOs/activation/resolve";
import { isPropPassEnvironmentAllowed } from "./access";

export type PropPassAccountsFactoryOptions = {
  env?: Record<string, string | undefined>;
  /** Injected transport for local RLS QA — never memory fixtures after gateway. */
  transport?: PropOsReadTransport;
  /** Authenticated Supabase client from App boundary. */
  supabaseClient?: SupabasePropOsReadClient | null;
};

/**
 * Returns null when factory must not run (production / off / missing client).
 */
export function tryCreatePropPassAccountsFactory(
  options: PropPassAccountsFactoryOptions = {},
): (() => AccountManagementService) | null {
  const env = options.env ?? (typeof process !== "undefined" ? process.env : {});
  if (!isPropPassEnvironmentAllowed(env)) return null;

  const { config } = resolveActivationConfigFromEnv(env);
  if (config.killSwitch) return null;
  if (config.mode !== "internal_read_only" && config.mode !== "staging_preview") {
    return null;
  }

  if (options.transport) {
    const transport = options.transport;
    return () => createAccountManagementService(createAuthenticatedPropOsReadStore(transport));
  }

  const client = options.supabaseClient ?? null;
  if (!client) return null;

  return () =>
    createAccountManagementService(
      createAuthenticatedPropOsReadStore(createSupabasePropOsReadTransport(client)),
    );
}
