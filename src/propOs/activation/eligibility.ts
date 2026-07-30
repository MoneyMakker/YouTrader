import type { PropOsActivationConfig, PropOsActivationMode } from "./types";

export type EligibilityInput = {
  config: PropOsActivationConfig;
  userId: string | null | undefined;
  schemaVersionPresent: string | null;
};

export type EligibilityResult = {
  eligible: boolean;
  effectiveMode: PropOsActivationMode;
  reasonCodes: string[];
};

/**
 * Eligibility gates. Domain math stays unaware of flags.
 */
export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const reasonCodes: string[] = [];
  const { config } = input;

  if (config.killSwitch) {
    reasonCodes.push("kill_switch");
    return { eligible: false, effectiveMode: "off", reasonCodes };
  }

  if (config.mode === "off") {
    reasonCodes.push("mode_off");
    return { eligible: false, effectiveMode: "off", reasonCodes };
  }

  if (!input.userId) {
    reasonCodes.push("missing_user");
    return { eligible: false, effectiveMode: config.mode, reasonCodes };
  }

  if (
    (config.mode === "internal_read_only" || config.mode === "staging_preview") &&
    !config.allowlistUserIds.includes(input.userId)
  ) {
    reasonCodes.push("not_allowlisted");
    return { eligible: false, effectiveMode: config.mode, reasonCodes };
  }

  if (
    input.schemaVersionPresent == null ||
    input.schemaVersionPresent !== config.schemaVersionRequired
  ) {
    reasonCodes.push("schema_incompatible");
    return { eligible: false, effectiveMode: config.mode, reasonCodes };
  }

  return { eligible: true, effectiveMode: config.mode, reasonCodes: ["eligible"] };
}
