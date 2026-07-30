/**
 * Phase 1E — Prop OS controlled activation contracts.
 * Domain/engine/stores remain flag-unaware.
 */

export const ACTIVATION_CONTRACT_VERSION = "prop-os-activation-v0" as const;
export const SUPPORTED_CALCULATION_VERSIONS = ["calc-spec-v0"] as const;
export const SUPPORTED_SCHEMA_VERSIONS = ["prop-os-schema-v0"] as const;
export const SUPPORTED_CONFIDENCE_POLICY_VERSIONS = ["confidence-policy-v0"] as const;
export const SUPPORTED_READINESS_MODEL_VERSIONS = ["readiness-v0", null] as const;

export type PropOsActivationMode =
  | "off"
  | "shadow"
  | "internal_read_only"
  | "staging_preview";

export type PropOsActivationConfig = {
  mode: PropOsActivationMode;
  /** Kill switch forces off regardless of mode. */
  killSwitch: boolean;
  /** Allowlisted user ids for internal_read_only / staging_preview. */
  allowlistUserIds: string[];
  /** Optional max snapshot age (ms). Time alone never proves freshness. */
  maxSnapshotAgeMs: number | null;
  schemaVersionRequired: string;
  calculationVersionsAllowed: string[];
  confidencePolicyVersionsAllowed: string[];
  contractVersion: typeof ACTIVATION_CONTRACT_VERSION;
};

export type PropOsReadModelGate =
  | "available"
  | "activation_off"
  | "ineligible"
  | "missing_user"
  | "no_account"
  | "no_active_challenge"
  | "multiple_active_challenges"
  | "missing_rule_snapshot"
  | "no_shadow_snapshot"
  | "stale_snapshot"
  | "incomplete_data"
  | "unsupported_calculation"
  | "integrity_mismatch"
  | "repository_unavailable"
  | "schema_incompatible"
  | "evaluation_error";

export type PropOsAvailability = {
  mode: PropOsActivationMode;
  eligible: boolean;
  gate: PropOsReadModelGate;
  reasonCodes: string[];
  killSwitch: boolean;
};

export type SnapshotFreshnessInput = {
  snapshotInputRevision: string;
  currentInputRevision: string | null;
  calculationVersion: string;
  ruleSetVersion: string;
  currentRuleSetVersion: string | null;
  readinessModelVersion: string | null;
  confidencePolicyVersion: string;
  calculatedAt: string;
  nowUtc: string;
  maxAgeMs: number | null;
  allowedCalculationVersions: string[];
  allowedConfidencePolicyVersions: string[];
};

export type SnapshotFreshnessResult = {
  fresh: boolean;
  reasons: string[];
};

export type ActivationDiagnosticEvent =
  | { type: "activation_mode_resolved"; mode: PropOsActivationMode; source: string }
  | { type: "user_eligible"; eligible: boolean; reasonCodes: string[] }
  | { type: "schema_compatible"; compatible: boolean; schemaVersion?: string }
  | { type: "read_model_available"; available: boolean; gate: PropOsReadModelGate }
  | { type: "fallback_activated"; gate: PropOsReadModelGate; reasonCodes: string[] }
  | { type: "snapshot_stale"; reasons: string[] }
  | { type: "integrity_mismatch"; reasons: string[] }
  | { type: "kill_switch_used"; active: boolean }
  | { type: "repository_latency"; operation: string; ms: number }
  | { type: "unexpected_activation_error"; code: string };

export type PropOsActivationResult<T> =
  | {
      ok: true;
      mode: PropOsActivationMode;
      gate: "available";
      data: T;
      diagnostics: ActivationDiagnosticEvent[];
    }
  | {
      ok: false;
      mode: PropOsActivationMode;
      gate: PropOsReadModelGate;
      reasonCodes: string[];
      diagnostics: ActivationDiagnosticEvent[];
      /** Present when a read model was loaded but gated (e.g. selection_required). */
      data: T | null;
    };

export const DEFAULT_ACTIVATION_CONFIG: PropOsActivationConfig = {
  mode: "off",
  killSwitch: false,
  allowlistUserIds: [],
  maxSnapshotAgeMs: null,
  schemaVersionRequired: "prop-os-schema-v0",
  calculationVersionsAllowed: [...SUPPORTED_CALCULATION_VERSIONS],
  confidencePolicyVersionsAllowed: [...SUPPORTED_CONFIDENCE_POLICY_VERSIONS],
  contractVersion: ACTIVATION_CONTRACT_VERSION,
};
