import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error Node's strip-types runner requires the explicit extension.
import { runQuotaLifecycle, type QuotaReservation } from "../../supabase/functions/_shared/aiQuotaOrchestrator.ts";

type Status = "reserved" | "completed" | "provider_failed" | "released";

function lifecycle(reservation: QuotaReservation, provider: () => Promise<{ usable: boolean }> = async () => ({ usable: true })) {
  const transitions: Array<{ target: Status; reason?: string }> = [];
  let calls = 0;
  return {
    transitions,
    calls: () => calls,
    result: runQuotaLifecycle({
      reserve: async () => reservation,
      transition: async (target, reason) => {
        transitions.push({ target, reason });
        return true;
      },
      invokeProvider: async () => {
        calls += 1;
        return provider();
      },
      isUsable: (result) => result.usable,
      timeoutMs: 25,
    }),
  };
}

async function testLifecycle() {
  const success = lifecycle({ kind: "reserved", status: "reserved", replay: false });
  assert.equal((await success.result).kind, "success");
  assert.equal(success.calls(), 1);
  assert.deepEqual(success.transitions, [{ target: "completed", reason: undefined }]);

  const duplicate = lifecycle({ kind: "reserved", status: "completed", replay: true });
  assert.deepEqual(await duplicate.result, { kind: "unavailable", reason: "duplicate" });
  assert.equal(duplicate.calls(), 0);
  assert.equal(duplicate.transitions.length, 0);

  const denied = lifecycle({ kind: "denied" });
  assert.deepEqual(await denied.result, { kind: "denied" });
  assert.equal(denied.calls(), 0);

  const databaseFailure = lifecycle({ kind: "failure" });
  assert.deepEqual(await databaseFailure.result, { kind: "unavailable", reason: "quota" });
  assert.equal(databaseFailure.calls(), 0);

  const thrownDatabaseFailure = runQuotaLifecycle({
    reserve: async () => { throw new Error("database unavailable"); },
    transition: async () => true,
    invokeProvider: async () => ({ usable: true }),
    isUsable: (result) => result.usable,
    timeoutMs: 25,
  });
  assert.deepEqual(await thrownDatabaseFailure, { kind: "unavailable", reason: "quota" });

  const providerFailure = lifecycle({ kind: "reserved", status: "reserved", replay: false }, async () => {
    throw new Error("provider unavailable");
  });
  assert.deepEqual(await providerFailure.result, { kind: "unavailable", reason: "provider" });
  assert.deepEqual(providerFailure.transitions, [{ target: "provider_failed", reason: "provider_failure" }]);

  const timeout = lifecycle({ kind: "reserved", status: "reserved", replay: false }, () => new Promise(() => undefined));
  assert.deepEqual(await timeout.result, { kind: "unavailable", reason: "provider" });
  assert.deepEqual(timeout.transitions, [{ target: "provider_failed", reason: "provider_failure" }]);

  const unusable = lifecycle({ kind: "reserved", status: "reserved", replay: false }, async () => ({ usable: false }));
  assert.equal((await unusable.result).kind, "success");
  assert.deepEqual(unusable.transitions, [{ target: "released", reason: "unusable_result" }]);
}

async function testConcurrentReservations() {
  const seen = new Map<string, Status>();
  let used = 0;
  let providerCalls = 0;
  const reserve = async (requestId: string): Promise<QuotaReservation> => {
    const prior = seen.get(requestId);
    if (prior) return { kind: "reserved", status: prior, replay: true };
    if (used >= 3) return { kind: "denied" };
    used += 1;
    seen.set(requestId, "reserved");
    return { kind: "reserved", status: "reserved", replay: false };
  };
  const transition = async (requestId: string, target: Status) => {
    seen.set(requestId, target);
    return true;
  };
  const invoke = async () => { providerCalls += 1; return { usable: true }; };

  const outcomes = await Promise.all(Array.from({ length: 8 }, (_, index) => {
    const requestId = `request-${index}`;
    return runQuotaLifecycle({ reserve: () => reserve(requestId), transition: (target) => transition(requestId, target), invokeProvider: invoke, isUsable: (value) => value.usable, timeoutMs: 25 });
  }));
  assert.equal(outcomes.filter((outcome) => outcome.kind === "success").length, 3);
  assert.equal(providerCalls, 3);

  const duplicateSeen = new Map<string, Status>();
  let duplicateProviderCalls = 0;
  const reserveDuplicate = async (): Promise<QuotaReservation> => {
    const status = duplicateSeen.get("same-request");
    if (status) return { kind: "reserved", status, replay: true };
    duplicateSeen.set("same-request", "reserved");
    return { kind: "reserved", status: "reserved", replay: false };
  };
  const duplicate = await Promise.all(Array.from({ length: 5 }, () => runQuotaLifecycle({
    reserve: reserveDuplicate,
    transition: async (target) => { duplicateSeen.set("same-request", target); return true; },
    invokeProvider: async () => { duplicateProviderCalls += 1; return { usable: true }; },
    isUsable: (value) => value.usable,
    timeoutMs: 25,
  })));
  assert.equal(duplicate.filter((outcome) => outcome.kind === "success").length, 1);
  assert.equal(duplicateProviderCalls, 1, "duplicate retries invoke the provider once");
}

function testStaticSecurityContracts() {
  const migration = readFileSync("supabase/migrations/20260726003000_ai_quota_lifecycle.sql", "utf8");
  const coach = readFileSync("supabase/functions/ai-coach/index.ts", "utf8");
  const market = readFileSync("supabase/functions/market-intelligence/index.ts", "utf8");
  for (const source of [coach, market]) {
    assert.match(source, /runQuotaLifecycle/);
    assert.match(source, /Idempotency-Key/);
    assert.match(source, /AI service is temporarily unavailable/);
    assert.doesNotMatch(source, /console\.(?:log|warn|error)\([^\n]*(?:payload|prompt|token|key)/i);
  }
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path=pg_catalog,public/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
  assert.match(migration, /revoke all[\s\S]*from public,anon,authenticated/);
}

await testLifecycle();
await testConcurrentReservations();
testStaticSecurityContracts();
console.log("AI quota lifecycle QA passed");
