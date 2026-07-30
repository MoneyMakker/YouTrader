/**
 * ShadowRepository backed by isolated local PostgreSQL via psql.
 * Uses Phase 1C contracts only — no engine math.
 */
import type {
  AccountEventRow,
  AccountRow,
  ChallengeRow,
  EngineSnapshotRow,
  ExecutionRow,
  RuleSnapshotRow,
  ScoreSnapshotRow,
} from "../src/propOs/shadow/types";
import type { ShadowRepository } from "../src/propOs/shadow/repository";
import {
  psql,
  psqlJson,
  psqlJsonToFile,
  sqlJson,
  sqlLiteral,
  sqlNullableLiteral,
  sqlNullableNumber,
  fixtureUuid,
} from "./prop-os-psql-bridge";

function asUuid(id: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  return fixtureUuid(id);
}

function toIso(value: string | null | undefined): string | null {
  if (value == null) return null;
  return new Date(value).toISOString();
}

function normalizeAccount(row: AccountRow | null): AccountRow | null {
  return row;
}

function normalizeChallenge(row: ChallengeRow | null): ChallengeRow | null {
  if (!row) return null;
  return {
    ...row,
    started_at: toIso(row.started_at)!,
    ended_at: toIso(row.ended_at),
  };
}

function normalizeRule(row: RuleSnapshotRow | null): RuleSnapshotRow | null {
  if (!row) return null;
  return {
    ...row,
    captured_at: toIso(row.captured_at)!,
  };
}

function normalizeExecution(row: ExecutionRow): ExecutionRow {
  return {
    ...row,
    occurred_at: toIso(row.occurred_at)!,
  };
}

function normalizeAccountEvent(row: AccountEventRow): AccountEventRow {
  return {
    ...row,
    occurred_at: toIso(row.occurred_at)!,
  };
}

function normalizeEngineSnap(row: EngineSnapshotRow | null): EngineSnapshotRow | null {
  if (!row) return null;
  return {
    ...row,
    calculated_at: toIso(row.calculated_at)!,
    created_at: toIso(row.created_at)!,
  };
}

function normalizeScoreSnap(row: ScoreSnapshotRow | null): ScoreSnapshotRow | null {
  if (!row) return null;
  return {
    ...row,
    calculated_at: toIso(row.calculated_at)!,
    created_at: toIso(row.created_at)!,
  };
}

