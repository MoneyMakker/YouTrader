import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { logger } from "../lib/logger";
import {
  EXPORT_IDEMPOTENCY_TTL_MS,
  EXPORT_RATE_LIMIT_SCHEMA_VERSION,
  normalizeTimestamp,
  stableSecurityHash,
} from "./exportRateLimitEngine";
import { SECURITY_LIMITS } from "./securityConfig";

export type SecurityAction =
  | "auth"
  | "trade:create"
  | "trade:update"
  | "trade:delete"
  | "upload:screenshot"
  | "upload:voice"
  | "csv:import"
  | "export:generate"
  | "purchase"
  | "restore"
  | "analytics";

const WINDOW_MS: Record<SecurityAction, number> = {
  auth: 60 * 60 * 1000,
  "trade:create": 60 * 1000,
  "trade:update": 60 * 1000,
  "trade:delete": 60 * 1000,
  "upload:screenshot": 60 * 60 * 1000,
  "upload:voice": 60 * 60 * 1000,
  "csv:import": 24 * 60 * 60 * 1000,
  "export:generate": 24 * 60 * 60 * 1000,
  purchase: 60 * 60 * 1000,
  restore: 60 * 60 * 1000,
  analytics: 60 * 60 * 1000,
};

const LIMITS: Record<SecurityAction, number> = {
  auth: SECURITY_LIMITS.authActionsPerHour,
  "trade:create": SECURITY_LIMITS.tradeCreatePerMinute,
  "trade:update": SECURITY_LIMITS.tradeUpdatePerMinute,
  "trade:delete": SECURITY_LIMITS.tradeDeletePerMinute,
  "upload:screenshot": SECURITY_LIMITS.uploadsPerHour,
  "upload:voice": SECURITY_LIMITS.uploadsPerHour,
  "csv:import": SECURITY_LIMITS.csvImportsPerDay,
  "export:generate": SECURITY_LIMITS.exportsPerDay,
  purchase: SECURITY_LIMITS.purchaseAttemptsPerHour,
  restore: SECURITY_LIMITS.restorePurchasePerHour,
  analytics: SECURITY_LIMITS.analyticsExportsPerHour,
};

type RateBucket = { startedAt: number; count: number };

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

const IDEMPOTENCY_TTL_MS = EXPORT_IDEMPOTENCY_TTL_MS;
const RATE_LIMIT_SCHEMA_VERSION = EXPORT_RATE_LIMIT_SCHEMA_VERSION;

export { stableSecurityHash } from "./exportRateLimitEngine";

function bucketKey(action: SecurityAction, actor = "local") {
  return `security-rate:${actor}:${action}`;
}

async function readRateBucket(action: SecurityAction, actor = "local") {
  const key = bucketKey(action, actor);
  const versionKey = `${key}:v`;
  const now = Date.now();
  const windowMs = WINDOW_MS[action];
  const limit = LIMITS[action];
  let bucket: RateBucket = { startedAt: now, count: 0 };
  try {
    const storedVersion = Number(await AsyncStorage.getItem(versionKey));
    if (storedVersion !== RATE_LIMIT_SCHEMA_VERSION) {
      await AsyncStorage.multiRemove([key, versionKey]);
      await AsyncStorage.setItem(versionKey, String(RATE_LIMIT_SCHEMA_VERSION));
      bucket = { startedAt: now, count: 0 };
    } else {
      const raw = await AsyncStorage.getItem(key);
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

export function logExportRateLimitDebug(
  status: ClientRateLimitStatus,
  context: string,
) {
  const payload = {
    context,
    reason: status.reason,
    now: status.now,
    nowIso: new Date(status.now).toISOString(),
    storedStartedAt: status.startedAt,
    storedStartedAtIso: status.startedAt ? new Date(status.startedAt).toISOString() : null,
    count: status.count,
    limit: status.limit,
    windowMs: status.windowMs,
    remainingCooldownMs: status.retryAfterMs,
    remainingCooldownSeconds: status.retryAfterSeconds,
    storageKey: status.key,
    allowed: status.allowed,
  };
  logger.warn("[YouTrader:export-rate-limit]", payload);
}

export async function peekClientRateLimit(
  action: SecurityAction,
  actor = "local",
  reason = "peek",
): Promise<ClientRateLimitStatus> {
  const state = await readRateBucket(action, actor);
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

export async function consumeClientRateLimit(
  action: SecurityAction,
  actor = "local",
): Promise<ClientRateLimitStatus> {
  const state = await readRateBucket(action, actor);
  if (!state.allowed) {
    await recordSecurityEvent("rate_limit_exceeded", action, actor);
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
  await AsyncStorage.setItem(state.key, JSON.stringify(nextBucket));
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

/** Checks and immediately consumes one rate-limit slot (legacy behavior). */
export async function checkClientRateLimit(action: SecurityAction, actor = "local") {
  const status = await consumeClientRateLimit(action, actor);
  return { allowed: status.allowed, retryAfterMs: status.retryAfterMs };
}

export async function runIdempotentLocal<T>(
  action: SecurityAction,
  actor: string,
  payload: unknown,
  task: () => Promise<T> | T,
) {
  const id = stableSecurityHash(`${action}:${actor}:${JSON.stringify(payload)}`);
  const key = `security-idempotency:${id}`;
  const now = Date.now();
  const existing = await AsyncStorage.getItem(key);
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as { value?: T; expiresAt?: number };
      if (parsed && typeof parsed === "object" && "expiresAt" in parsed) {
        if (Number(parsed.expiresAt) > now && "value" in parsed) {
          await recordSecurityEvent("duplicate_idempotency_key", action, actor);
          return { duplicate: true, value: parsed.value as T };
        }
      } else {
        await recordSecurityEvent("duplicate_idempotency_key", action, actor);
        return { duplicate: true, value: parsed as T };
      }
    } catch {
      // Corrupt idempotency record — allow retry.
    }
  }
  const value = await task();
  await AsyncStorage.setItem(
    key,
    JSON.stringify({ value, expiresAt: now + IDEMPOTENCY_TTL_MS }),
  );
  return { duplicate: false, value };
}

export async function withTimeout<T>(task: PromiseLike<T>, timeoutMs: number = SECURITY_LIMITS.requestTimeoutMs): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function fileSizeBytes(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === "number" ? info.size : 0;
}

export async function validateFileSize(uri: string, maxBytes: number) {
  const size = await fileSizeBytes(uri);
  return size > 0 && size <= maxBytes;
}

export async function recordSecurityEvent(type: string, action: string, actor = "local") {
  const key = "security-events-local-v1";
  const event = {
    type,
    action,
    actor: stableSecurityHash(actor),
    at: new Date().toISOString(),
  };
  try {
    const raw = await AsyncStorage.getItem(key);
    const events = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(events) ? [event, ...events].slice(0, 100) : [event];
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Local security logs are best-effort and must never break the app.
  }
}
