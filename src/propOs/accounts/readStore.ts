import type {
  PropAccountRecord,
  PropChallengeRecord,
  PropRuleSnapshotRecord,
  PropTradeAssignmentRecord,
  ChallengeTransitionRecord,
} from "./types";
import type { EngineSnapshotRow, ScoreSnapshotRow } from "../shadow/types";

/**
 * SELECT-only persistence surface for Prop Pass and activation reads.
 * Must never expose insert/update/delete.
 */
export interface PropOsAccountReadStore {
  readonly role: "service" | "authenticated" | "anon";

  getAccount(accountId: string): Promise<PropAccountRecord | null>;
  listAccountsForUser(userId: string): Promise<PropAccountRecord[]>;

  getChallenge(challengeId: string): Promise<PropChallengeRecord | null>;
  listChallengesForAccount(accountId: string): Promise<PropChallengeRecord[]>;
  listChallengesForUser(userId: string): Promise<PropChallengeRecord[]>;

  getRuleSnapshot(challengeId: string): Promise<PropRuleSnapshotRecord | null>;

  getAssignment(userId: string, tradeClientId: string): Promise<PropTradeAssignmentRecord | null>;
  listAssignmentsForUser(userId: string): Promise<PropTradeAssignmentRecord[]>;
  listAssignmentsForChallenge(challengeId: string): Promise<PropTradeAssignmentRecord[]>;
  listActiveAssignedTradeIds(userId: string): Promise<Set<string>>;

  getDefaultAccountId(userId: string): Promise<string | null>;
  /** Preference only — not authorization. */
  getSelectedChallengeId(userId: string): Promise<string | null>;

  getLatestEngineSnapshot(challengeId: string): Promise<EngineSnapshotRow | null>;
  getLatestScoreSnapshot(challengeId: string): Promise<ScoreSnapshotRow | null>;
}

export type { ChallengeTransitionRecord };
