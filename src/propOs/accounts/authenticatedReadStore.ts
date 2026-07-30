/**
 * Authenticated, read-only AccountManagementStore.
 * Mutations throw. Uses PropOsReadTransport (Supabase session or local RLS adapter).
 */

import { AccountMgmtError } from "./errors";
import { fromDbAssignmentState } from "./assignmentState";
import { isActiveChallengeStatus } from "./transitions";
import type { AccountManagementStore } from "./store";
import type {
  AssignmentProvenance,
  ChallengeTransitionRecord,
  PropAccountRecord,
  PropChallengeRecord,
  PropRuleSnapshotRecord,
  PropTradeAssignmentRecord,
} from "./types";
import type { EngineSnapshotRow, ScoreSnapshotRow } from "../shadow/types";
import type { PropOsReadTransport } from "./authenticatedReadTransport";

function iso(v: string | null | undefined): string | null {
  if (v == null) return null;
  return new Date(v).toISOString();
}

function mapAccount(row: Record<string, unknown>): PropAccountRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    firmKey: (row.firm_key as string | null) ?? null,
    label: String(row.label),
    accountSizeMinor: Number(row.account_size_minor),
    currency: String(row.currency),
    firmTimezone: String(row.firm_timezone),
    status: row.status as PropAccountRecord["status"],
    source: row.source as PropAccountRecord["source"],
    createdAt: iso(String(row.created_at))!,
    archivedAt: iso(row.archived_at as string | null),
    updatedAt: iso(String(row.updated_at))!,
  };
}

function mapChallenge(row: Record<string, unknown>): PropChallengeRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    accountId: String(row.account_id),
    phase: row.phase as PropChallengeRecord["phase"],
    status: row.status as PropChallengeRecord["status"],
    ruleSetVersion: String(row.rule_set_version),
    startingBalanceMinor: Number(row.starting_balance_minor),
    startedAt: iso(String(row.started_at))!,
    endedAt: iso(row.ended_at as string | null),
    resetOfChallengeId: row.reset_of_challenge_id
      ? String(row.reset_of_challenge_id)
      : null,
    breachLocked: Boolean(row.breach_locked),
    createdAt: iso(String(row.created_at))!,
    updatedAt: iso(String(row.updated_at))!,
  };
}

function mapRule(row: Record<string, unknown>): PropRuleSnapshotRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    challengeId: String(row.challenge_id),
    ruleSetVersion: String(row.rule_set_version),
    snapshot: row.snapshot as PropRuleSnapshotRecord["snapshot"],
    templateKey: (row.template_key as string | null) ?? null,
    templateVersionAtCapture: (row.template_version_at_capture as string | null) ?? null,
    capturedAt: iso(String(row.captured_at))!,
  };
}

function mapAssignment(row: Record<string, unknown>): PropTradeAssignmentRecord {
  const provenance = (row.provenance ?? {}) as AssignmentProvenance;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tradeClientId: String(row.trade_client_id),
    accountId: row.account_id ? String(row.account_id) : null,
    challengeId: row.challenge_id ? String(row.challenge_id) : null,
    state: fromDbAssignmentState(String(row.assignment_state)),
    assignedAt: iso(row.assigned_at as string | null),
    assignedBy: (row.assigned_by as PropTradeAssignmentRecord["assignedBy"]) ?? null,
    provenance,
    createdAt: iso(String(row.created_at))!,
    updatedAt: iso(String(row.updated_at))!,
  };
}

function mapEngine(row: Record<string, unknown>): EngineSnapshotRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    challenge_id: String(row.challenge_id),
    calculation_version: String(row.calculation_version),
    rule_set_version: String(row.rule_set_version),
    input_revision: String(row.input_revision),
    calculated_at: iso(String(row.calculated_at))!,
    status: String(row.status),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    confidence: (row.confidence ?? {}) as Record<string, unknown>,
    limitations: row.limitations ?? [],
    readiness_model_version: (row.readiness_model_version as string | null) ?? null,
    confidence_policy_version: String(row.confidence_policy_version),
    fixture_contract_version: (row.fixture_contract_version as string | null) ?? null,
    backfill_version: (row.backfill_version as string | null) ?? null,
    migration_plan_version: (row.migration_plan_version as string | null) ?? null,
    schema_version: String(row.schema_version),
    created_at: iso(String(row.created_at))!,
  };
}

