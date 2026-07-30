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

/**
 * Persistence contract for Phase 1D.
 * Implementations must not recalculate engine math or invent assignments.
 */
export interface AccountManagementStore {
  readonly role: "service" | "authenticated" | "anon";

  insertAccount(row: PropAccountRecord): Promise<PropAccountRecord>;
  updateAccount(row: PropAccountRecord): Promise<PropAccountRecord>;
  getAccount(accountId: string): Promise<PropAccountRecord | null>;
  listAccountsForUser(userId: string): Promise<PropAccountRecord[]>;

  insertChallenge(row: PropChallengeRecord): Promise<PropChallengeRecord>;
  updateChallenge(row: PropChallengeRecord): Promise<PropChallengeRecord>;
  getChallenge(challengeId: string): Promise<PropChallengeRecord | null>;
  listChallengesForAccount(accountId: string): Promise<PropChallengeRecord[]>;
  listChallengesForUser(userId: string): Promise<PropChallengeRecord[]>;

  insertRuleSnapshot(row: PropRuleSnapshotRecord): Promise<PropRuleSnapshotRecord>;
  getRuleSnapshot(challengeId: string): Promise<PropRuleSnapshotRecord | null>;

  getAssignment(userId: string, tradeClientId: string): Promise<PropTradeAssignmentRecord | null>;
  upsertAssignment(row: PropTradeAssignmentRecord): Promise<PropTradeAssignmentRecord>;
  listAssignmentsForUser(userId: string): Promise<PropTradeAssignmentRecord[]>;
  listAssignmentsForChallenge(challengeId: string): Promise<PropTradeAssignmentRecord[]>;
  /** Trades assigned to any active challenge for this user (conflict detection). */
  listActiveAssignedTradeIds(userId: string): Promise<Set<string>>;

  insertTransition(row: ChallengeTransitionRecord): Promise<ChallengeTransitionRecord>;

  getDefaultAccountId(userId: string): Promise<string | null>;
  setDefaultAccountId(userId: string, accountId: string | null): Promise<void>;

  getLatestEngineSnapshot(challengeId: string): Promise<EngineSnapshotRow | null>;
  getLatestScoreSnapshot(challengeId: string): Promise<ScoreSnapshotRow | null>;
  /** Optional: seed snapshots for read-model tests. */
  putEngineSnapshot?(row: EngineSnapshotRow): Promise<void>;
  putScoreSnapshot?(row: ScoreSnapshotRow): Promise<void>;
}

export type { AccountReadModel, AssignmentProvenance };
