/**
 * Prop OS Phase 1C — shadow pipeline types.
 * Isolated from App / UI. Engine remains Supabase-unaware.
 */

import type { ReadinessFactorMap } from "../scoreDrivers";
import type {
  AccountingEvent,
  ChallengeLifecycleStatus,
  PropAccountFixture,
  PropChallengeFixture,
  PropEngineResultV0,
  PropRuleSetSnapshot,
} from "../types";

export const SHADOW_RUNNER_VERSION = "shadow-runner-v0" as const;
export const SHADOW_SCHEMA_VERSION = "prop-os-schema-v0" as const;

export type ShadowFailureClass =
  | "invalid_input"
  | "unsupported_rules"
  | "incomplete_equity_stream"
  | "database_read_failure"
  | "engine_failure"
  | "snapshot_write_failure"
  | "version_mismatch"
  | "reconciliation_mismatch";

export type ShadowTiming = {
  dbReadMs: number;
  mappingMs: number;
  engineMs: number;
  snapshotWriteMs: number;
  totalMs: number;
};

export type ShadowChallengeBundle = {
  userId: string;
  account: PropAccountFixture;
  challenge: PropChallengeFixture;
  ruleSnapshot: PropRuleSetSnapshot;
  events: AccountingEvent[];
  asOfUtc: string;
  previousReadinessScore?: number | null;
  previousReadinessFactors?: ReadinessFactorMap | null;
};

export type EngineSnapshotRow = {
  id: string;
  user_id: string;
  challenge_id: string;
  calculation_version: string;
  rule_set_version: string;
  input_revision: string;
  calculated_at: string;
  status: string;
  payload: Record<string, unknown>;
  confidence: Record<string, unknown>;
  limitations: unknown;
  readiness_model_version: string | null;
  confidence_policy_version: string;
  fixture_contract_version: string | null;
  backfill_version: string | null;
  migration_plan_version: string | null;
  schema_version: string;
  created_at: string;
};

export type ScoreSnapshotRow = {
  id: string;
  user_id: string;
  challenge_id: string;
  calculation_version: string;
  rule_set_version: string;
  input_revision: string;
  calculated_at: string;
  status: string;
  payload: Record<string, unknown>;
  confidence: Record<string, unknown>;
  limitations: unknown;
  readiness_model_version: string | null;
  confidence_policy_version: string;
  fixture_contract_version: string | null;
  backfill_version: string | null;
  migration_plan_version: string | null;
  schema_version: string;
  created_at: string;
};

/** DB-shaped rows used by mappers (Phase 1A column names). */
export type AccountRow = {
  id: string;
  user_id: string;
  firm_key: string | null;
  label: string;
  account_size_minor: number;
  currency: string;
  firm_timezone: string;
  status: string;
  source: string;
  schema_version: string;
};

export type ChallengeRow = {
  id: string;
  user_id: string;
  account_id: string;
  phase: string;
  status: string;
  rule_set_version: string;
  starting_balance_minor: number;
  started_at: string;
  ended_at: string | null;
  reset_of_challenge_id: string | null;
  breach_locked: boolean;
  schema_version: string;
};

export type RuleSnapshotRow = {
  id: string;
  user_id: string;
  challenge_id: string;
  rule_set_version: string;
  snapshot: PropRuleSetSnapshot | Record<string, unknown>;
  template_key: string | null;
  template_version_at_capture: string | null;
  captured_at: string;
  schema_version: string;
};

export type ExecutionRow = {
  id: string;
  user_id: string;
  challenge_id: string | null;
  account_id: string | null;
  trade_client_id: string | null;
  occurred_at: string;
  broker_sequence: number | null;
  realized_pnl_minor: number | null;
  fees_minor: number | null;
  contracts: number | null;
  voided: boolean;
  corrects_event_id: string | null;
  source: string;
  schema_version: string;
};

export type AccountEventRow = {
  id: string;
  user_id: string;
  challenge_id: string;
  kind: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  schema_version: string;
};

export type ShadowChallengeOutcome =
  | {
      ok: true;
      challengeId: string;
      action: "inserted" | "confirmed_existing" | "noop";
      inputRevision: string;
      engineResult: PropEngineResultV0;
      engineSnapshot: EngineSnapshotRow;
      scoreSnapshot: ScoreSnapshotRow | null;
      timing: ShadowTiming;
      mismatches: string[];
    }
  | {
      ok: false;
      challengeId: string;
      failure: ShadowFailureClass;
      detail: string;
      timing: ShadowTiming;
    };

export type ShadowBatchReport = {
  runnerVersion: typeof SHADOW_RUNNER_VERSION;
  calculatedAt: string;
  outcomes: ShadowChallengeOutcome[];
  counters: {
    processed: number;
    inserted: number;
    confirmed: number;
    failed: number;
    byFailure: Partial<Record<ShadowFailureClass, number>>;
  };
  timing: {
    totalMs: number;
    perChallengeMs: number[];
  };
};

export type PublicReadinessExpectation = {
  status: ChallengeLifecycleStatus;
  readinessScore: number | null | true;
  readinessGate?: string;
  limitationsIncludes?: string[];
  breachCodesIncludes?: string[];
  equityMinor?: number;
  equitySource?: PropEngineResultV0["accountState"]["equitySource"];
};
