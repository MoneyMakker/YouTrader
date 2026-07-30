/**
 * Phase 1D AccountManagementStore over local PostgreSQL via psql.
 * No permanent `pg` package. Production migrations unchanged.
 */
import type { AccountManagementStore } from "../src/propOs/accounts/store";
import { fromDbAssignmentState, toDbAssignmentState } from "../src/propOs/accounts/assignmentState";
import type {
  ChallengeTransitionRecord,
  PropAccountRecord,
  PropChallengeRecord,
  PropRuleSnapshotRecord,
  PropTradeAssignmentRecord,
} from "../src/propOs/accounts/types";
import { isActiveChallengeStatus } from "../src/propOs/accounts/transitions";
import type { EngineSnapshotRow, ScoreSnapshotRow } from "../src/propOs/shadow/types";
import {
  fixtureUuid,
  psql,
  psqlJson,
  sqlJson,
  sqlLiteral,
  sqlNullableLiteral,
} from "./prop-os-psql-bridge";

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
    resetOfChallengeId: row.reset_of_challenge_id ? String(row.reset_of_challenge_id) : null,
    breachLocked: Boolean(row.breach_locked),
    createdAt: iso(String(row.created_at))!,
    updatedAt: iso(String(row.updated_at))!,
  };
}

/**
 * Phase 1E: preferences come from migration `prop_os_user_preferences`.
 * Keep this helper as a no-op assert so older QA docs still call it safely.
 * Do not recreate QA-only `prop_os_internal_prefs`.
 */
export function ensureInternalPrefsTable(db: string): void {
  const exists = psql(
    db,
    `select to_regclass('public.prop_os_user_preferences') is not null`,
  );
  if (exists !== "t" && exists !== "true") {
    throw new Error(
      "prop_os_user_preferences missing — apply Phase 1E migration locally before accounts PG QA",
    );
  }
}

export function ensureAuthUser(db: string, userId: string, email: string): void {
  psql(
    db,
    `insert into auth.users (id, email) values (${sqlLiteral(userId)}::uuid, ${sqlLiteral(email)})
     on conflict (id) do nothing`,
  );
}

