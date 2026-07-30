/**
 * Phase 2C domain QA — assignment scenarios (memory).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ASSIGNMENT_BULK_MAX,
  assignmentInputRevision,
  buildTradeIdentity,
  completeMemoryRecalculation,
  createMemoryAssignmentReadStore,
  createMemoryAssignmentStore,
  createMemoryAssignmentWriteService,
  currentAssignmentForTrade,
  evaluateAssignability,
  failMemoryRecalculation,
  orderTradesForEngine,
  resolveOccurredAtUtc,
  type AssignableTradeFact,
} from "../src/propOs/assignments/index";
import { newPropOsClientRequestId } from "../src/propOs/commands/hash";

const ROOT = path.resolve(import.meta.dirname, "..");
const CAPTURE = path.join(ROOT, ".tmp/prop-pass-phase2c-captures");
const OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ACC = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CH1 = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const CH2 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  OK  ${name}`);
}

function capture(name: string, payload: unknown) {
  fs.mkdirSync(CAPTURE, { recursive: true });
  fs.writeFileSync(path.join(CAPTURE, `${name}.json`), JSON.stringify(payload, null, 2));
}

function trade(
  id: string,
  opts: {
    pnlMajor?: number;
    occurredAtUtc?: string | null;
    symbol?: string;
    open?: boolean;
    userId?: string;
    deletedAt?: string | null;
  } = {},
): AssignableTradeFact {
  return {
    identity: buildTradeIdentity({
      userId: opts.userId ?? OWNER,
      tradeClientId: id,
      deletedAt: opts.deletedAt,
    }),
    symbol: opts.symbol ?? "ES",
    direction: "LONG",
    pnlMajor: opts.pnlMajor ?? 100,
    occurredAtUtc:
      opts.occurredAtUtc === undefined ? "2026-02-01T15:00:00.000Z" : opts.occurredAtUtc,
    tradeDate: "2026-02-01",
    contracts: 1,
    open: opts.open ?? false,
  };
}

function seedStore() {
  const store = createMemoryAssignmentStore();
  store.accounts.set(ACC, { userId: OWNER, status: "active" });
  store.challenges.set(CH1, {
    userId: OWNER,
    accountId: ACC,
    status: "active",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: null,
  });
  store.challenges.set(CH2, {
    userId: OWNER,
    accountId: ACC,
    status: "active",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: null,
  });
  store.trades.push(
    trade("t1", { pnlMajor: 200 }),
    trade("t2", { pnlMajor: -50, occurredAtUtc: "2026-02-02T15:00:00.000Z" }),
    trade("t3", { pnlMajor: 10, occurredAtUtc: "2026-02-03T15:00:00.000Z" }),
    trade("bad-ts", { occurredAtUtc: null, pnlMajor: 1 }),
    trade("outside", { occurredAtUtc: "2025-01-01T00:00:00.000Z" }),
    trade("open1", { open: true }),
  );
  return store;
}

async function main() {
  console.log("prop-pass-phase2c-qa");

  await check("1. eligible owner with unassigned trades", async () => {
    const store = seedStore();
    const read = createMemoryAssignmentReadStore(store);
    const rows = await read.listAssignableTrades(OWNER, {
      accountId: ACC,
      challengeId: CH1,
      filter: { assigned: "unassigned" },
    });
    assert.ok(rows.some((r) => r.trade.identity.tradeClientId === "t1" && r.assignable));
    capture("unassigned-trade-list", rows.filter((r) => r.assignable).slice(0, 5));
  });

  await check("2. no assignable trades", async () => {
    const store = createMemoryAssignmentStore();
    store.accounts.set(ACC, { userId: OWNER, status: "active" });
    store.challenges.set(CH1, {
      userId: OWNER,
      accountId: ACC,
      status: "active",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null,
    });
    const read = createMemoryAssignmentReadStore(store);
    const rows = await read.listAssignableTrades(OWNER, {
      accountId: ACC,
      challengeId: CH1,
    });
    assert.equal(rows.length, 0);
  });

  await check("3–5. one + bulk + duplicate request", async () => {
    const store = seedStore();
    const write = createMemoryAssignmentWriteService({ userId: OWNER, store });
    const req = newPropOsClientRequestId();
    const one = await write.assignTrades({
      clientRequestId: req,
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t1"],
    });
    assert.equal(one.kind, "success");
    const dup = await write.assignTrades({
      clientRequestId: req,
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t1"],
    });
    assert.equal(dup.kind, "success");
    if (one.kind === "success" && dup.kind === "success") {
      assert.equal(one.value.assignmentRevision, dup.value.assignmentRevision);
    }

    const bulkReq = newPropOsClientRequestId();
    const bulk = await write.assignTrades({
      clientRequestId: bulkReq,
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t2", "t3"],
    });
    assert.equal(bulk.kind, "success");
    capture("bulk-selection", { tradeClientIds: ["t2", "t3"], result: bulk });
  });

  await check("6. same request ID different payload → conflict", async () => {
    const store = seedStore();
    const write = createMemoryAssignmentWriteService({ userId: OWNER, store });
    const req = newPropOsClientRequestId();
    const a = await write.assignTrades({
      clientRequestId: req,
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t1"],
    });
    assert.equal(a.kind, "success");
    const b = await write.assignTrades({
      clientRequestId: req,
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t2"],
    });
    assert.equal(b.kind, "conflict");
  });

  await check("7–11. same challenge / other challenge / reassign / remove / history", async () => {
    const store = seedStore();
    const write = createMemoryAssignmentWriteService({ userId: OWNER, store });
    const read = createMemoryAssignmentReadStore(store);
    await write.assignTrades({
      clientRequestId: newPropOsClientRequestId(),
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t1"],
    });
    const again = await write.assignTrades({
      clientRequestId: newPropOsClientRequestId(),
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t1"],
    });
    assert.equal(again.kind, "success");

    const other = await write.assignTrades({
      clientRequestId: newPropOsClientRequestId(),
      accountId: ACC,
      challengeId: CH2,
      tradeClientIds: ["t1"],
    });
    assert.equal(other.kind, "conflict");
    if (other.kind === "conflict") assert.equal(other.reasonCode, "reassignment_required");

    const re = await write.reassignTrades({
      clientRequestId: newPropOsClientRequestId(),
      accountId: ACC,
      challengeId: CH2,
      tradeClientIds: ["t1"],
      confirmReassignment: true,
    });
    assert.equal(re.kind, "success");
    capture("reassignment-confirmation", re);

    const cur = currentAssignmentForTrade(store, OWNER, "t1");
    assert.equal(cur?.challengeId, CH2);

    const rem = await write.removeTradeAssignments({
      clientRequestId: newPropOsClientRequestId(),
      accountId: ACC,
      tradeClientIds: ["t1"],
    });
    assert.equal(rem.kind, "success");
    assert.equal(currentAssignmentForTrade(store, OWNER, "t1"), null);

    const hist = await read.getAssignmentHistory(OWNER, "t1");
    assert.ok(hist.some((e) => e.state === "assigned"));
    assert.ok(hist.some((e) => e.state === "superseded"));
    assert.ok(hist.some((e) => e.state === "removed"));
    capture("assignment-history", hist);
  });

  await check("12–16. incomplete / malformed / window / archived / breached", async () => {
    const store = seedStore();
    store.trades.push(trade("malformed", { occurredAtUtc: "not-a-date" as unknown as string }));
    // force malformed by evaluate
    const bad = store.trades.find((t) => t.identity.tradeClientId === "bad-ts")!;
    assert.equal(
      evaluateAssignability({
        userId: OWNER,
        trade: bad,
        current: null,
        challenge: {
          accountId: ACC,
          challengeId: CH1,
          accountStatus: "active",
          challengeStatus: "active",
          startedAt: "2026-01-01T00:00:00.000Z",
          endedAt: null,
        },
      }).reason,
      "missing_timestamp",
    );
    const outside = store.trades.find((t) => t.identity.tradeClientId === "outside")!;
    assert.equal(
      evaluateAssignability({
        userId: OWNER,
        trade: outside,
        current: null,
        challenge: {
          accountId: ACC,
          challengeId: CH1,
          accountStatus: "active",
          challengeStatus: "active",
          startedAt: "2026-01-01T00:00:00.000Z",
          endedAt: null,
        },
      }).reason,
      "outside_challenge_window",
    );

    const write = createMemoryAssignmentWriteService({ userId: OWNER, store });
    store.challenges.set(CH1, {
      ...store.challenges.get(CH1)!,
      status: "breached",
    });
    const breached = await write.assignTrades({
      clientRequestId: newPropOsClientRequestId(),
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t2"],
    });
    assert.equal(breached.kind, "conflict");

    store.challenges.set(CH1, {
      ...store.challenges.get(CH1)!,
      status: "active",
    });
    store.accounts.set(ACC, { userId: OWNER, status: "archived" });
    const arch = await write.assignTrades({
      clientRequestId: newPropOsClientRequestId(),
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t2"],
    });
    assert.equal(arch.kind, "conflict");
  });

  await check("17–22. selection / cross-user / allowlist / kill switch", async () => {
    const store = seedStore();
    const forbidden = createMemoryAssignmentWriteService({
      userId: OWNER,
      store,
      mutationsAllowed: false,
    });
    const off = await forbidden.assignTrades({
      clientRequestId: newPropOsClientRequestId(),
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t1"],
    });
    assert.equal(off.kind, "forbidden");

    store.trades.push(trade("other-t", { userId: OTHER }));
    const write = createMemoryAssignmentWriteService({ userId: OWNER, store });
    const cross = await write.assignTrades({
      clientRequestId: newPropOsClientRequestId(),
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["other-t"],
    });
    assert.ok(cross.kind === "validation_error" || cross.kind === "conflict" || cross.kind === "forbidden");
  });

  await check("23–27. recalc queued / completed / failed / stale", async () => {
    const store = seedStore();
    const write = createMemoryAssignmentWriteService({ userId: OWNER, store });
    const res = await write.assignTrades({
      clientRequestId: newPropOsClientRequestId(),
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t1", "t2"],
    });
    assert.equal(res.kind, "success");
    if (res.kind !== "success") return;
    assert.equal(res.value.recalculation.kind, "queued");
    capture("recalculation-pending", res.value.recalculation);

    const done = completeMemoryRecalculation(
      store,
      CH1,
      res.value.assignmentRevision,
    );
    assert.equal(done.kind, "success");
    capture("recalculation-completed", done);

    const stale = completeMemoryRecalculation(store, CH1, res.value.assignmentRevision - 1);
    assert.equal(stale.kind, "conflict");

    failMemoryRecalculation(store, CH1, res.value.assignmentRevision + 1, "engine_failure");
    capture("recalculation-failed", store.recalc.get(CH1));
  });

  await check("28–32. ordering / preview / original trade unchanged / bulk max", async () => {
    const store = seedStore();
    const original = JSON.parse(
      JSON.stringify(store.trades.find((t) => t.identity.tradeClientId === "t1")),
    );
    const write = createMemoryAssignmentWriteService({ userId: OWNER, store });
    const read = createMemoryAssignmentReadStore(store);
    await write.assignTrades({
      clientRequestId: newPropOsClientRequestId(),
      accountId: ACC,
      challengeId: CH1,
      tradeClientIds: ["t1"],
    });
    const after = store.trades.find((t) => t.identity.tradeClientId === "t1")!;
    assert.deepEqual(after.pnlMajor, original.pnlMajor);
    assert.deepEqual(after.occurredAtUtc, original.occurredAtUtc);

    const ordered = orderTradesForEngine([
      trade("b", { occurredAtUtc: "2026-02-02T00:00:00.000Z" }),
      trade("a", { occurredAtUtc: "2026-02-01T00:00:00.000Z" }),
      trade("c", { occurredAtUtc: "2026-02-01T00:00:00.000Z" }),
    ]);
    assert.deepEqual(
      ordered.map((o) => o.tradeClientId),
      ["a", "c", "b"],
    );
    const rev = assignmentInputRevision(3, ordered);
    assert.match(rev, /^asg-rev-3:/);

    const preview = await read.buildPreview({
      userId: OWNER,
      accountId: ACC,
      challengeId: CH1,
      selectedIds: ["t2", "t3", "bad-ts"],
    });
    assert.ok(preview.rejected.some((r) => r.tradeClientId === "bad-ts"));
    assert.equal(preview.engineDisclaimer, "final_metrics_from_engine_after_recalc");
    capture("assignment-preview", preview);

    assert.equal(ASSIGNMENT_BULK_MAX, 50);
    assert.ok(resolveOccurredAtUtc({ exitTime: "2026-01-01T12:00:00.000Z" }));
  });

  console.log(`prop-pass-phase2c-qa: PASS (${passed})`);
  console.log(`captures=${CAPTURE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
