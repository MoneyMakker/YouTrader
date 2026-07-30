/**
 * Phase 1E — Controlled Activation (dormant).
 * Single boundary: App/harness → policy → eligibility → read service → AccountReadModel.
 */

export {
  ACTIVATION_CONTRACT_VERSION,
  DEFAULT_ACTIVATION_CONFIG,
  SUPPORTED_CALCULATION_VERSIONS,
  SUPPORTED_SCHEMA_VERSIONS,
  SUPPORTED_CONFIDENCE_POLICY_VERSIONS,
} from "./types";
export type {
  PropOsActivationMode,
  PropOsActivationConfig,
  PropOsReadModelGate,
  PropOsAvailability,
  SnapshotFreshnessInput,
  SnapshotFreshnessResult,
  ActivationDiagnosticEvent,
  PropOsActivationResult,
} from "./types";

export { parseActivationMode, resolveActivationConfig, resolveActivationConfigFromEnv } from "./resolve";
export { evaluateEligibility } from "./eligibility";
export type { EligibilityInput, EligibilityResult } from "./eligibility";
export { evaluateSnapshotFreshness } from "./freshness";
export { createActivationDiagnostics, redactId } from "./diagnostics";
export type { ActivationDiagnosticsSink } from "./diagnostics";
export {
  evaluateActivationPolicy,
  createStaticKillSwitch,
  createMutableKillSwitch,
  createEnvKillSwitch,
} from "./policy";
export type {
  KillSwitchContract,
  RemoteKillSwitchSource,
  ActivationPolicyInput,
  ActivationPolicyResult,
} from "./policy";
export {
  createPropOsReadService,
  defaultValidateSnapshotIntegrity,
} from "./readService";
export type {
  PropOsReadService,
  PropOsReadServiceDeps,
  PropOsReadRequest,
  PropOsActivatedReadModel,
} from "./readService";
export {
  createPropOsAppGateway,
  defaultDormantGatewayConfig,
} from "./appGateway";
export type { PropOsAppGateway, PropOsAppGatewayDeps } from "./appGateway";
