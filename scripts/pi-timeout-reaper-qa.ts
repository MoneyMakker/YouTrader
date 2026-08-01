/**
 * Memory-level PI timeout contract tests (no DB).
 * Complements migration 20260731290000_prop_os_pi_timeout_reaper.sql.
 */
import assert from "node:assert/strict";

type CalcState = "queued" | "running" | "completed" | "failed";

type CalcJob = {
  state: CalcState;
  requestedAt: number;
  processingStartedAt: number | null;
  reasonCode: string | null;
};

const QUEUE_TIMEOUT_MS = 600_000;
const PROCESSING_TIMEOUT_MS = 300_000;

function reap(job: CalcJob, now: number): CalcJob {
  if (job.state === "queued" && now - job.requestedAt >= QUEUE_TIMEOUT_MS) {
    return { ...job, state: "failed", reasonCode: "queue_timeout", processingStartedAt: null };
  }
  if (
    job.state === "running" &&
    job.processingStartedAt != null &&
    now - job.processingStartedAt >= PROCESSING_TIMEOUT_MS
  ) {
    return { ...job, state: "failed", reasonCode: "processor_timeout", processingStartedAt: null };
  }
  return job;
}

function shouldPoll(state: CalcState): boolean {
  return state === "queued" || state === "running";
}

function run() {
  const t0 = 1_000_000;
  const freshQueued: CalcJob = {
    state: "queued",
    requestedAt: t0,
    processingStartedAt: null,
    reasonCode: null,
  };
  assert.equal(reap(freshQueued, t0 + 60_000).state, "queued");
  assert.equal(reap(freshQueued, t0 + QUEUE_TIMEOUT_MS + 1).reasonCode, "queue_timeout");
  assert.equal(reap(freshQueued, t0 + QUEUE_TIMEOUT_MS + 1).state, "failed");

  const running: CalcJob = {
    state: "running",
    requestedAt: t0,
    processingStartedAt: t0 + 1_000,
    reasonCode: null,
  };
  assert.equal(reap(running, t0 + 10_000).state, "running");
  const timed = reap(running, t0 + 1_000 + PROCESSING_TIMEOUT_MS + 1);
  assert.equal(timed.state, "failed");
  assert.equal(timed.reasonCode, "processor_timeout");
  assert.equal(timed.processingStartedAt, null);

  assert.equal(shouldPoll("queued"), true);
  assert.equal(shouldPoll("running"), true);
  assert.equal(shouldPoll("failed"), false);
  assert.equal(shouldPoll("completed"), false);

  // Retry eligibility: after timeout, client may request again (new queued job)
  const afterTimeout = timed;
  assert.equal(afterTimeout.state, "failed");
  const retried: CalcJob = {
    state: "queued",
    requestedAt: t0 + 2_000_000,
    processingStartedAt: null,
    reasonCode: null,
  };
  assert.equal(reap(retried, t0 + 2_000_000 + 1_000).state, "queued");

  console.log("pi-timeout-reaper-qa: PASS");
}

run();
