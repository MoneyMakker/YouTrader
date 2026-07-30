import type {
  AccountReadModel,
  AssignmentProvenance,
  ChallengeTransitionRecord,
  PropAccountRecord,
  PropChallengeRecord,
  PropRuleSnapshotRecord,
  PropTradeAssignmentRecord,
} from "./types";
import type { EngineSnapshotRow, ScoreSnapshotRow } from "../shadow/types";
import type { PropOsAccountReadStore } from "./readStore";

/**
 * Persistence contract for Phase 1D (service/QA).
 * App Prop Pass reads use PropOsAccountReadStore only.
 * Implementations must not recalculate engine math or invent assignments.
 */
export interface AccountManagementStore extends PropOsAccountReadStore {
  insertAccount(row: PropAccountRecord): Promise<PropAccountRecord>;
  updateAccount(row: PropAccountRecord): Promise<PropAccountRecord>;

  insertChallenge(row: PropChallengeRecord): Promise<PropChallengeRecord>;
  updateChallenge(row: PropChallengeRecord): Promise<PropChallengeRecord>;

  insertRuleSnapshot(row: PropRuleSnapshotRecord): Promise<PropRuleSnapshotRecord>;

  upsertAssignment(row: PropTradeAssignmentRecord): Promise<PropTradeAssignmentRecord>;

  insertTransition(row: ChallengeTransitionRecord): Promise<ChallengeTransitionRecord>;

  setDefaultAccountId(userId: string, accountId: string | null): Promise<void>;
  setSelectedChallengeId(userId: string, challengeId: string | null): Promise<void>;

  /** Optional: seed snapshots for read-model tests. */
  putEngineSnapshot?(row: EngineSnapshotRow): Promise<void>;
  putScoreSnapshot?(row: ScoreSnapshotRow): Promise<void>;
}

export type { AccountReadModel, AssignmentProvenance };
