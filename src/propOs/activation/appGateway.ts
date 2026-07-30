/**
 * App-facing Prop OS activation boundary (dormant).
 *
 * Rules (Phase 1E):
 * - Defaults to off; must not delay App startup.
 * - No Prop Pass navigation; screens must not import Prop OS domain.
 * - Service-role credentials must never be bundled.
 * - off mode performs zero Prop OS database requests.
 *
 * App.tsx / YouTraderApp must NOT import this in Phase 1E — harness only.
 * Future App wiring imports only this module, never accounts/shadow/engine.
 */

import type { AccountManagementService } from "../accounts/service";
import {
  createPropOsReadService,
  type PropOsReadRequest,
  type PropOsReadService,
} from "./readService";
import {
  evaluateActivationPolicy,
  type KillSwitchContract,
} from "./policy";
import { resolveActivationConfigFromEnv } from "./resolve";
import type { PropOsActivationConfig, PropOsAvailability } from "./types";
import { DEFAULT_ACTIVATION_CONFIG } from "./types";

export type PropOsAppGatewayDeps = {
  /** Injected only when activation leaves off — never constructed with service_role in App. */
  accountsFactory?: () => AccountManagementService;
  config?: PropOsActivationConfig;
  killSwitch?: KillSwitchContract;
  getSchemaVersion?: () => Promise<string | null>;
  env?: Record<string, string | undefined>;
};

export type PropOsAppGateway = {
  /** Synchronous availability peek — never touches Prop OS stores. */
  peekAvailability(userId: string | null | undefined): PropOsAvailability;
  /** Activated read — no-op store path when off. */
  getActivatedReadModel: PropOsReadService["getActivatedReadModel"];
  getPropOsCallCount: () => number;
  /** Mutations are intentionally absent. */
};

/**
 * Create the single typed application service for Prop OS.
 * When mode is off, accountsFactory is never called.
 */
export function createPropOsAppGateway(deps: PropOsAppGatewayDeps = {}): PropOsAppGateway {
  const env = deps.env ?? (typeof process !== "undefined" ? process.env : {});
  const resolved = deps.config
    ? { config: deps.config }
    : resolveActivationConfigFromEnv(env);
  const config = deps.config ?? resolved.config;

  let readService: PropOsReadService | null = null;

  function ensureReadService(): PropOsReadService {
    if (readService) return readService;
    if (config.mode === "off" || config.killSwitch) {
      // Lazy: still create a service without accounts for off-path typing,
      // using a throwing factory that must never be invoked when off.
      readService = createPropOsReadService({
        config,
        killSwitch: deps.killSwitch,
        accounts: {
          getAccountReadModel: async () => {
            throw new Error("prop_os_off_zero_call_violation");
          },
          listActiveChallengesForAccount: async () => {
            throw new Error("prop_os_off_zero_call_violation");
          },
        } as unknown as AccountManagementService,
        getSchemaVersion: deps.getSchemaVersion,
      });
      return readService;
    }
    if (!deps.accountsFactory) {
      readService = createPropOsReadService({
        config,
        killSwitch: deps.killSwitch,
        accounts: {
          getAccountReadModel: async () => {
            throw new Error("prop_os_accounts_factory_missing");
          },
          listActiveChallengesForAccount: async () => {
            throw new Error("prop_os_accounts_factory_missing");
          },
        } as unknown as AccountManagementService,
        getSchemaVersion: deps.getSchemaVersion,
      });
      return readService;
    }
    readService = createPropOsReadService({
      config,
      killSwitch: deps.killSwitch,
      accounts: deps.accountsFactory(),
      getSchemaVersion: deps.getSchemaVersion,
    });
    return readService;
  }

  return {
    peekAvailability(userId) {
      const policy = evaluateActivationPolicy({
        config,
        killSwitch: deps.killSwitch,
        userId,
        schemaVersionPresent: config.schemaVersionRequired,
      });
      return {
        mode: policy.mode,
        eligible: policy.eligibility.eligible && policy.mayRead,
        gate: policy.mode === "off" ? "activation_off" : policy.mayRead ? "available" : "ineligible",
        reasonCodes: policy.eligibility.reasonCodes,
        killSwitch: policy.config.killSwitch,
      };
    },
    async getActivatedReadModel(request: PropOsReadRequest) {
      return ensureReadService().getActivatedReadModel(request);
    },
    getPropOsCallCount() {
      return readService?.getPropOsCallCount() ?? 0;
    },
  };
}

export function defaultDormantGatewayConfig(): PropOsActivationConfig {
  return { ...DEFAULT_ACTIVATION_CONFIG };
}
