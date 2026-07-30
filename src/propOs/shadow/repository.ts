import type {
  AccountEventRow,
  AccountRow,
  ChallengeRow,
  EngineSnapshotRow,
  ExecutionRow,
  RuleSnapshotRow,
  ScoreSnapshotRow,
} from "./types";

/**
 * Repository contract for shadow pipeline.
 * Implementations must not recalculate domain math.
 */
export interface ShadowRepository {
  readonly role: "service" | "authenticated" | "anon";

  getAccount(accountId: string): Promise<AccountRow | null>;
  getChallenge(challengeId: string): Promise<ChallengeRow | null>;
  getRuleSnapshot(challengeId: string): Promise<RuleSnapshotRow | null>;
  listExecutions(challengeId: string): Promise<ExecutionRow[]>;
  listAccountEvents(challengeId: string): Promise<AccountEventRow[]>;

  findEngineSnapshot(keys: {
    challengeId: string;
    calculationVersion: string;
    ruleSetVersion: string;
    inputRevision: string;
  }): Promise<EngineSnapshotRow | null>;

  findScoreSnapshot(keys: {
    challengeId: string;
    calculationVersion: string;
    ruleSetVersion: string;
    inputRevision: string;
  }): Promise<ScoreSnapshotRow | null>;

  insertEngineSnapshot(row: EngineSnapshotRow): Promise<EngineSnapshotRow>;
  insertScoreSnapshot(row: ScoreSnapshotRow): Promise<ScoreSnapshotRow>;
}

export type SeedableShadowRepository = ShadowRepository & {
  seedAccount(row: AccountRow): void;
  seedChallenge(row: ChallengeRow): void;
  seedRuleSnapshot(row: RuleSnapshotRow): void;
  seedExecution(row: ExecutionRow): void;
  seedAccountEvent(row: AccountEventRow): void;
  setWriteFailure(next: boolean): void;
  asRole(role: ShadowRepository["role"]): ShadowRepository;
};