export function createPsqlShadowRepository(db: string): ShadowRepository {
  return {
    role: "service",

    async getAccount(accountId) {
      return normalizeAccount(
        psqlJson<AccountRow | null>(
          db,
          `select row_to_json(t) from public.prop_accounts t where id = ${sqlLiteral(accountId)}::uuid`,
        ),
      );
    },

    async getChallenge(challengeId) {
      return normalizeChallenge(
        psqlJson<ChallengeRow | null>(
          db,
          `select row_to_json(t) from public.prop_challenges t where id = ${sqlLiteral(challengeId)}::uuid`,
        ),
      );
    },

    async getRuleSnapshot(challengeId) {
      return normalizeRule(
        psqlJson<RuleSnapshotRow | null>(
          db,
          `select row_to_json(t) from public.prop_challenge_rule_snapshots t
           where challenge_id = ${sqlLiteral(challengeId)}::uuid
           order by captured_at desc limit 1`,
        ),
      );
    },

    async listExecutions(challengeId) {
      const ch = await this.getChallenge(challengeId);
      const userId = ch?.user_id;
      if (!userId) return [];
      const outPath = `.tmp/prop-os-shadow-roundtrip/exec-${challengeId}.json`;
      const rows =
        psqlJsonToFile<ExecutionRow[]>(
          db,
          `select coalesce(json_agg(row_to_json(t)), '[]'::json)
           from public.prop_executions t
           where challenge_id = ${sqlLiteral(challengeId)}::uuid
              or (challenge_id is null and user_id = ${sqlLiteral(userId)}::uuid)`,
          outPath,
        ) ?? [];
      return rows.map(normalizeExecution);
    },

    async listAccountEvents(challengeId) {
      const outPath = `.tmp/prop-os-shadow-roundtrip/aev-${challengeId}.json`;
      const rows =
        psqlJsonToFile<AccountEventRow[]>(
          db,
          `select coalesce(json_agg(row_to_json(t)), '[]'::json)
           from public.prop_account_events t
           where challenge_id = ${sqlLiteral(challengeId)}::uuid`,
          outPath,
        ) ?? [];
      return rows.map(normalizeAccountEvent);
    },

    async findEngineSnapshot(keys) {
      return normalizeEngineSnap(
        psqlJson<EngineSnapshotRow | null>(
          db,
          `select row_to_json(t) from public.prop_engine_snapshots t
           where challenge_id = ${sqlLiteral(keys.challengeId)}::uuid
             and calculation_version = ${sqlLiteral(keys.calculationVersion)}
             and rule_set_version = ${sqlLiteral(keys.ruleSetVersion)}
             and input_revision = ${sqlLiteral(keys.inputRevision)}
           order by calculated_at asc
           limit 1`,
        ),
      );
    },

    async findScoreSnapshot(keys) {
      return normalizeScoreSnap(
        psqlJson<ScoreSnapshotRow | null>(
          db,
          `select row_to_json(t) from public.prop_score_snapshots t
           where challenge_id = ${sqlLiteral(keys.challengeId)}::uuid
             and calculation_version = ${sqlLiteral(keys.calculationVersion)}
             and rule_set_version = ${sqlLiteral(keys.ruleSetVersion)}
             and input_revision = ${sqlLiteral(keys.inputRevision)}
           order by calculated_at asc
           limit 1`,
        ),
      );
    },

    async insertEngineSnapshot(row) {
      const existing = await this.findEngineSnapshot({
        challengeId: row.challenge_id,
        calculationVersion: row.calculation_version,
        ruleSetVersion: row.rule_set_version,
        inputRevision: row.input_revision,
      });
      if (existing) return existing;

      const id = asUuid(row.id);
      try {
        psql(
          db,
          `set role service_role;
           insert into public.prop_engine_snapshots (
             id, user_id, challenge_id, calculation_version, rule_set_version, input_revision,
             calculated_at, status, payload, confidence, limitations,
             readiness_model_version, confidence_policy_version, fixture_contract_version,
             backfill_version, migration_plan_version, schema_version, created_at
           ) values (
             ${sqlLiteral(id)}::uuid,
             ${sqlLiteral(row.user_id)}::uuid,
             ${sqlLiteral(row.challenge_id)}::uuid,
             ${sqlLiteral(row.calculation_version)},
             ${sqlLiteral(row.rule_set_version)},
             ${sqlLiteral(row.input_revision)},
             ${sqlLiteral(row.calculated_at)}::timestamptz,
             ${sqlLiteral(row.status)},
             ${sqlJson(row.payload)},
             ${sqlJson(row.confidence)},
             ${sqlJson(row.limitations)},
             ${sqlNullableLiteral(row.readiness_model_version)},
             ${sqlLiteral(row.confidence_policy_version)},
             ${sqlNullableLiteral(row.fixture_contract_version)},
             ${sqlNullableLiteral(row.backfill_version)},
             ${sqlNullableLiteral(row.migration_plan_version)},
             ${sqlLiteral(row.schema_version)},
             ${sqlLiteral(row.created_at)}::timestamptz
           );
           reset role;`,
        );
      } catch (err) {
        const msg = String((err as Error).message ?? err);
        if (/duplicate key|unique constraint/i.test(msg)) {
          const again = await this.findEngineSnapshot({
            challengeId: row.challenge_id,
            calculationVersion: row.calculation_version,
            ruleSetVersion: row.rule_set_version,
            inputRevision: row.input_revision,
          });
          if (again) return again;
        }
        throw Object.assign(new Error(msg), { failure: "snapshot_write_failure" as const });
      }

      const inserted = await this.findEngineSnapshot({
        challengeId: row.challenge_id,
        calculationVersion: row.calculation_version,
        ruleSetVersion: row.rule_set_version,
        inputRevision: row.input_revision,
      });
      if (!inserted) {
        throw Object.assign(new Error("engine snapshot insert not found after write"), {
          failure: "snapshot_write_failure" as const,
        });
      }
      return inserted;
    },

    async insertScoreSnapshot(row) {
      const existing = await this.findScoreSnapshot({
        challengeId: row.challenge_id,
        calculationVersion: row.calculation_version,
        ruleSetVersion: row.rule_set_version,
        inputRevision: row.input_revision,
      });
      if (existing) return existing;

      const id = asUuid(row.id);
      try {
        psql(
          db,
          `set role service_role;
           insert into public.prop_score_snapshots (
             id, user_id, challenge_id, calculation_version, rule_set_version, input_revision,
             calculated_at, status, payload, confidence, limitations,
             readiness_model_version, confidence_policy_version, fixture_contract_version,
             backfill_version, migration_plan_version, schema_version, created_at
           ) values (
             ${sqlLiteral(id)}::uuid,
             ${sqlLiteral(row.user_id)}::uuid,
             ${sqlLiteral(row.challenge_id)}::uuid,
             ${sqlLiteral(row.calculation_version)},
             ${sqlLiteral(row.rule_set_version)},
             ${sqlLiteral(row.input_revision)},
             ${sqlLiteral(row.calculated_at)}::timestamptz,
             ${sqlLiteral(row.status)},
             ${sqlJson(row.payload)},
             ${sqlJson(row.confidence)},
             ${sqlJson(row.limitations)},
             ${sqlNullableLiteral(row.readiness_model_version)},
             ${sqlLiteral(row.confidence_policy_version)},
             ${sqlNullableLiteral(row.fixture_contract_version)},
             ${sqlNullableLiteral(row.backfill_version)},
             ${sqlNullableLiteral(row.migration_plan_version)},
             ${sqlLiteral(row.schema_version)},
             ${sqlLiteral(row.created_at)}::timestamptz
           );
           reset role;`,
        );
      } catch (err) {
        const msg = String((err as Error).message ?? err);
        if (/duplicate key|unique constraint/i.test(msg)) {
          const again = await this.findScoreSnapshot({
            challengeId: row.challenge_id,
            calculationVersion: row.calculation_version,
            ruleSetVersion: row.rule_set_version,
            inputRevision: row.input_revision,
          });
          if (again) return again;
        }
        throw Object.assign(new Error(msg), { failure: "snapshot_write_failure" as const });
      }

      const inserted = await this.findScoreSnapshot({
        challengeId: row.challenge_id,
        calculationVersion: row.calculation_version,
        ruleSetVersion: row.rule_set_version,
        inputRevision: row.input_revision,
      });
      if (!inserted) {
        throw Object.assign(new Error("score snapshot insert not found after write"), {
          failure: "snapshot_write_failure" as const,
        });
      }
      return inserted;
    },
  };
}