export function createPsqlAccountStore(db: string): AccountManagementStore {
  return {
    role: "service",

    async insertAccount(row) {
      psql(
        db,
        `set role service_role;
         insert into public.prop_accounts (
           id, user_id, firm_key, label, account_size_minor, currency, firm_timezone,
           status, source, schema_version, created_at, archived_at, updated_at
         ) values (
           ${sqlLiteral(row.id)}::uuid,
           ${sqlLiteral(row.userId)}::uuid,
           ${sqlNullableLiteral(row.firmKey)},
           ${sqlLiteral(row.label)},
           ${row.accountSizeMinor},
           ${sqlLiteral(row.currency)},
           ${sqlLiteral(row.firmTimezone)},
           ${sqlLiteral(row.status)},
           ${sqlLiteral(row.source)},
           'prop-os-schema-v0',
           ${sqlLiteral(row.createdAt)}::timestamptz,
           ${row.archivedAt ? `${sqlLiteral(row.archivedAt)}::timestamptz` : "null"},
           ${sqlLiteral(row.updatedAt)}::timestamptz
         );
         reset role;`,
      );
      return (await this.getAccount(row.id))!;
    },

    async updateAccount(row) {
      psql(
        db,
        `set role service_role;
         update public.prop_accounts set
           label = ${sqlLiteral(row.label)},
           status = ${sqlLiteral(row.status)},
           archived_at = ${row.archivedAt ? `${sqlLiteral(row.archivedAt)}::timestamptz` : "null"},
           updated_at = ${sqlLiteral(row.updatedAt)}::timestamptz
         where id = ${sqlLiteral(row.id)}::uuid;
         reset role;`,
      );
      return (await this.getAccount(row.id))!;
    },

    async getAccount(accountId) {
      const row = psqlJson<Record<string, unknown> | null>(
        db,
        `select row_to_json(t) from public.prop_accounts t where id = ${sqlLiteral(accountId)}::uuid`,
      );
      return row ? mapAccount(row) : null;
    },

    async listAccountsForUser(userId) {
      const rows =
        psqlJson<Record<string, unknown>[]>(
          db,
          `select coalesce(json_agg(row_to_json(t)), '[]'::json)
           from public.prop_accounts t where user_id = ${sqlLiteral(userId)}::uuid`,
        ) ?? [];
      return rows.map(mapAccount);
    },

    async insertChallenge(row) {
      psql(
        db,
        `set role service_role;
         insert into public.prop_challenges (
           id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor,
           started_at, ended_at, reset_of_challenge_id, breach_locked, schema_version, created_at, updated_at
         ) values (
           ${sqlLiteral(row.id)}::uuid,
           ${sqlLiteral(row.userId)}::uuid,
           ${sqlLiteral(row.accountId)}::uuid,
           ${sqlLiteral(row.phase)},
           ${sqlLiteral(row.status)},
           ${sqlLiteral(row.ruleSetVersion)},
           ${row.startingBalanceMinor},
           ${sqlLiteral(row.startedAt)}::timestamptz,
           ${row.endedAt ? `${sqlLiteral(row.endedAt)}::timestamptz` : "null"},
           ${row.resetOfChallengeId ? `${sqlLiteral(row.resetOfChallengeId)}::uuid` : "null"},
           ${row.breachLocked ? "true" : "false"},
           'prop-os-schema-v0',
           ${sqlLiteral(row.createdAt)}::timestamptz,
           ${sqlLiteral(row.updatedAt)}::timestamptz
         );
         reset role;`,
      );
      return (await this.getChallenge(row.id))!;
    },

    async updateChallenge(row) {
      psql(
        db,
        `set role service_role;
         update public.prop_challenges set
           status = ${sqlLiteral(row.status)},
           ended_at = ${row.endedAt ? `${sqlLiteral(row.endedAt)}::timestamptz` : "null"},
           breach_locked = ${row.breachLocked ? "true" : "false"},
           updated_at = ${sqlLiteral(row.updatedAt)}::timestamptz
         where id = ${sqlLiteral(row.id)}::uuid;
         reset role;`,
      );
      return (await this.getChallenge(row.id))!;
    },

    async getChallenge(challengeId) {
      const row = psqlJson<Record<string, unknown> | null>(
        db,
        `select row_to_json(t) from public.prop_challenges t where id = ${sqlLiteral(challengeId)}::uuid`,
      );
      return row ? mapChallenge(row) : null;
    },

    async listChallengesForAccount(accountId) {
      const rows =
        psqlJson<Record<string, unknown>[]>(
          db,
          `select coalesce(json_agg(row_to_json(t)), '[]'::json)
           from public.prop_challenges t where account_id = ${sqlLiteral(accountId)}::uuid`,
        ) ?? [];
      return rows.map(mapChallenge);
    },

    async listChallengesForUser(userId) {
      const rows =
        psqlJson<Record<string, unknown>[]>(
          db,
          `select coalesce(json_agg(row_to_json(t)), '[]'::json)
           from public.prop_challenges t where user_id = ${sqlLiteral(userId)}::uuid`,
        ) ?? [];
      return rows.map(mapChallenge);
    },

    async insertRuleSnapshot(row) {
      psql(
        db,
        `set role service_role;
         insert into public.prop_challenge_rule_snapshots (
           id, user_id, challenge_id, rule_set_version, snapshot, template_key,
           template_version_at_capture, captured_at, schema_version
         ) values (
           ${sqlLiteral(row.id)}::uuid,
           ${sqlLiteral(row.userId)}::uuid,
           ${sqlLiteral(row.challengeId)}::uuid,
           ${sqlLiteral(row.ruleSetVersion)},
           ${sqlJson(row.snapshot)},
           ${sqlNullableLiteral(row.templateKey)},
           ${sqlNullableLiteral(row.templateVersionAtCapture)},
           ${sqlLiteral(row.capturedAt)}::timestamptz,
           'prop-os-schema-v0'
         );
         reset role;`,
      );
      return (await this.getRuleSnapshot(row.challengeId))!;
    },

    async getRuleSnapshot(challengeId) {
      const row = psqlJson<Record<string, unknown> | null>(
        db,
        `select row_to_json(t) from public.prop_challenge_rule_snapshots t
         where challenge_id = ${sqlLiteral(challengeId)}::uuid`,
      );
      if (!row) return null;
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
    },

    async getAssignment(userId, tradeClientId) {
      const row = psqlJson<Record<string, unknown> | null>(
        db,
        `select row_to_json(t) from public.prop_trade_assignments t
         where user_id = ${sqlLiteral(userId)}::uuid and trade_client_id = ${sqlLiteral(tradeClientId)}`,
      );
      return row ? mapAssignment(row) : null;
    },

    async upsertAssignment(row) {
      const dbState = toDbAssignmentState(row.state);
      psql(
        db,
        `set role service_role;
         insert into public.prop_trade_assignments (
           id, user_id, trade_client_id, account_id, challenge_id, assignment_state,
           assigned_at, assigned_by, provenance, schema_version, created_at, updated_at
         ) values (
           ${sqlLiteral(row.id)}::uuid,
           ${sqlLiteral(row.userId)}::uuid,
           ${sqlLiteral(row.tradeClientId)},
           ${row.accountId ? `${sqlLiteral(row.accountId)}::uuid` : "null"},
           ${row.challengeId ? `${sqlLiteral(row.challengeId)}::uuid` : "null"},
           ${sqlLiteral(dbState)},
           ${row.assignedAt ? `${sqlLiteral(row.assignedAt)}::timestamptz` : "null"},
           ${sqlNullableLiteral(row.assignedBy)},
           ${sqlJson(row.provenance)},
           'prop-os-schema-v0',
           ${sqlLiteral(row.createdAt)}::timestamptz,
           ${sqlLiteral(row.updatedAt)}::timestamptz
         )
         on conflict (user_id, trade_client_id) do update set
           account_id = excluded.account_id,
           challenge_id = excluded.challenge_id,
           assignment_state = excluded.assignment_state,
           assigned_at = excluded.assigned_at,
           assigned_by = excluded.assigned_by,
           provenance = excluded.provenance,
           updated_at = excluded.updated_at;
         reset role;`,
      );
      return (await this.getAssignment(row.userId, row.tradeClientId))!;
    },

    async listAssignmentsForUser(userId) {
      const rows =
        psqlJson<Record<string, unknown>[]>(
          db,
          `select coalesce(json_agg(row_to_json(t)), '[]'::json)
           from public.prop_trade_assignments t where user_id = ${sqlLiteral(userId)}::uuid`,
        ) ?? [];
      return rows.map(mapAssignment);
    },

    async listAssignmentsForChallenge(challengeId) {
      const rows =
        psqlJson<Record<string, unknown>[]>(
          db,
          `select coalesce(json_agg(row_to_json(t)), '[]'::json)
           from public.prop_trade_assignments t where challenge_id = ${sqlLiteral(challengeId)}::uuid`,
        ) ?? [];
      return rows.map(mapAssignment);
    },

    async listActiveAssignedTradeIds(userId) {
      const challenges = await this.listChallengesForUser(userId);
      const active = new Set(
        challenges.filter((c) => isActiveChallengeStatus(c.status)).map((c) => c.id),
      );
      const asg = await this.listAssignmentsForUser(userId);
      const out = new Set<string>();
      for (const a of asg) {
        if (
          a.challengeId &&
          active.has(a.challengeId) &&
          (a.state === "assigned_manual" || a.state === "assigned_verified_import")
        ) {
          out.add(a.tradeClientId);
        }
      }
      return out;
    },

    async insertTransition(row: ChallengeTransitionRecord) {
      psql(
        db,
        `set role service_role;
         insert into public.prop_challenge_transitions (
           id, user_id, challenge_id, from_status, to_status, reason_code, evidence, actor, at, schema_version
         ) values (
           ${sqlLiteral(row.id)}::uuid,
           ${sqlLiteral(row.userId)}::uuid,
           ${sqlLiteral(row.challengeId)}::uuid,
           ${sqlNullableLiteral(row.fromStatus)},
           ${sqlLiteral(row.toStatus)},
           ${sqlLiteral(row.reasonCode)},
           ${sqlJson(row.evidence)},
           ${sqlLiteral(row.actor)},
           ${sqlLiteral(row.at)}::timestamptz,
           'prop-os-schema-v0'
         );
         reset role;`,
      );
      return row;
    },

    async getDefaultAccountId(userId) {
      const v = psql(
        db,
        `select default_account_id::text from public.prop_os_user_preferences
         where user_id = ${sqlLiteral(userId)}::uuid`,
      );
      return v || null;
    },

    async setDefaultAccountId(userId, accountId) {
      psql(
        db,
        `set role service_role;
         insert into public.prop_os_user_preferences (user_id, default_account_id, updated_at)
         values (
           ${sqlLiteral(userId)}::uuid,
           ${accountId ? `${sqlLiteral(accountId)}::uuid` : "null"},
           now()
         )
         on conflict (user_id) do update set
           default_account_id = excluded.default_account_id,
           updated_at = now();
         reset role;`,
      );
    },

    async getLatestEngineSnapshot(challengeId) {
      return psqlJson<EngineSnapshotRow | null>(
        db,
        `select row_to_json(t) from public.prop_engine_snapshots t
         where challenge_id = ${sqlLiteral(challengeId)}::uuid
         order by calculated_at desc limit 1`,
      );
    },

    async getLatestScoreSnapshot(challengeId) {
      return psqlJson<ScoreSnapshotRow | null>(
        db,
        `select row_to_json(t) from public.prop_score_snapshots t
         where challenge_id = ${sqlLiteral(challengeId)}::uuid
         order by calculated_at desc limit 1`,
      );
    },
  };
}

function mapAssignment(row: Record<string, unknown>): PropTradeAssignmentRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tradeClientId: String(row.trade_client_id),
    accountId: row.account_id ? String(row.account_id) : null,
    challengeId: row.challenge_id ? String(row.challenge_id) : null,
    state: fromDbAssignmentState(String(row.assignment_state)),
    assignedAt: iso(row.assigned_at as string | null),
    assignedBy: (row.assigned_by as PropTradeAssignmentRecord["assignedBy"]) ?? null,
    provenance: row.provenance as PropTradeAssignmentRecord["provenance"],
    createdAt: iso(String(row.created_at))!,
    updatedAt: iso(String(row.updated_at))!,
  };
}

export { fixtureUuid };
