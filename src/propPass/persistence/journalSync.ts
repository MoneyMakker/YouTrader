import { hashPropOsCommandPayload } from "../../propOs/commands/hash";
import type { PropPassCalculationPipelineOutput } from "../tradingOs/index";
import { PropPassPersistenceError, type JournalPersistenceEvent, type PersistenceVersions, type PropPassPersistenceAdapter } from "./contracts";

export type PropPassJournalRebuild = Readonly<{
  stateRevision: number;
  lifecycleStatus: string;
  calculatedAt: string;
  versions: PersistenceVersions;
  output: PropPassCalculationPipelineOutput;
}>;

export type PropPassJournalSyncResult = Readonly<{
  kind: "applied" | "already_applied";
  eventKey: string;
  stateRevision: number | null;
}>;

/**
 * Trusted processor orchestration. Rebuilds from the canonical current Journal
 * set; edits/deletes are never applied as an unsafe arithmetic delta.
 */
export async function processPropPassJournalEvent(input: {
  event: JournalPersistenceEvent;
  persistence: PropPassPersistenceAdapter;
  rebuild: () => Promise<PropPassJournalRebuild>;
}): Promise<PropPassJournalSyncResult> {
  const claim = await input.persistence.claimJournalEvent(input.event);
  if (claim.kind === "already_applied") {
    return { kind: "already_applied", eventKey: input.event.eventKey, stateRevision: null };
  }

  try {
    const rebuilt = await input.rebuild();
    validateRebuild(rebuilt, input.event);
    const resultDigest = hashPropOsCommandPayload("prop_pass_journal_result", rebuilt.output);
    const stateDigest = hashPropOsCommandPayload("prop_pass_runtime_state", {
      eventKey: input.event.eventKey,
      stateRevision: rebuilt.stateRevision,
      output: rebuilt.output,
    });
    const completion = await input.persistence.completeJournalEvent({
      eventKey: input.event.eventKey,
      resultDigest,
      stateRevision: rebuilt.stateRevision,
      lifecycleStatus: rebuilt.lifecycleStatus,
      calculatedAt: rebuilt.calculatedAt,
      versions: rebuilt.versions,
      stateDigest,
      state: rebuilt.output,
    });
    return { kind: completion, eventKey: input.event.eventKey, stateRevision: rebuilt.stateRevision };
  } catch (error) {
    const failureDigest = hashPropOsCommandPayload("prop_pass_journal_failure", {
      eventKey: input.event.eventKey,
      code: error instanceof PropPassPersistenceError ? error.code : "calculation_failed",
    });
    await input.persistence.failJournalEvent(input.event.eventKey, failureDigest).catch(() => undefined);
    throw error;
  }
}

function validateRebuild(rebuilt: PropPassJournalRebuild, event: JournalPersistenceEvent): void {
  if (!Number.isSafeInteger(rebuilt.stateRevision) || rebuilt.stateRevision < event.tradeRevision) {
    throw new PropPassPersistenceError("invalid_input", "rebuilt state revision is stale");
  }
  if (Number.isNaN(Date.parse(rebuilt.calculatedAt))) {
    throw new PropPassPersistenceError("invalid_input", "rebuilt calculation timestamp is invalid");
  }
  if (rebuilt.versions.calculationVersion !== rebuilt.output.calculationVersion) {
    throw new PropPassPersistenceError("invalid_input", "rebuilt calculation version mismatch");
  }
  if (rebuilt.output.journalApplication.duplicateTradeIds.length > 0) {
    throw new PropPassPersistenceError("conflict", "duplicate Journal application detected");
  }
}
