import { calculateChallenge, publicReadinessScore } from "../engine";
import type { PropOsFixture } from "../fixtures/scenarios";
import { buildShadowInputRevision } from "./inputRevision";
import {
  MappingError,
  accountToRow,
  challengeToRow,
  eventToRows,
  mapAccountEventRow,
  mapAccountRow,
  mapChallengeRow,
  mapDomainEvents,
  mapExecutionRow,
  mapRuleSnapshotRow,
  ruleSnapshotToRow,
} from "./mappers";
import type { SeedableShadowRepository, ShadowRepository } from "./repository";
import { mapEngineResultToSnapshots, snapshotCoreEqual } from "./snapshots";
import type {
  PublicReadinessExpectation,
  ShadowBatchReport,
  ShadowChallengeOutcome,
  ShadowFailureClass,
  ShadowTiming,
} from "./types";
import { SHADOW_RUNNER_VERSION } from "./types";

function nowMs(): number {
  return Date.now();
}

function emptyTiming(): ShadowTiming {
  return { dbReadMs: 0, mappingMs: 0, engineMs: 0, snapshotWriteMs: 0, totalMs: 0 };
}

function classifyError(err: unknown): { failure: ShadowFailureClass; detail: string } {
  if (err instanceof MappingError) {
    return { failure: "invalid_input", detail: err.message };
  }
  const any = err as { failure?: ShadowFailureClass; message?: string; code?: string };
  if (any?.failure) {
    return { failure: any.failure, detail: any.message ?? String(err) };
  }
  if (any?.code === "rls_denied") {
    return { failure: "snapshot_write_failure", detail: any.message ?? "rls denied" };
  }
  return { failure: "engine_failure", detail: any?.message ?? String(err) };
}

/**
 * Seed fixture domain objects into a seedable repository (memory or test double).
 */
export function seedFixtureIntoRepository(
  repo: SeedableShadowRepository,
  fixture: PropOsFixture,
): void {
  const userId = fixture.account.userId;
  repo.seedAccount(accountToRow(fixture.account));
  repo.seedChallenge(challengeToRow(fixture.challenge, userId));
  repo.seedRuleSnapshot(ruleSnapshotToRow(fixture.challenge, userId, fixture.challenge.startedAtUtc));
  for (const ev of fixture.events) {
    const rows = eventToRows(ev, userId);
    if (rows.execution) repo.seedExecution(rows.execution);
    if (rows.accountEvent) repo.seedAccountEvent(rows.accountEvent);
  }
}

