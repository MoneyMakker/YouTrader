import { SECURITY_LIMITS } from "./securityConfig";

export const EXPORT_RATE_ACTION = "export:generate" as const;
export const EXPORT_RATE_ACTOR = "stats-local" as const;
export const EXPORT_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const EXPORT_RATE_LIMIT = SECURITY_LIMITS.exportsPerDay;
export const EXPORT_IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;
export const EXPORT_RATE_LIMIT_SCHEMA_VERSION = 2;

export type RateBucket = { startedAt: number; count: number };

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
};

export type ClientRateLimitStatus = {
  allowed: boolean;
  retryAfterMs: number;
  retryAfterSeconds: number;
  count: number;
  limit: number;
  windowMs: number;
  startedAt: number;
  now: number;
  key: string;
  reason: string;
};

export function stableSecurityHash(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function bucketKey(action: string, actor = "local") {
  return `security-rate:${actor}:${action}`;
}

export function normalizeTimestamp(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
}

export function createMemoryStorage() {
  const store = new Map<string, string>();
  const storage: KeyValueStorage & { store: Map<string, string> } = {
    store,
    async getItem(key) {
      return store.get(key) ?? null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
    async multiRemove(keys) {
      keys.forEach((key) => store.delete(key));
    },
  };
  return storage;
}

export function logExportRateLimitScenario(
  scenario: string,
  message: string,
  status: Partial<ClientRateLimitStatus> & { count?: number },
) {
  const payload = {
    scenario,
    message,
    count: status.count,
    limit: status.limit ?? EXPORT_RATE_LIMIT,
    allowed: status.allowed,
    remainingCooldownSeconds: status.retryAfterSeconds,
    reason: status.reason,
  };
  console.warn(`[YouTrader:export-rate-limit-qa] ${scenario}: ${message}`, payload);
}

async function readRateBucket(
  storage: KeyValueStorage,
  now: number,
  action: string,
  actor: string,
  schemaVersion = EXPORT_RATE_LIMIT_SCHEMA_VERSION,
) {
  const key = bucketKey(action, actor);
  const versionKey = `${key}:v`;
  const windowMs = EXPORT_RATE_WINDOW_MS;
  const limit = EXPORT_RATE_LIMIT;
  let bucket: RateBucket = { startedAt: now, count: 0 };
  try {
    const storedVersion = Number(await storage.getItem(versionKey));
    if (storedVersion !== schemaVersion) {
      await storage.multiRemove([key, versionKey]);
      await storage.setItem(versionKey, String(schemaVersion));
      bucket = { startedAt: now, count: 0 };
    } else {
      const raw = await storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<RateBucket>;
        const startedAt = normalizeTimestamp(parsed.startedAt);
        const count = Number(parsed.count);
        if (startedAt > 0 && Number.isFinite(count) && count >= 0) {
          bucket = { startedAt, count };
        }
      }
    }
  } catch {
    bucket = { startedAt: now, count: 0 };
  }
  if (!bucket.startedAt || now - bucket.startedAt > windowMs) {
    bucket = { startedAt: now, count: 0 };
  }
  const allowed = bucket.count < limit;
  const retryAfterMs = allowed ? 0 : Math.max(0, windowMs - (now - bucket.startedAt));
  return {
    key,
    now,
    windowMs,
    limit,
    bucket,
    allowed,
    retryAfterMs,
    retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
  };
}

export async function peekExportRateLimit(
  storage: KeyValueStorage,
  now: number,
  reason = "peek",
): Promise<ClientRateLimitStatus> {
  const state = await readRateBucket(storage, now, EXPORT_RATE_ACTION, EXPORT_RATE_ACTOR);
  return {
    allowed: state.allowed,
    retryAfterMs: state.retryAfterMs,
    retryAfterSeconds: state.retryAfterSeconds,
    count: state.bucket.count,
    limit: state.limit,
    windowMs: state.windowMs,
    startedAt: state.bucket.startedAt,
    now: state.now,
    key: state.key,
    reason,
  };
}

export async function consumeExportRateLimit(
  storage: KeyValueStorage,
  now: number,
): Promise<ClientRateLimitStatus> {
  const state = await readRateBucket(storage, now, EXPORT_RATE_ACTION, EXPORT_RATE_ACTOR);
  if (!state.allowed) {
    return {
      allowed: false,
      retryAfterMs: state.retryAfterMs,
      retryAfterSeconds: state.retryAfterSeconds,
      count: state.bucket.count,
      limit: state.limit,
      windowMs: state.windowMs,
      startedAt: state.bucket.startedAt,
      now: state.now,
      key: state.key,
      reason: "consume_blocked",
    };
  }
  const nextBucket: RateBucket = {
    startedAt: state.bucket.startedAt || state.now,
    count: state.bucket.count + 1,
  };
  await storage.setItem(state.key, JSON.stringify(nextBucket));
  return {
    allowed: true,
    retryAfterMs: 0,
    retryAfterSeconds: 0,
    count: nextBucket.count,
    limit: state.limit,
    windowMs: state.windowMs,
    startedAt: nextBucket.startedAt,
    now: state.now,
    key: state.key,
    reason: "consume_ok",
  };
}

export async function runExportIdempotentLocal<T>(
  storage: KeyValueStorage,
  now: number,
  payload: unknown,
  task: () => Promise<T> | T,
) {
  const id = stableSecurityHash(`${EXPORT_RATE_ACTION}:${EXPORT_RATE_ACTOR}:${JSON.stringify(payload)}`);
  const key = `security-idempotency:${id}`;
  const existing = await storage.getItem(key);
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as { value?: T; expiresAt?: number };
      if (parsed && typeof parsed === "object" && "expiresAt" in parsed) {
        if (Number(parsed.expiresAt) > now && "value" in parsed) {
          return { duplicate: true as const, value: parsed.value as T };
        }
      } else {
        return { duplicate: true as const, value: parsed as T };
      }
    } catch {
      // Corrupt idempotency record — allow retry.
    }
  }
  const value = await task();
  await storage.setItem(key, JSON.stringify({ value, expiresAt: now + EXPORT_IDEMPOTENCY_TTL_MS }));
  return { duplicate: false as const, value };
}

