import type { PropEngineResultV0 } from "../types";
import { newId, stableStringify } from "./stable";
import type { EngineSnapshotRow, ScoreSnapshotRow } from "./types";
import { SHADOW_RUNNER_VERSION, SHADOW_SCHEMA_VERSION } from "./types";

/**
 * Map engine output → append-only snapshot rows.
 * Must not alter engine math — only envelope + version metadata.
 */
export function mapEngineResultToSnapshots(input: {
  userId: string;
  shadowInputRevision: string;
  result: PropEngineResultV0;
  fixtureContractVersion?: string | null;
}): { engine: EngineSnapshotRow; score: ScoreSnapshotRow | null } {
  const { result } = input;
  const createdAt = result.calculatedAt;
  const baseMeta = {
    user_id: input.userId,
    challenge_id: result.challengeId,
    calculation_version: result.calculationVersion,
    rule_set_version: result.ruleSetVersion,
    input_revision: input.shadowInputRevision,
    calculated_at: result.calculatedAt,
    status: result.status,
    readiness_model_version: result.readinessModelVersion,
    confidence_policy_version: result.confidencePolicyVersion,
    fixture_contract_version: input.fixtureContractVersion ?? "fixture-contract-v0",
    backfill_version: null,
    migration_plan_version: null,
    schema_version: SHADOW_SCHEMA_VERSION,
    created_at: createdAt,
  };

  const enginePayload = {
    runnerVersion: SHADOW_RUNNER_VERSION,
    bufferModelVersion: result.bufferModelVersion,
    dailyLossPolicyVersion: result.dailyLossPolicyVersion,
    dailyLossBasis: result.dailyLossBasis,
    engineInputRevision: result.inputRevision,
    accountState: result.accountState,
    buffers: result.buffers,
    breachReasons: result.breachReasons,
    readiness: result.readiness,
    evidence: result.evidence,
    limitations: result.limitations,
  };

  const engine: EngineSnapshotRow = {
    id: newId("eng"),
    ...baseMeta,
    payload: enginePayload,
    confidence: { ...result.confidence },
    limitations: result.limitations,
  };

  const score: ScoreSnapshotRow | null = {
    id: newId("score"),
    ...baseMeta,
    payload: {
      runnerVersion: SHADOW_RUNNER_VERSION,
      readiness: result.readiness,
      publicScoreWithheld: result.readiness == null,
    },
    confidence: result.readiness?.confidence
      ? { ...result.readiness.confidence }
      : { ...result.confidence },
    limitations: result.limitations,
  };

  return { engine, score };
}

export function snapshotCoreEqual(
  a: Pick<EngineSnapshotRow, "status" | "payload" | "confidence" | "limitations">,
  b: Pick<EngineSnapshotRow, "status" | "payload" | "confidence" | "limitations">,
): boolean {
  return (
    a.status === b.status &&
    stableStringify(a.payload) === stableStringify(b.payload) &&
    stableStringify(a.confidence) === stableStringify(b.confidence) &&
    stableStringify(a.limitations) === stableStringify(b.limitations)
  );
}

export function engineResultFromSnapshotPayload(
  row: EngineSnapshotRow,
): Partial<PropEngineResultV0> {
  const p = row.payload;
  return {
    calculationVersion: row.calculation_version as PropEngineResultV0["calculationVersion"],
    ruleSetVersion: row.rule_set_version,
    calculatedAt: row.calculated_at,
    status: row.status as PropEngineResultV0["status"],
    challengeId: row.challenge_id,
    accountState: p.accountState as PropEngineResultV0["accountState"],
    buffers: p.buffers as PropEngineResultV0["buffers"],
    breachReasons: p.breachReasons as PropEngineResultV0["breachReasons"],
    readiness: p.readiness as PropEngineResultV0["readiness"],
    limitations: (p.limitations as string[]) ?? [],
  };
}
