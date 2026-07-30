/**
 * Memory assignment write service — mirrors RPC semantics for QA.
 */

import { hashPropOsCommandPayload } from "../commands/hash";
import type { PropOsCommandState } from "../commands/types";
import { freshId } from "../accounts/memoryStore";
import { evaluateAssignability } from "./assignability";
import {
  ASSIGNMENT_BULK_MAX,
  type AssignTradesCommand,
  type AssignmentCommandResult,
  type PropOsTradeAssignmentWriteService,
  type PropTradeAssignmentEvent,
  type ReassignTradesCommand,
  type RemoveTradeAssignmentsCommand,
  type TradeAssignmentSource,
} from "./types";
import {
  bumpRevision,
  currentAssignmentForTrade,
  type MemoryAssignmentStore,
} from "./memoryStore";

type Receipt = {
  hash: string;
  state: PropOsCommandState<AssignmentCommandResult>;
};

function newEventId(): string {
  return freshId("asg");
}

export function createMemoryAssignmentWriteService(input: {
  userId: string;
  store: MemoryAssignmentStore;
  mutationsAllowed?: boolean;
  /** Optional hook after commit — e.g. run recalculation. */
  afterCommit?: (result: AssignmentCommandResult) => Promise<void> | void;
}): PropOsTradeAssignmentWriteService {
  const receipts = new Map<string, Receipt>();
  const mutationsAllowed = input.mutationsAllowed !== false;

  async function withIdempotency(
    commandType: string,
    requestId: string,
    body: unknown,
    run: () => Promise<PropOsCommandState<AssignmentCommandResult>>,
  ): Promise<PropOsCommandState<AssignmentCommandResult>> {
    if (!mutationsAllowed) return { kind: "forbidden" };
    if (!input.userId) return { kind: "forbidden" };
    const hash = hashPropOsCommandPayload(commandType, body);
    const key = `${input.userId}::${requestId}`;
    const prior = receipts.get(key);
    if (prior) {
      if (prior.hash !== hash) {
        return { kind: "conflict", reasonCode: "idempotency_hash_mismatch" };
      }
      return prior.state as PropOsCommandState<AssignmentCommandResult>;
    }
    const state = await run();
    if (state.kind === "success") {
      receipts.set(key, { hash, state });
      await input.afterCommit?.(state.value);
    }
    return state;
  }

  function loadChallenge(challengeId: string, accountId: string) {
    const ch = input.store.challenges.get(challengeId);
    const acc = input.store.accounts.get(accountId);
    if (!ch || !acc) return null;
    if (ch.userId !== input.userId || acc.userId !== input.userId) return null;
    if (ch.accountId !== accountId) return null;
    return { ch, acc };
  }

  async function assignCore(
    cmd: AssignTradesCommand | ReassignTradesCommand,
    allowReassignment: boolean,
  ): Promise<PropOsCommandState<AssignmentCommandResult>> {
    const ids = [...new Set(cmd.tradeClientIds.map((x) => x.trim()).filter(Boolean))];
    if (!ids.length) {
      return { kind: "validation_error", fieldErrors: { tradeClientIds: "required" } };
    }
    if (ids.length > ASSIGNMENT_BULK_MAX) {
      return { kind: "conflict", reasonCode: "bulk_limit_exceeded" };
    }
    const loaded = loadChallenge(cmd.challengeId, cmd.accountId);
    if (!loaded) return { kind: "forbidden" };

    const source: TradeAssignmentSource = cmd.source ?? "manual";
    const events: PropTradeAssignmentEvent[] = [];
    const affected = new Set<string>([cmd.challengeId]);
    const now = new Date().toISOString();

    // Validate all first — atomic valid set
    for (const tradeClientId of ids) {
      const trade = input.store.trades.find(
        (t) =>
          t.identity.userId === input.userId &&
          t.identity.tradeClientId === tradeClientId,
      );
      if (!trade) {
        return {
          kind: "validation_error",
          fieldErrors: { [tradeClientId]: "incomplete" },
        };
      }
      const current = currentAssignmentForTrade(input.store, input.userId, tradeClientId);
      if (
        current?.state === "assigned" &&
        current.challengeId === cmd.challengeId &&
        !allowReassignment
      ) {
        // idempotent same destination — no-op for this trade
        continue;
      }
      const verdict = evaluateAssignability({
        userId: input.userId,
        trade,
        current,
        challenge: {
          accountId: cmd.accountId,
          challengeId: cmd.challengeId,
          accountStatus: loaded.acc.status,
          challengeStatus: loaded.ch.status,
          startedAt: loaded.ch.startedAt,
          endedAt: loaded.ch.endedAt,
        },
        allowReassignment,
      });
      if (!verdict.ok) {
        if (
          verdict.reason === "already_assigned_other_challenge" &&
          !allowReassignment
        ) {
          return { kind: "conflict", reasonCode: "reassignment_required" };
        }
        return {
          kind: "conflict",
          reasonCode: verdict.reason ?? "not_assignable",
        };
      }
    }

    const revision = bumpRevision(input.store, input.userId);

    for (const tradeClientId of ids) {
      const current = currentAssignmentForTrade(input.store, input.userId, tradeClientId);
      if (current?.state === "assigned" && current.challengeId === cmd.challengeId) {
        events.push(current);
        continue;
      }
      if (current?.state === "assigned" && current.challengeId) {
        affected.add(current.challengeId);
        const superseded: PropTradeAssignmentEvent = {
          ...current,
          state: "superseded",
          assignmentRevision: revision,
          clientRequestId: cmd.clientRequestId,
          reasonCode: "reassigned",
          createdAt: now,
          id: newEventId(),
          supersededAssignmentId: current.id,
          effectiveAt: now,
        };
        // Mark prior assigned event superseded by appending a superseded marker
        // and keeping history: update logical current by appending.
        input.store.events.push({
          ...current,
          id: newEventId(),
          state: "superseded",
          effectiveAt: now,
          createdAt: now,
          clientRequestId: cmd.clientRequestId,
          reasonCode: "superseded_by_reassign",
          supersededAssignmentId: current.id,
          assignmentRevision: revision,
        });
        void superseded;
      }

      const ev: PropTradeAssignmentEvent = {
        id: newEventId(),
        userId: input.userId,
        tradeClientId,
        accountId: cmd.accountId,
        challengeId: cmd.challengeId,
        source,
        state: "assigned",
        effectiveAt: now,
        actor: "user",
        clientRequestId: cmd.clientRequestId,
        reasonCode: cmd.reasonCode ?? null,
        supersededAssignmentId: current?.id ?? null,
        assignmentRevision: revision,
        createdAt: now,
      };
      input.store.events.push(ev);
      events.push(ev);
    }

    for (const challengeId of affected) {
      input.store.recalc.set(challengeId, {
        kind: "queued",
        assignmentRevision: revision,
      });
    }

    const value: AssignmentCommandResult = {
      events,
      assignmentRevision: revision,
      affectedChallengeIds: [...affected],
      recalculation: { kind: "queued", assignmentRevision: revision },
    };
    return { kind: "success", value };
  }

  return {
    assignTrades(cmd) {
      return withIdempotency("assign_trades", cmd.clientRequestId, {
        accountId: cmd.accountId,
        challengeId: cmd.challengeId,
        tradeClientIds: [...cmd.tradeClientIds].sort(),
        source: cmd.source ?? "manual",
      }, () => assignCore(cmd, false));
    },

    reassignTrades(cmd) {
      if (cmd.confirmReassignment !== true) {
        return Promise.resolve({
          kind: "conflict",
          reasonCode: "reassignment_confirmation_required",
        });
      }
      return withIdempotency("reassign_trades", cmd.clientRequestId, {
        accountId: cmd.accountId,
        challengeId: cmd.challengeId,
        tradeClientIds: [...cmd.tradeClientIds].sort(),
        confirmReassignment: true,
        source: cmd.source ?? "manual",
      }, () => assignCore(cmd, true));
    },

    removeTradeAssignments(cmd) {
      return withIdempotency("remove_trade_assignments", cmd.clientRequestId, {
        accountId: cmd.accountId,
        tradeClientIds: [...cmd.tradeClientIds].sort(),
      }, async () => {
        const ids = [...new Set(cmd.tradeClientIds.map((x) => x.trim()).filter(Boolean))];
        if (!ids.length) {
          return { kind: "validation_error", fieldErrors: { tradeClientIds: "required" } };
        }
        const acc = input.store.accounts.get(cmd.accountId);
        if (!acc || acc.userId !== input.userId) return { kind: "forbidden" };

        const revision = bumpRevision(input.store, input.userId);
        const now = new Date().toISOString();
        const events: PropTradeAssignmentEvent[] = [];
        const affected = new Set<string>();

        for (const tradeClientId of ids) {
          const current = currentAssignmentForTrade(input.store, input.userId, tradeClientId);
          if (!current) continue;
          if (current.challengeId) affected.add(current.challengeId);
          const removed: PropTradeAssignmentEvent = {
            id: newEventId(),
            userId: input.userId,
            tradeClientId,
            accountId: current.accountId,
            challengeId: current.challengeId,
            source: current.source,
            state: "removed",
            effectiveAt: now,
            actor: "user",
            clientRequestId: cmd.clientRequestId,
            reasonCode: cmd.reasonCode ?? "user_removed",
            supersededAssignmentId: current.id,
            assignmentRevision: revision,
            createdAt: now,
          };
          input.store.events.push({
            ...current,
            id: newEventId(),
            state: "superseded",
            effectiveAt: now,
            createdAt: now,
            clientRequestId: cmd.clientRequestId,
            reasonCode: "superseded_by_remove",
            supersededAssignmentId: current.id,
            assignmentRevision: revision,
          });
          input.store.events.push(removed);
          events.push(removed);
        }

        for (const challengeId of affected) {
          input.store.recalc.set(challengeId, {
            kind: "queued",
            assignmentRevision: revision,
          });
        }

        return {
          kind: "success",
          value: {
            events,
            assignmentRevision: revision,
            affectedChallengeIds: [...affected],
            recalculation: {
              kind: "queued" as const,
              assignmentRevision: revision,
            },
          },
        };
      });
    },
  };
}

