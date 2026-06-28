import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
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

export function stableSecurityHash(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function bucketKey(action: SecurityAction, actor = "local") {
  return `security-rate:${actor}:${action}`;
}

export async function checkClientRateLimit(action: SecurityAction, actor = "local") {
  const key = bucketKey(action, actor);
  const now = Date.now();
  const windowMs = WINDOW_MS[action];
  const limit = LIMITS[action];
  let bucket: RateBucket = { startedAt: now, count: 0 };
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) bucket = JSON.parse(raw);
  } catch {
    bucket = { startedAt: now, count: 0 };
  }
  if (!bucket.startedAt || now - bucket.startedAt > windowMs) {
    bucket = { startedAt: now, count: 0 };
  }
  if (bucket.count >= limit) {
    await recordSecurityEvent("rate_limit_exceeded", action, actor);
    return { allowed: false, retryAfterMs: Math.max(0, windowMs - (now - bucket.startedAt)) };
  }
  bucket.count += 1;
  await AsyncStorage.setItem(key, JSON.stringify(bucket));
  return { allowed: true, retryAfterMs: 0 };
}

export async function runIdempotentLocal<T>(
  action: SecurityAction,
  actor: string,
  payload: unknown,
  task: () => Promise<T> | T,
) {
  const id = stableSecurityHash(`${action}:${actor}:${JSON.stringify(payload)}`);
  const key = `security-idempotency:${id}`;
  const existing = await AsyncStorage.getItem(key);
  if (existing) {
    await recordSecurityEvent("duplicate_idempotency_key", action, actor);
    return { duplicate: true, value: JSON.parse(existing) as T };
  }
  const value = await task();
  await AsyncStorage.setItem(key, JSON.stringify(value));
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