export async function runShadowChallenge(
  repo: ShadowRepository,
  challengeId: string,
  opts: {
    asOfUtc: string;
    previousReadinessScore?: number | null;
    previousReadinessFactors?: import("../scoreDrivers").ReadinessFactorMap | null;
    expect?: PublicReadinessExpectation;
    fixtureContractVersion?: string | null;
  },
): Promise<ShadowChallengeOutcome> {
  const t0 = nowMs();
  const timing = emptyTiming();

  try {
    const tRead = nowMs();
    const challengeRow = await repo.getChallenge(challengeId);
    if (!challengeRow) {
      timing.dbReadMs = nowMs() - tRead;
      timing.totalMs = nowMs() - t0;
      return {
        ok: false,
        challengeId,
        failure: "database_read_failure",
        detail: "challenge not found",
        timing,
      };
    }
    const accountRow = await repo.getAccount(challengeRow.account_id);
    const ruleRow = await repo.getRuleSnapshot(challengeId);
    const executions = await repo.listExecutions(challengeId);
    const accountEvents = await repo.listAccountEvents(challengeId);
    timing.dbReadMs = nowMs() - tRead;

    if (!accountRow || !ruleRow) {
      timing.totalMs = nowMs() - t0;
      return {
        ok: false,
        challengeId,
        failure: "database_read_failure",
        detail: !accountRow ? "account not found" : "rule snapshot not found",
        timing,
      };
    }

    const tMap = nowMs();
    let account;
    let ruleSnapshot;
    let challenge;
    let events;
    try {
      account = mapAccountRow(accountRow);
      ruleSnapshot = mapRuleSnapshotRow(ruleRow);
      challenge = mapChallengeRow(challengeRow, ruleSnapshot);
      // Re-map executions scoped to this challenge (+ unassigned ignored by engine)
      events = mapDomainEvents(
        executions.filter((e) => e.challenge_id === challengeId || e.challenge_id == null),
        accountEvents,
      );
      // Ensure mapper path is exercised for each row type
      for (const e of executions) mapExecutionRow(e);
      for (const e of accountEvents) mapAccountEventRow(e);
    } catch (err) {
      timing.mappingMs = nowMs() - tMap;
      timing.totalMs = nowMs() - t0;
      const c = classifyError(err);
      return { ok: false, challengeId, failure: c.failure, detail: c.detail, timing };
    }
    timing.mappingMs = nowMs() - tMap;

    const shadowRevision = buildShadowInputRevision({
      challenge,
      ruleSnapshot,
      account,
      events,
    });

    const tEng = nowMs();
    let result;
    try {
      result = calculateChallenge({
        challenge,
        events,
        asOfUtc: opts.asOfUtc,
        previousReadinessScore: opts.previousReadinessScore,
        previousReadinessFactors: opts.previousReadinessFactors,
      });
    } catch (err) {
      timing.engineMs = nowMs() - tEng;
      timing.totalMs = nowMs() - t0;
      return {
        ok: false,
        challengeId,
        failure: "engine_failure",
        detail: (err as Error).message ?? String(err),
        timing,
      };
    }
    timing.engineMs = nowMs() - tEng;

    // Incomplete required equity stream → failure/limitation state, not fabricated success score
    if (
      result.readiness?.gate === "unsupported_rule_calculation" ||
      result.limitations.includes("intraday_equity_stream_missing")
    ) {
      // Still persist honest engine output (score withheld) — classify observability
    }

    const { engine: engineSnap, score: scoreSnap } = mapEngineResultToSnapshots({
      userId: challengeRow.user_id,
      shadowInputRevision: shadowRevision,
      result,
      fixtureContractVersion: opts.fixtureContractVersion,
    });

    const tWrite = nowMs();
    try {
      const existing = await repo.findEngineSnapshot({
        challengeId,
        calculationVersion: engineSnap.calculation_version,
        ruleSetVersion: engineSnap.rule_set_version,
        inputRevision: engineSnap.input_revision,
      });

      if (existing) {
        if (
          existing.calculation_version !== engineSnap.calculation_version ||
          existing.rule_set_version !== engineSnap.rule_set_version
        ) {
          timing.snapshotWriteMs = nowMs() - tWrite;
          timing.totalMs = nowMs() - t0;
          return {
            ok: false,
            challengeId,
            failure: "version_mismatch",
            detail: "existing snapshot versions disagree with engine",
            timing,
          };
        }
        if (!snapshotCoreEqual(existing, engineSnap)) {
          timing.snapshotWriteMs = nowMs() - tWrite;
          timing.totalMs = nowMs() - t0;
          return {
            ok: false,
            challengeId,
            failure: "reconciliation_mismatch",
            detail: "existing snapshot payload differs for same revision keys",
            timing,
          };
        }
        const existingScore = await repo.findScoreSnapshot({
          challengeId,
          calculationVersion: engineSnap.calculation_version,
          ruleSetVersion: engineSnap.rule_set_version,
          inputRevision: engineSnap.input_revision,
        });
        timing.snapshotWriteMs = nowMs() - tWrite;
        timing.totalMs = nowMs() - t0;
        const mismatches = opts.expect
          ? compareExpectation(result, opts.expect)
          : [];
        return {
          ok: true,
          challengeId,
          action: "confirmed_existing",
          inputRevision: shadowRevision,
          engineResult: result,
          engineSnapshot: existing,
          scoreSnapshot: existingScore,
          timing,
          mismatches,
        };
      }

      const insertedEngine = await repo.insertEngineSnapshot(engineSnap);
      const insertedScore = scoreSnap ? await repo.insertScoreSnapshot(scoreSnap) : null;
      timing.snapshotWriteMs = nowMs() - tWrite;
      timing.totalMs = nowMs() - t0;
      const mismatches = opts.expect ? compareExpectation(result, opts.expect) : [];
      return {
        ok: true,
        challengeId,
        action: "inserted",
        inputRevision: shadowRevision,
        engineResult: result,
        engineSnapshot: insertedEngine,
        scoreSnapshot: insertedScore,
        timing,
        mismatches,
      };
    } catch (err) {
      timing.snapshotWriteMs = nowMs() - tWrite;
      timing.totalMs = nowMs() - t0;
      const c = classifyError(err);
      return { ok: false, challengeId, failure: c.failure, detail: c.detail, timing };
    }
  } catch (err) {
    timing.totalMs = nowMs() - t0;
    const c = classifyError(err);
    return { ok: false, challengeId, failure: c.failure, detail: c.detail, timing };
  }
}