/** Complete recalculation for a challenge if revision matches; reject stale writes. */
export function completeMemoryRecalculation(
  store: MemoryAssignmentStore,
  challengeId: string,
  assignmentRevision: number,
): PropOsCommandState<{ snapshotRevision: number }> {
  const current = store.recalc.get(challengeId);
  if (!current || current.kind === "not_required") {
    return { kind: "conflict", reasonCode: "recalc_not_queued" };
  }
  if (
    (current.kind === "queued" || current.kind === "running" || current.kind === "failed") &&
    current.assignmentRevision !== assignmentRevision
  ) {
    return { kind: "conflict", reasonCode: "stale_recalculation" };
  }
  if (current.kind === "completed" && current.assignmentRevision > assignmentRevision) {
    return { kind: "conflict", reasonCode: "stale_recalculation" };
  }
  const existing = store.completedSnapshots.get(challengeId);
  if (existing && existing.assignmentRevision > assignmentRevision) {
    return { kind: "conflict", reasonCode: "stale_recalculation" };
  }
  const snapshotRevision = (existing?.snapshotRevision ?? 0) + 1;
  store.completedSnapshots.set(challengeId, { assignmentRevision, snapshotRevision });
  store.recalc.set(challengeId, {
    kind: "completed",
    assignmentRevision,
    snapshotRevision,
  });
  return { kind: "success", value: { snapshotRevision } };
}

export function failMemoryRecalculation(
  store: MemoryAssignmentStore,
  challengeId: string,
  assignmentRevision: number,
  reasonCode: string,
): void {
  store.recalc.set(challengeId, {
    kind: "failed",
    assignmentRevision,
    reasonCode,
  });
}

/** Deterministic content hash helper for tests. */
export function hashTradeSet(ids: string[]): string {
  return hashPropOsCommandPayload("trade_set", [...ids].sort());
}
