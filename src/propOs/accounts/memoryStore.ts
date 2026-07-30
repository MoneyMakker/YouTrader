import type { EngineSnapshotRow, ScoreSnapshotRow } from "../shadow/types";
import type { AccountManagementStore } from "./store";
import type {
  ChallengeTransitionRecord,
  PropAccountRecord,
  PropChallengeRecord,
  PropRuleSnapshotRecord,
  PropTradeAssignmentRecord,
} from "./types";
import { isActiveChallengeStatus } from "./transitions";

/**
 * In-memory service-role store for isolated Phase 1D QA.
 */
export function createMemoryAccountStore(): AccountManagementStore & {
  asRole(role: AccountManagementStore["role"]): AccountManagementStore;
} {
  const accounts = new Map<string, PropAccountRecord>();
  const challenges = new Map<string, PropChallengeRecord>();
  const rules = new Map<string, PropRuleSnapshotRecord>();
  const assignments = new Map<string, PropTradeAssignmentRecord>(); // userId::tradeClientId
  const transitions: ChallengeTransitionRecord[] = [];
  const defaults = new Map<string, string | null>();
  const engineSnaps = new Map<string, EngineSnapshotRow[]>();
  const scoreSnaps = new Map<string, ScoreSnapshotRow[]>();

  const key = (userId: string, tradeClientId: string) => `${userId}::${tradeClientId}`;

  const service: AccountManagementStore & {
    asRole(role: AccountManagementStore["role"]): AccountManagementStore;
  } = {
    role: "service",

    asRole(role) {
      if (role === "service") return service;
      return {
        role,
        insertAccount: async () => {
          throw Object.assign(new Error(`role ${role} denied`), { failure: "forbidden" });
        },
        updateAccount: async () => {
          throw Object.assign(new Error(`role ${role} denied`), { failure: "forbidden" });
        },
        getAccount: (id) => service.getAccount(id),
        listAccountsForUser: (u) => service.listAccountsForUser(u),
        insertChallenge: async () => {
          throw Object.assign(new Error(`role ${role} denied`), { failure: "forbidden" });
        },
        updateChallenge: async () => {
          throw Object.assign(new Error(`role ${role} denied`), { failure: "forbidden" });
        },
        getChallenge: (id) => service.getChallenge(id),
        listChallengesForAccount: (id) => service.listChallengesForAccount(id),
        listChallengesForUser: (u) => service.listChallengesForUser(u),
        insertRuleSnapshot: async () => {
          throw Object.assign(new Error(`role ${role} denied`), { failure: "forbidden" });
        },
        getRuleSnapshot: (id) => service.getRuleSnapshot(id),
        getAssignment: (u, t) => service.getAssignment(u, t),
        upsertAssignment: async () => {
          throw Object.assign(new Error(`role ${role} denied`), { failure: "forbidden" });
        },
        listAssignmentsForUser: (u) => service.listAssignmentsForUser(u),
        listAssignmentsForChallenge: (id) => service.listAssignmentsForChallenge(id),
        listActiveAssignedTradeIds: (u) => service.listActiveAssignedTradeIds(u),
        insertTransition: async () => {
          throw Object.assign(new Error(`role ${role} denied`), { failure: "forbidden" });
        },
        getDefaultAccountId: (u) => service.getDefaultAccountId(u),
        setDefaultAccountId: async () => {
          throw Object.assign(new Error(`role ${role} denied`), { failure: "forbidden" });
        },
        getLatestEngineSnapshot: (id) => service.getLatestEngineSnapshot(id),
        getLatestScoreSnapshot: (id) => service.getLatestScoreSnapshot(id),
      };
    },

    async insertAccount(row) {
      if (accounts.has(row.id)) throw new Error("duplicate account");
      accounts.set(row.id, row);
      return row;
    },
    async updateAccount(row) {
      accounts.set(row.id, row);
      return row;
    },
    async getAccount(id) {
      return accounts.get(id) ?? null;
    },
    async listAccountsForUser(userId) {
      return [...accounts.values()].filter((a) => a.userId === userId);
    },

    async insertChallenge(row) {
      if (challenges.has(row.id)) throw new Error("duplicate challenge");
      challenges.set(row.id, row);
      return row;
    },
    async updateChallenge(row) {
      challenges.set(row.id, row);
      return row;
    },
    async getChallenge(id) {
      return challenges.get(id) ?? null;
    },
    async listChallengesForAccount(accountId) {
      return [...challenges.values()].filter((c) => c.accountId === accountId);
    },
    async listChallengesForUser(userId) {
      return [...challenges.values()].filter((c) => c.userId === userId);
    },

    async insertRuleSnapshot(row) {
      if ([...rules.values()].some((r) => r.challengeId === row.challengeId)) {
        throw new Error("rule snapshot already exists for challenge");
      }
      rules.set(row.challengeId, row);
      return row;
    },
    async getRuleSnapshot(challengeId) {
      return rules.get(challengeId) ?? null;
    },

    async getAssignment(userId, tradeClientId) {
      return assignments.get(key(userId, tradeClientId)) ?? null;
    },
    async upsertAssignment(row) {
      assignments.set(key(row.userId, row.tradeClientId), row);
      return row;
    },
    async listAssignmentsForUser(userId) {
      return [...assignments.values()].filter((a) => a.userId === userId);
    },
    async listAssignmentsForChallenge(challengeId) {
      return [...assignments.values()].filter((a) => a.challengeId === challengeId);
    },
    async listActiveAssignedTradeIds(userId) {
      const activeChallengeIds = new Set(
        [...challenges.values()]
          .filter((c) => c.userId === userId && isActiveChallengeStatus(c.status))
          .map((c) => c.id),
      );
      const out = new Set<string>();
      for (const a of assignments.values()) {
        if (
          a.userId === userId &&
          a.challengeId &&
          activeChallengeIds.has(a.challengeId) &&
          (a.state === "assigned_manual" || a.state === "assigned_verified_import")
        ) {
          out.add(a.tradeClientId);
        }
      }
      return out;
    },

    async insertTransition(row) {
      transitions.push(row);
      return row;
    },

    async getDefaultAccountId(userId) {
      return defaults.has(userId) ? (defaults.get(userId) ?? null) : null;
    },
    async setDefaultAccountId(userId, accountId) {
      defaults.set(userId, accountId);
    },

    async getLatestEngineSnapshot(challengeId) {
      const list = engineSnaps.get(challengeId) ?? [];
      return list.length ? list[list.length - 1]! : null;
    },
    async getLatestScoreSnapshot(challengeId) {
      const list = scoreSnaps.get(challengeId) ?? [];
      return list.length ? list[list.length - 1]! : null;
    },
    async putEngineSnapshot(row) {
      const list = engineSnaps.get(row.challenge_id) ?? [];
      list.push(row);
      engineSnaps.set(row.challenge_id, list);
    },
    async putScoreSnapshot(row) {
      const list = scoreSnaps.get(row.challenge_id) ?? [];
      list.push(row);
      scoreSnaps.set(row.challenge_id, list);
    },
  };

  return service;
}

export function freshId(_prefix: string): string {
  // UUID-shaped ids so the same service can persist to PostgreSQL without a driver.
  const h = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}