export function compareExpectation(
  result: import("../types").PropEngineResultV0,
  expect: PublicReadinessExpectation,
): string[] {
  const mismatches: string[] = [];
  if (result.status !== expect.status) {
    mismatches.push(`status ${result.status} != ${expect.status}`);
  }
  const pub = publicReadinessScore(result);
  if (expect.readinessScore === true) {
    if (typeof pub !== "number") mismatches.push("expected numeric readiness score");
  } else if (pub !== expect.readinessScore) {
    mismatches.push(`readinessScore ${String(pub)} != ${String(expect.readinessScore)}`);
  }
  if (expect.readinessGate && result.readiness?.gate !== expect.readinessGate) {
    mismatches.push(`gate ${result.readiness?.gate ?? "none"} != ${expect.readinessGate}`);
  }
  for (const lim of expect.limitationsIncludes ?? []) {
    if (!result.limitations.includes(lim)) mismatches.push(`missing limitation ${lim}`);
  }
  for (const code of expect.breachCodesIncludes ?? []) {
    if (!result.breachReasons.some((b) => b.code === code)) mismatches.push(`missing breach ${code}`);
  }
  if (expect.equityMinor != null && result.accountState.equityMinor !== expect.equityMinor) {
    mismatches.push(`equity ${result.accountState.equityMinor} != ${expect.equityMinor}`);
  }
  if (expect.equitySource && result.accountState.equitySource !== expect.equitySource) {
    mismatches.push(`equitySource mismatch`);
  }
  return mismatches;
}

export async function runShadowBatch(
  repo: ShadowRepository,
  jobs: Array<{
    challengeId: string;
    asOfUtc: string;
    previousReadinessScore?: number | null;
    previousReadinessFactors?: import("../scoreDrivers").ReadinessFactorMap | null;
    expect?: PublicReadinessExpectation;
  }>,
): Promise<ShadowBatchReport> {
  const t0 = nowMs();
  const outcomes: ShadowChallengeOutcome[] = [];
  const byFailure: Partial<Record<ShadowFailureClass, number>> = {};
  let inserted = 0;
  let confirmed = 0;
  let failed = 0;

  for (const job of jobs) {
    const outcome = await runShadowChallenge(repo, job.challengeId, job);
    outcomes.push(outcome);
    if (outcome.ok === false) {
      failed += 1;
      const failure = outcome.failure;
      byFailure[failure] = (byFailure[failure] ?? 0) + 1;
    } else if (outcome.action === "inserted") {
      inserted += 1;
    } else if (outcome.action === "confirmed_existing") {
      confirmed += 1;
    }
  }

  return {
    runnerVersion: SHADOW_RUNNER_VERSION,
    calculatedAt: new Date(0).toISOString(), // report stamp unused for math
    outcomes,
    counters: {
      processed: outcomes.length,
      inserted,
      confirmed,
      failed,
      byFailure,
    },
    timing: {
      totalMs: nowMs() - t0,
      perChallengeMs: outcomes.map((o) => o.timing.totalMs),
    },
  };
}
