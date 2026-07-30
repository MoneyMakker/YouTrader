import type { PropOsActivationMode, PropOsAvailability } from "../propOs/activation/types";
import { peekPropPassAvailability } from "./gatewayClient";

export type PropPassAccess = {
  environmentAllowed: boolean;
  entryVisible: boolean;
  mode: PropOsActivationMode;
  reasonCodes: string[];
};

const STAGING_ENVS = new Set(["development", "staging", "local", "dev"]);

/**
 * Local / staging only. Production builds never show Prop Pass entry when off.
 */
export function isPropPassEnvironmentAllowed(
  env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
): boolean {
  if (typeof __DEV__ !== "undefined" && __DEV__) return true;
  const appEnv = (env.EXPO_PUBLIC_APP_ENV ?? env.APP_ENV ?? "").trim().toLowerCase();
  return STAGING_ENVS.has(appEnv);
}

export function resolvePropPassAccess(
  env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
  availability?: PropOsAvailability | null,
): PropPassAccess {
  const environmentAllowed = isPropPassEnvironmentAllowed(env);
  let peek = availability;
  if (!peek) {
    try {
      peek = peekPropPassAvailability(null);
    } catch {
      return {
        environmentAllowed,
        entryVisible: false,
        mode: "off",
        reasonCodes: ["gateway_peek_failed"],
      };
    }
  }
  const modeOk =
    peek.mode === "internal_read_only" || peek.mode === "staging_preview";
  const entryVisible =
    environmentAllowed && modeOk && !peek.killSwitch && peek.mode !== "off";
  return {
    environmentAllowed,
    entryVisible,
    mode: peek.mode,
    reasonCodes: peek.reasonCodes,
  };
}

export function isPropPassEntryVisible(
  env?: Record<string, string | undefined>,
  availability?: PropOsAvailability | null,
): boolean {
  return resolvePropPassAccess(env, availability).entryVisible;
}
