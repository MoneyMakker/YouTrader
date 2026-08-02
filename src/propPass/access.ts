import type { PropOsActivationMode, PropOsAvailability } from "../propOs/activation/types";
import { GENERATED_APP_ENV } from "../config/buildFingerprint.generated";
import { peekPropPassAvailability } from "./gatewayClient";

export type PropPassAccess = {
  environmentAllowed: boolean;
  entryVisible: boolean;
  mode: PropOsActivationMode;
  reasonCodes: string[];
};

const STAGING_ENVS = new Set(["development", "staging", "local", "dev"]);

/**
 * Local / staging environments may expose Prop Pass when mode + allowlist pass.
 * Primary tab visibility is decided by `isPropPassEntryVisible` (AppShell).
 */
export function isPropPassEnvironmentAllowed(
  env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
): boolean {
  if (typeof __DEV__ !== "undefined" && __DEV__) return true;
  // Prefer explicit env, then embedded Release-Staging fingerprint (Metro may omit EXPO_PUBLIC_*).
  const appEnv = (
    env.EXPO_PUBLIC_APP_ENV ??
    env.APP_ENV ??
    (GENERATED_APP_ENV || "")
  )
    .trim()
    .toLowerCase();
  return STAGING_ENVS.has(appEnv);
}

export function resolvePropPassAccess(
  env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
  availability?: PropOsAvailability | null,
  userId?: string | null,
): PropPassAccess {
  const environmentAllowed = isPropPassEnvironmentAllowed(env);
  let peek = availability;
  if (!peek) {
    try {
      peek = peekPropPassAvailability(userId ?? null);
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
  // Hide until authenticated + allowlisted — prevents flash for ineligible users.
  const entryVisible =
    environmentAllowed &&
    modeOk &&
    !peek.killSwitch &&
    peek.mode !== "off" &&
    !!userId &&
    peek.eligible === true;
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
  userId?: string | null,
): boolean {
  return resolvePropPassAccess(env, availability, userId).entryVisible;
}