export type ExportFlowAction = "share" | "save";

/** Mirrors App.tsx export rate-limit behavior (peek → gates → idempotent → consume). */
export async function simulateExportFlow(
  storage: KeyValueStorage,
  now: number,
  input: {
    action: ExportFlowAction;
    exportKey: Record<string, unknown>;
    isPremium: boolean;
    generationSucceeds: boolean;
  },
) {
  const before = await peekExportRateLimit(storage, now, "export_attempt");
  if (!before.allowed) {
    return { outcome: "blocked_rate_limit" as const, before, after: before };
  }
  if (!input.isPremium && input.action === "save") {
    const after = await peekExportRateLimit(storage, now, "blocked_pro_paywall");
    return { outcome: "blocked_paywall" as const, before, after };
  }
  try {
    const result = await runExportIdempotentLocal(storage, now, input.exportKey, async () => {
      if (!input.generationSucceeds) {
        throw new Error("Share card is not ready");
      }
      return `file://${input.action}`;
    });
    if (!result.duplicate) {
      const consumed = await consumeExportRateLimit(storage, now);
      return { outcome: `success_${input.action}` as const, before, after: consumed, duplicate: false };
    }
    const after = await peekExportRateLimit(storage, now, "duplicate_skipped");
    return { outcome: "duplicate_skipped" as const, before, after, duplicate: true };
  } catch {
    const after = await peekExportRateLimit(storage, now, "export_failed");
    return { outcome: "failed_generation" as const, before, after };
  }
}

export async function seedLegacyStuckBucket(storage: KeyValueStorage, now: number, count = EXPORT_RATE_LIMIT) {
  const key = bucketKey(EXPORT_RATE_ACTION, EXPORT_RATE_ACTOR);
  const versionKey = `${key}:v`;
  await storage.setItem(versionKey, "1");
  await storage.setItem(key, JSON.stringify({ startedAt: now - 60_000, count }));
}

export function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