export function countEngineSnapshots(db: string, challengeId: string): number {
  return Number(
    psql(
      db,
      `select count(*)::text from public.prop_engine_snapshots
       where challenge_id = ${sqlLiteral(challengeId)}::uuid`,
    ),
  );
}

export function countScoreSnapshots(db: string, challengeId: string): number {
  return Number(
    psql(
      db,
      `select count(*)::text from public.prop_score_snapshots
       where challenge_id = ${sqlLiteral(challengeId)}::uuid`,
    ),
  );
}

export function seedUser(db: string, userId: string, email: string): void {
  psql(
    db,
    `insert into auth.users (id, email) values (${sqlLiteral(userId)}::uuid, ${sqlLiteral(email)})
     on conflict (id) do nothing`,
  );
}

export function seedAccount(db: string, row: AccountRow): void {
  psql(
    db,
    `insert into public.prop_accounts (
      id, user_id, firm_key, label, account_size_minor, currency, firm_timezone, status, source, schema_version
    ) values (
      ${sqlLiteral(row.id)}::uuid,
      ${sqlLiteral(row.user_id)}::uuid,
      ${sqlNullableLiteral(row.firm_key)},
      ${sqlLiteral(row.label)},
      ${row.account_size_minor},
      ${sqlLiteral(row.currency)},
      ${sqlLiteral(row.firm_timezone)},
      ${sqlLiteral(row.status)},
      ${sqlLiteral(row.source)},
      ${sqlLiteral(row.schema_version)}
    ) on conflict (id) do nothing`,
  );
}

