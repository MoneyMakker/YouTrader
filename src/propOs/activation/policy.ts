import { evaluateEligibility, type EligibilityResult } from "./eligibility";
import type { PropOsActivationConfig, PropOsActivationMode } from "./types";
import { resolveActivationConfig, type ActivationEnvSource } from "./resolve";

export type KillSwitchContract = {
  /** When true, force mode off without mutating stored snapshots. */
  isActive(): boolean;
};

export function createStaticKillSwitch(active: boolean): KillSwitchContract {
  return { isActive: () => active };
}

export function createMutableKillSwitch(initial = false): KillSwitchContract & {
  setActive(active: boolean): void;
} {
  let active = initial;
  return {
    isActive: () => active,
    setActive(next) {
      active = next;
    },
  };
}

/**
 * Remote kill-switch contract. Phase 1E ships env/local only — no new vendor.
 * Future remote config adapters must implement this interface.
 */
export type RemoteKillSwitchSource = {
  readKillSwitch(): Promise<boolean> | boolean;
};

export function createEnvKillSwitch(
  env: Record<string, string | undefined>,
): KillSwitchContract {
  return {
    isActive() {
      const v = env.EXPO_PUBLIC_PROP_OS_KILL_SWITCH ?? env.PROP_OS_KILL_SWITCH;
      return v === "true" || v === "1";
    },
  };
}

export type ActivationPolicyInput = {
  envSource?: ActivationEnvSource | null;
  config?: PropOsActivationConfig;
  killSwitch?: KillSwitchContract;
  userId: string | null | undefined;
  schemaVersionPresent: string | null;
};

export type ActivationPolicyResult = {
  config: PropOsActivationConfig;
  eligibility: EligibilityResult;
  mode: PropOsActivationMode;
  /** True when App/harness may invoke Prop OS reads. */
  mayRead: boolean;
  /** True when isolated shadow runner may calculate (still App-invisible). */
  mayRunShadow: boolean;
  /** True when staging harness may inspect full read model. */
  mayStagingPreview: boolean;
  sourceLabel: string;
  warnings: string[];
};

/**
 * Single activation policy boundary.
 * Screens/repos/domain must not re-check flags.
 */
export function evaluateActivationPolicy(input: ActivationPolicyInput): ActivationPolicyResult {
  const resolved = input.config
    ? { config: { ...input.config }, sourceLabel: "injected", warnings: [] as string[] }
    : resolveActivationConfig(input.envSource ?? null);

  let config = resolved.config;
  if (input.killSwitch?.isActive()) {
    config = { ...config, killSwitch: true, mode: "off" };
  }

  const eligibility = evaluateEligibility({
    config,
    userId: input.userId,
    schemaVersionPresent: input.schemaVersionPresent,
  });

  const mode = eligibility.effectiveMode;
  const mayRunShadow = mode === "shadow" && !config.killSwitch;
  const mayRead =
    eligibility.eligible &&
    (mode === "internal_read_only" || mode === "staging_preview");
  const mayStagingPreview = eligibility.eligible && mode === "staging_preview";

  return {
    config,
    eligibility,
    mode,
    mayRead,
    mayRunShadow,
    mayStagingPreview,
    sourceLabel: resolved.sourceLabel,
    warnings: resolved.warnings,
  };
}
