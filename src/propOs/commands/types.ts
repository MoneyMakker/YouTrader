import type { PropAccountRecord, PropChallengeRecord, PropRuleSnapshotRecord } from "../accounts/types";
import type { PropRuleSetSnapshot } from "../types";
import type { ChallengePhase } from "../accounts/types";

/**
 * Typed command result surface for internal Prop OS mutations.
 * Prevents infinite spinners and maps safely to UI.
 */
export type PropOsCommandState<T> =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; value: T }
  | { kind: "validation_error"; fieldErrors: Record<string, string> }
  | { kind: "conflict"; reasonCode: string }
  | { kind: "forbidden" }
  | { kind: "repository_unavailable" }
  | { kind: "unexpected_error"; correlationId?: string };

export type PropOsCommandType =
  | "create_account"
  | "create_challenge_attempt"
  | "set_default_account"
  | "archive_account"
  | "select_active_challenge"
  | "clear_active_challenge_selection";

export type CreatePropAccountCommand = {
  clientRequestId: string;
  label: string;
  firmKey: string | null;
  accountSizeMinor: number;
  currency: string;
  firmTimezone: string;
  /** evaluation | funded — domain phase for first challenge, not account status. */
  phaseHint?: ChallengePhase;
};

export type CreateChallengeAttemptCommand = {
  clientRequestId: string;
  accountId: string;
  templateId: string;
  templateVersion: string;
  ruleSnapshot: PropRuleSetSnapshot;
  phase: ChallengePhase;
  startedAtUtc?: string;
  resetOfChallengeId?: string | null;
};

export type SetDefaultAccountCommand = {
  clientRequestId: string;
  accountId: string | null;
};

export type ArchivePropAccountCommand = {
  clientRequestId: string;
  accountId: string;
  /** Required true when account has active/at_risk challenges. */
  confirmActive: boolean;
};

export type SelectActiveChallengeCommand = {
  clientRequestId: string;
  accountId: string;
  challengeId: string;
};

export type ClearActiveChallengeSelectionCommand = {
  clientRequestId: string;
  accountId: string;
};

export type CreateAccountResult = {
  account: PropAccountRecord;
};

export type CreateChallengeResult = {
  challenge: PropChallengeRecord;
  ruleSnapshot: PropRuleSnapshotRecord;
  attemptNumber: number;
};

export type ArchiveAccountResult = {
  account: PropAccountRecord;
};

export type PreferenceResult = {
  defaultAccountId: string | null;
  selectedChallengeId: string | null;
};

/**
 * App-facing write contract. No generic table DML.
 * Implementations: memory (QA) or authenticated RPC gateway.
 */
export interface PropOsAccountWriteService {
  createPropAccount(cmd: CreatePropAccountCommand): Promise<PropOsCommandState<CreateAccountResult>>;
  createChallengeAttempt(
    cmd: CreateChallengeAttemptCommand,
  ): Promise<PropOsCommandState<CreateChallengeResult>>;
  setDefaultAccount(cmd: SetDefaultAccountCommand): Promise<PropOsCommandState<PreferenceResult>>;
  archivePropAccount(cmd: ArchivePropAccountCommand): Promise<PropOsCommandState<ArchiveAccountResult>>;
  selectActiveChallenge(
    cmd: SelectActiveChallengeCommand,
  ): Promise<PropOsCommandState<PreferenceResult>>;
  clearActiveChallengeSelection(
    cmd: ClearActiveChallengeSelectionCommand,
  ): Promise<PropOsCommandState<PreferenceResult>>;
}