export function seedChallenge(db: string, row: ChallengeRow): void {
  psql(
    db,
    `insert into public.prop_challenges (
      id, user_id, account_id, phase, status, rule_set_version, starting_balance_minor,
      started_at, ended_at, reset_of_challenge_id, breach_locked, schema_version
    ) values (
      ${sqlLiteral(row.id)}::uuid,
      ${sqlLiteral(row.user_id)}::uuid,
      ${sqlLiteral(row.account_id)}::uuid,
      ${sqlLiteral(row.phase)},
      ${sqlLiteral(row.status)},
      ${sqlLiteral(row.rule_set_version)},
      ${row.starting_balance_minor},
      ${sqlLiteral(row.started_at)}::timestamptz,
      ${row.ended_at ? `${sqlLiteral(row.ended_at)}::timestamptz` : "null"},
      ${row.reset_of_challenge_id ? `${sqlLiteral(row.reset_of_challenge_id)}::uuid` : "null"},
      ${row.breach_locked ? "true" : "false"},
      ${sqlLiteral(row.schema_version)}
    ) on conflict (id) do nothing`,
  );
}

export function seedRuleSnapshot(db: string, row: RuleSnapshotRow): void {
  const id = asUuid(row.id);
  psql(
    db,
    `insert into public.prop_challenge_rule_snapshots (
      id, user_id, challenge_id, rule_set_version, snapshot, template_key,
      template_version_at_capture, captured_at, schema_version
    ) values (
      ${sqlLiteral(id)}::uuid,
      ${sqlLiteral(row.user_id)}::uuid,
      ${sqlLiteral(row.challenge_id)}::uuid,
      ${sqlLiteral(row.rule_set_version)},
      ${sqlJson(row.snapshot)},
      ${sqlNullableLiteral(row.template_key)},
      ${sqlNullableLiteral(row.template_version_at_capture)},
      ${sqlLiteral(row.captured_at)}::timestamptz,
      ${sqlLiteral(row.schema_version)}
    ) on conflict (id) do nothing`,
  );
}

export function seedExecution(db: string, row: ExecutionRow): void {
  seedExecutionsBatch(db, [row]);
}

export function seedExecutionsBatch(db: string, rows: ExecutionRow[]): void {
  if (rows.length === 0) return;
  const values = rows
    .map(
      (row) => `(
      ${sqlLiteral(row.id)},
      ${sqlLiteral(row.user_id)}::uuid,
      ${row.challenge_id ? `${sqlLiteral(row.challenge_id)}::uuid` : "null"},
      ${row.account_id ? `${sqlLiteral(row.account_id)}::uuid` : "null"},
      ${sqlNullableLiteral(row.trade_client_id)},
      ${sqlLiteral(row.occurred_at)}::timestamptz,
      ${sqlNullableNumber(row.broker_sequence)},
      ${sqlNullableNumber(row.realized_pnl_minor)},
      ${sqlNullableNumber(row.fees_minor)},
      ${sqlNullableNumber(row.contracts)},
      ${row.voided ? "true" : "false"},
      ${sqlNullableLiteral(row.corrects_event_id)},
      ${sqlLiteral(row.source)},
      ${sqlLiteral(row.schema_version)}
    )`,
    )
    .join(",\n");
  psql(
    db,
    `insert into public.prop_executions (
      id, user_id, challenge_id, account_id, trade_client_id, occurred_at, broker_sequence,
      realized_pnl_minor, fees_minor, contracts, voided, corrects_event_id, source, schema_version
    ) values ${values}
    on conflict (user_id, id) do nothing`,
  );
}

export function seedAccountEvent(db: string, row: AccountEventRow): void {
  psql(
    db,
    `insert into public.prop_account_events (
      id, user_id, challenge_id, kind, occurred_at, payload, schema_version
    ) values (
      ${sqlLiteral(row.id)},
      ${sqlLiteral(row.user_id)}::uuid,
      ${sqlLiteral(row.challenge_id)}::uuid,
      ${sqlLiteral(row.kind)},
      ${sqlLiteral(row.occurred_at)}::timestamptz,
      ${sqlJson(row.payload)},
      ${sqlLiteral(row.schema_version)}
    ) on conflict (user_id, id) do nothing`,
  );
}
