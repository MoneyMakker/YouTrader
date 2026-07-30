/**
 * Phase 1D — Internal Prop OS account management.
 * Not for App / UI imports until Phase 1E.
 */
export { ACCOUNT_MGMT_VERSION } from "./types";
export type {
  PropAccountStatus,
  TradeAssignmentState,
  DbAssignmentState,
  AssignmentActor,
  ChallengePhase,
  ChallengeStatus,
  ChallengeSelectionState,
  DataQualityLevel,
  AssignmentProvenance,
  PropAccountRecord,
  PropChallengeRecord,
  PropRuleSnapshotRecord,
  PropTradeAssignmentRecord,
  ChallengeTransitionRecord,
  AccountReadModel,
  GetAccountReadModelOptions,
  CreatePropAccountInput,
  CreateChallengeAttemptInput,
  AssignTradeInput,
  UnassignTradeInput,
  TransitionChallengeInput,
} from "./types";

export { toDbAssignmentState, fromDbAssignmentState, isAssignedState } from "./assignmentState";
export { canTransitionChallenge, isActiveChallengeStatus } from "./transitions";
export { AccountMgmtError } from "./errors";
export type { AccountMgmtFailure } from "./errors";
export type { AccountManagementStore } from "./store";
export { createMemoryAccountStore, freshId } from "./memoryStore";
export { createAccountManagementService } from "./service";
export type { AccountManagementService } from "./service";
export { createAuthenticatedPropOsReadStore } from "./authenticatedReadStore";
export {
  createSupabasePropOsReadTransport,
} from "./authenticatedReadTransport";
export type {
  PropOsReadTransport,
  SupabasePropOsReadClient,
} from "./authenticatedReadTransport";