function mapScore(row: Record<string, unknown>): ScoreSnapshotRow {
  return {
    ...mapEngine(row),
  };
}

function denyWrite(op: string): never {
  throw new AccountMgmtError("forbidden", `authenticated Prop OS store is read-only (${op})`);
}

/**
 * Read-only store for internal/staging activation gateway.
 * RLS must enforce owner scope; this store does not elevate privileges.
 */
export function createAuthenticatedPropOsReadStore(
  transport: PropOsReadTransport,
): AccountManagementStore {
  return {
    role: "authenticated",

    insertAccount: async () => denyWrite("insertAccount"),
    updateAccount: async () => denyWrite("updateAccount"),
    insertChallenge: async () => denyWrite("insertChallenge"),
    updateChallenge: async () => denyWrite("updateChallenge"),
    insertRuleSnapshot: async () => denyWrite("insertRuleSnapshot"),
    upsertAssignment: async () => denyWrite("upsertAssignment"),
    insertTransition: async () => denyWrite("insertTransition"),
    setDefaultAccountId: async () => denyWrite("setDefaultAccountId"),

    async getAccount(accountId) {
      const rows = await transport.selectRows("prop_accounts", { id: accountId }, { limit: 1 });
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    async listAccountsForUser(userId) {
      const rows = await transport.selectRows("prop_accounts", { user_id: userId });
      return rows.map(mapAccount);
    },

    async getChallenge(challengeId) {
      const rows = await transport.selectRows(
        "prop_challenges",
        { id: challengeId },
        { limit: 1 },
      );
      return rows[0] ? mapChallenge(rows[0]) : null;
    },

    async listChallengesForAccount(accountId) {
      const rows = await transport.selectRows("prop_challenges", { account_id: accountId });
      return rows.map(mapChallenge);
    },

    async listChallengesForUser(userId) {
      const rows = await transport.selectRows("prop_challenges", { user_id: userId });
      return rows.map(mapChallenge);
    },

    async getRuleSnapshot(challengeId) {
      const rows = await transport.selectRows(
        "prop_challenge_rule_snapshots",
        { challenge_id: challengeId },
        { limit: 1 },
      );
      return rows[0] ? mapRule(rows[0]) : null;
    },

    async getAssignment(userId, tradeClientId) {
      const rows = await transport.selectRows("prop_trade_assignments", {
        user_id: userId,
        trade_client_id: tradeClientId,
      });
      return rows[0] ? mapAssignment(rows[0]) : null;
    },

    async listAssignmentsForUser(userId) {
      const rows = await transport.selectRows("prop_trade_assignments", {
        user_id: userId,
      });
      return rows.map(mapAssignment);
    },

    async listAssignmentsForChallenge(challengeId) {
      const rows = await transport.selectRows("prop_trade_assignments", {
        challenge_id: challengeId,
      });
      return rows.map(mapAssignment);
    },

    async listActiveAssignedTradeIds(userId) {
      const assignments = await this.listAssignmentsForUser(userId);
      const challenges = await this.listChallengesForUser(userId);
      const activeIds = new Set(
        challenges.filter((c) => isActiveChallengeStatus(c.status)).map((c) => c.id),
      );
      const out = new Set<string>();
      for (const a of assignments) {
        if (
          a.challengeId &&
          activeIds.has(a.challengeId) &&
          (a.state === "assigned_manual" || a.state === "assigned_verified_import")
        ) {
          out.add(a.tradeClientId);
        }
      }
      return out;
    },

    async getDefaultAccountId(userId) {
      const rows = await transport.selectRows(
        "prop_os_user_preferences",
        { user_id: userId },
        { limit: 1 },
      );
      const id = rows[0]?.default_account_id;
      return id ? String(id) : null;
    },

    async getLatestEngineSnapshot(challengeId) {
      const rows = await transport.selectRows(
        "prop_engine_snapshots",
        { challenge_id: challengeId },
        { orderBy: "calculated_at", ascending: false, limit: 1 },
      );
      return rows[0] ? mapEngine(rows[0]) : null;
    },

    async getLatestScoreSnapshot(challengeId) {
      const rows = await transport.selectRows(
        "prop_score_snapshots",
        { challenge_id: challengeId },
        { orderBy: "calculated_at", ascending: false, limit: 1 },
      );
      return rows[0] ? mapScore(rows[0]) : null;
    },
  };
}

export type { ChallengeTransitionRecord };
