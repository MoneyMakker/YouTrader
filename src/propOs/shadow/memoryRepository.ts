import type {
  AccountEventRow,
  AccountRow,
  ChallengeRow,
  EngineSnapshotRow,
  ExecutionRow,
  RuleSnapshotRow,
  ScoreSnapshotRow,
} from "./types";
import type { SeedableShadowRepository, ShadowRepository } from "./repository";

function denyWrite(role: ShadowRepository["role"]): never {
  throw Object.assign(new Error(`role ${role} denied snapshot write`), {
    failure: "snapshot_write_failure" as const,
    code: "rls_denied",
  });
}

/**
 * In-memory service-role store for isolated shadow QA.
 * Authenticated/anon wrappers deny writes (Phase 1A deny-by-default model).
 */
export function createMemoryShadowRepository(): SeedableShadowRepository {
  const accounts = new Map<string, AccountRow>();
  const challenges = new Map<string, ChallengeRow>();
  const rules = new Map<string, RuleSnapshotRow>();
  const executions: ExecutionRow[] = [];
  const accountEvents: AccountEventRow[] = [];
  const engineSnaps: EngineSnapshotRow[] = [];
  const scoreSnaps: ScoreSnapshotRow[] = [];
  let writeFail = false;

  const service: SeedableShadowRepository = {
    role: "service",

    seedAccount(row) {
      accounts.set(row.id, row);
    },
    seedChallenge(row) {
      challenges.set(row.id, row);
    },
    seedRuleSnapshot(row) {
      rules.set(row.challenge_id, row);
    },
    seedExecution(row) {
      executions.push(row);
    },
    seedAccountEvent(row) {
      accountEvents.push(row);
    },
    setWriteFailure(next) {
      writeFail = next;
    },
    asRole(role) {
      if (role === "service") return service;
      return createDeniedRepo(role, service);
    },

    async getAccount(id) {
      return accounts.get(id) ?? null;
    },
    async getChallenge(id) {
      return challenges.get(id) ?? null;
    },
    async getRuleSnapshot(challengeId) {
      return rules.get(challengeId) ?? null;
    },
    async listExecutions(challengeId) {
      // Intentionally unsorted — mapper/runner must not rely on DB order.
      const ch = challenges.get(challengeId);
      const userId = ch?.user_id;
      return executions.filter(
        (e) =>
          e.challenge_id === challengeId ||
          (e.challenge_id == null && userId != null && e.user_id === userId),
      );
    },
    async listAccountEvents(challengeId) {
      return accountEvents.filter((e) => e.challenge_id === challengeId);
    },
    async findEngineSnapshot(keys) {
      return (
        engineSnaps.find(
          (s) =>
            s.challenge_id === keys.challengeId &&
            s.calculation_version === keys.calculationVersion &&
            s.rule_set_version === keys.ruleSetVersion &&
            s.input_revision === keys.inputRevision,
        ) ?? null
      );
    },
    async findScoreSnapshot(keys) {
      return (
        scoreSnaps.find(
          (s) =>
            s.challenge_id === keys.challengeId &&
            s.calculation_version === keys.calculationVersion &&
            s.rule_set_version === keys.ruleSetVersion &&
            s.input_revision === keys.inputRevision,
        ) ?? null
      );
    },
    async insertEngineSnapshot(row) {
      if (writeFail) {
        throw Object.assign(new Error("forced snapshot write failure"), {
          failure: "snapshot_write_failure" as const,
        });
      }
      const existing = await service.findEngineSnapshot({
        challengeId: row.challenge_id,
        calculationVersion: row.calculation_version,
        ruleSetVersion: row.rule_set_version,
        inputRevision: row.input_revision,
      });
      if (existing) {
        // Unique key collision treated as confirm path by runner; store keeps first.
        return existing;
      }
      engineSnaps.push(row);
      return row;
    },
    async insertScoreSnapshot(row) {
      if (writeFail) {
        throw Object.assign(new Error("forced snapshot write failure"), {
          failure: "snapshot_write_failure" as const,
        });
      }
      const existing = await service.findScoreSnapshot({
        challengeId: row.challenge_id,
        calculationVersion: row.calculation_version,
        ruleSetVersion: row.rule_set_version,
        inputRevision: row.input_revision,
      });
      if (existing) return existing;
      scoreSnaps.push(row);
      return row;
    },
  };

  return service;
}

function createDeniedRepo(
  role: "authenticated" | "anon",
  inner: SeedableShadowRepository,
): ShadowRepository {
  return {
    role,
    getAccount: (id) => inner.getAccount(id),
    getChallenge: (id) => inner.getChallenge(id),
    getRuleSnapshot: (id) => inner.getRuleSnapshot(id),
    listExecutions: (id) => inner.listExecutions(id),
    listAccountEvents: (id) => inner.listAccountEvents(id),
    findEngineSnapshot: (k) => inner.findEngineSnapshot(k),
    findScoreSnapshot: (k) => inner.findScoreSnapshot(k),
    insertEngineSnapshot: async () => denyWrite(role),
    insertScoreSnapshot: async () => denyWrite(role),
  };
}
