/**
 * Trusted recalculation processor boundary (Phase 2C remediation).
 *
 * App / React command gateway MUST NOT call complete/fail recalculation.
 * Only postgres | service_role | prop_os_recalc_processor may execute those RPCs.
 *
 * Pipeline (no memory repository after assignment gateway):
 *   prop_executions (assignment-sourced)
 *   → mapExecutionRow → calculateChallenge
 *   → versioned engine/score snapshots (input_revision = asg-rev-{N}:…)
 *   → prop_os_cmd_complete_recalculation (server-owned revision)
 */

import { calculateChallenge } from "../engine";
import { mapChallengeRow, mapExecutionRow, mapRuleSnapshotRow } from "../shadow/mappers";
import { mapEngineResultToSnapshots } from "../shadow/snapshots";
import type {
  ChallengeRow,
  ExecutionRow,
  RuleSnapshotRow,
} from "../shadow/types";
import { assignmentInputRevision, orderTradesForEngine } from "./ordering";
import type { AssignableTradeFact } from "./types";
import { buildTradeIdentity } from "./identity";

export const TRUSTED_RECALC_PROCESSOR_ROLES = [
  "postgres",
  "service_role",
  "prop_os_recalc_processor",
] as const;

export type TrustedRecalcInput = {
  userId: string;
  challengeRow: ChallengeRow;
  ruleSnapshotRow: RuleSnapshotRow;
  executionRows: ExecutionRow[];
  assignmentRevision: number;
  asOfUtc: string;
};

export type TrustedRecalcPrepared = {
  assignmentRevision: number;
  inputRevision: string;
  orderedTradeClientIds: string[];
  engineSnapshot: ReturnType<typeof mapEngineResultToSnapshots>["engine"];
  scoreSnapshot: NonNullable<ReturnType<typeof mapEngineResultToSnapshots>["score"]>;
  engineStatus: string;
  readinessScore: number | null;
};

/** Build deterministic ordered facts from assignment-sourced executions. */
export function factsFromExecutionRows(
  userId: string,
  rows: ExecutionRow[],
): AssignableTradeFact[] {
  return rows.map((r) =>
    ({
      identity: buildTradeIdentity({
        userId,
        tradeClientId: r.trade_client_id ?? r.id,
        journalTradeId: null,
      }),
      symbol: "UNK",
      direction: "LONG",
      pnlMajor: (r.realized_pnl_minor ?? 0) / 100,
      feesMajor: (r.fees_minor ?? 0) / 100,
      occurredAtUtc: r.occurred_at,
      tradeDate: r.occurred_at.slice(0, 10),
      contracts: r.contracts ?? 1,
      open: false,
    }) satisfies AssignableTradeFact,
  );
}

/**
 * Run production domain engine against PG-sourced rows.
 * Caller persists snapshots then invokes processor complete RPC.
 */
export function prepareTrustedRecalculation(
  input: TrustedRecalcInput,
): TrustedRecalcPrepared {
  const rules = mapRuleSnapshotRow(input.ruleSnapshotRow);
  const challenge = mapChallengeRow(input.challengeRow, rules);
  const events = input.executionRows
    .filter((r) => !r.voided)
    .map((r) => mapExecutionRow(r));

  const facts = factsFromExecutionRows(input.userId, input.executionRows);
  const ordered = orderTradesForEngine(facts);
  const inputRevision = assignmentInputRevision(input.assignmentRevision, ordered);

  const result = calculateChallenge({
    challenge,
    events,
    asOfUtc: input.asOfUtc,
  });

  const snaps = mapEngineResultToSnapshots({
    userId: input.userId,
    shadowInputRevision: inputRevision,
    result,
    fixtureContractVersion: "assignment-recalc-v0",
  });

  if (!snaps.score) {
    throw new Error("score snapshot required for recalculation completion");
  }

  return {
    assignmentRevision: input.assignmentRevision,
    inputRevision,
    orderedTradeClientIds: ordered.map((o) => o.tradeClientId),
    engineSnapshot: snaps.engine,
    scoreSnapshot: snaps.score,
    engineStatus: result.status,
    readinessScore: result.readiness?.score ?? null,
  };
}
