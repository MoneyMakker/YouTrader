/**
 * Phase 2A — Prop Pass application layer (internal / staging only).
 * Non-React surface — safe for Node QA. Screens import UI modules directly.
 */

export type {
  PropPassUiState,
  PropPassViewModel,
  BufferViewModel,
  ChallengeSummary,
  PropPassMoney,
} from "./types";
export { mapActivationToPropPassUiState } from "./mapUiState";
export { mapActivatedReadModelToViewModel } from "./mapViewModel";
export {
  isPropPassEntryVisible,
  isPropPassEnvironmentAllowed,
  resolvePropPassAccess,
} from "./access";
export type { PropPassAccess } from "./access";
export {
  getPropPassGateway,
  peekPropPassAvailability,
  resetPropPassGatewayForTests,
  setPropPassTestReadTransport,
  registerPropPassSupabaseClient,
} from "./gatewayClient";
export { trackPropPassEvent } from "./analytics";
export { tryCreatePropPassAccountsFactory } from "./authenticatedFactory";