export async function runExportRateLimitQa() {
  const results: { scenario: string; passed: boolean; error?: string }[] = [];
  const run = async (scenario: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ scenario, passed: true });
      logExportRateLimitScenario(scenario, "PASS", {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ scenario, passed: false, error: message });
      logExportRateLimitScenario(scenario, `FAIL — ${message}`, {});
    }
  };

  await run("1_free_paywall_no_consume", async () => {
    const storage = createMemoryStorage();
    const now = Date.now();
    const exportKey = { action: "save", period: "month", selectedDate: "2026-07-03", count: 3, pnl: 120 };
    const flow = await simulateExportFlow(storage, now, {
      action: "save",
      exportKey,
      isPremium: false,
      generationSucceeds: true,
    });
    logExportRateLimitScenario("1_free_paywall_no_consume", "paywall blocked save", flow.after);
    assertEqual(flow.outcome, "blocked_paywall", "outcome");
    assertEqual(flow.after.count, 0, "count after paywall");
  });

  await run("2_failed_generation_no_consume", async () => {
    const storage = createMemoryStorage();
    const now = Date.now();
    const exportKey = { action: "share", period: "month", selectedDate: "2026-07-03", count: 3, pnl: 120 };
    const flow = await simulateExportFlow(storage, now, {
      action: "share",
      exportKey,
      isPremium: true,
      generationSucceeds: false,
    });
    logExportRateLimitScenario("2_failed_generation_no_consume", "generation failed", flow.after);
    assertEqual(flow.outcome, "failed_generation", "outcome");
    assertEqual(flow.after.count, 0, "count after failure");
  });

  await run("3_success_share_increments", async () => {
    const storage = createMemoryStorage();
    const now = Date.now();
    const exportKey = { action: "share", period: "month", selectedDate: "2026-07-03", count: 3, pnl: 120 };
    const flow = await simulateExportFlow(storage, now, {
      action: "share",
      exportKey,
      isPremium: true,
      generationSucceeds: true,
    });
    logExportRateLimitScenario("3_success_share_increments", "share succeeded", flow.after);
    assertEqual(flow.outcome, "success_share", "outcome");
    assertEqual(flow.after.count, 1, "count after share");
  });

  await run("4_success_save_increments", async () => {
    const storage = createMemoryStorage();
    const now = Date.now();
    const exportKey = { action: "save", period: "month", selectedDate: "2026-07-03", count: 3, pnl: 120 };
    const flow = await simulateExportFlow(storage, now, {
      action: "save",
      exportKey,
      isPremium: true,
      generationSucceeds: true,
    });
    logExportRateLimitScenario("4_success_save_increments", "save succeeded", flow.after);
    assertEqual(flow.outcome, "success_save", "outcome");
    assertEqual(flow.after.count, 1, "count after save");
  });

  await run("5_duplicate_idempotency_no_double_count", async () => {
    const storage = createMemoryStorage();
    const now = Date.now();
    const exportKey = { action: "share", period: "month", selectedDate: "2026-07-03", count: 3, pnl: 120 };
    const first = await simulateExportFlow(storage, now, {
      action: "share",
      exportKey,
      isPremium: true,
      generationSucceeds: true,
    });
    const second = await simulateExportFlow(storage, now + 1000, {
      action: "share",
      exportKey,
      isPremium: true,
      generationSucceeds: true,
    });
    logExportRateLimitScenario("5_duplicate_idempotency_no_double_count", "first export", first.after);
    logExportRateLimitScenario("5_duplicate_idempotency_no_double_count", "duplicate export", second.after);
    assertEqual(first.after.count, 1, "count after first");
    assertEqual(second.outcome, "duplicate_skipped", "duplicate outcome");
    assertEqual(second.after.count, 1, "count after duplicate");
  });

  await run("6_migration_v2_clears_stuck_bucket", async () => {
    const storage = createMemoryStorage();
    const now = Date.now();
    await seedLegacyStuckBucket(storage, now, EXPORT_RATE_LIMIT);
    const key = bucketKey(EXPORT_RATE_ACTION, EXPORT_RATE_ACTOR);
    const rawLegacy = await storage.getItem(key);
    const legacyBucket = rawLegacy ? (JSON.parse(rawLegacy) as RateBucket) : { startedAt: 0, count: 0 };
    logExportRateLimitScenario("6_migration_v2_clears_stuck_bucket", "legacy raw bucket before migration", {
      count: legacyBucket.count,
      reason: "legacy_v1",
    });
    assertEqual(legacyBucket.count, EXPORT_RATE_LIMIT, "legacy raw count");
    const afterMigration = await peekExportRateLimit(storage, now, "legacy_stuck_after_migration");
    logExportRateLimitScenario("6_migration_v2_clears_stuck_bucket", "bucket after migration read", afterMigration);
    assertEqual(afterMigration.count, 0, "count after migration");
    assertEqual(afterMigration.allowed, true, "allowed after migration");
  });

  await run("7_window_expiry_resets_count", async () => {
    const storage = createMemoryStorage();
    const start = Date.now();
    const exportKey = { action: "share", period: "month", selectedDate: "2026-07-03", count: 3, pnl: 120 };
    const first = await simulateExportFlow(storage, start, {
      action: "share",
      exportKey,
      isPremium: true,
      generationSucceeds: true,
    });
    assertEqual(first.after.count, 1, "count in first window");
    const afterWindow = start + EXPORT_RATE_WINDOW_MS + 1;
    const reset = await peekExportRateLimit(storage, afterWindow, "window_expired");
    logExportRateLimitScenario("7_window_expiry_resets_count", "bucket after 24h window", reset);
    assertEqual(reset.count, 0, "count after window");
    assertEqual(reset.allowed, true, "allowed after window");
    const second = await simulateExportFlow(storage, afterWindow, {
      action: "share",
      exportKey: { ...exportKey, pnl: 121 },
      isPremium: true,
      generationSucceeds: true,
    });
    assertEqual(second.after.count, 1, "count after new window export");
  });

  const failed = results.filter((result) => !result.passed);
  if (failed.length) {
    console.error("\n[YouTrader:export-rate-limit-qa] FAILED scenarios:");
    failed.forEach((result) => console.error(`  - ${result.scenario}: ${result.error}`));
    process.exit(1);
  }
  console.log(`\n[YouTrader:export-rate-limit-qa] All ${results.length} scenarios passed.`);
}
