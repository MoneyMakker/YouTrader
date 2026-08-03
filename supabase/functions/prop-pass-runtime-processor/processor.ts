import type { SupabaseClient } from "npm:@supabase/supabase-js@2.75.0";
import { rebuildPropPassRuntime } from "../_shared/propPassRuntime.bundle.js";

type PendingEvent = {
  user_id: string;
  account_id: string;
  challenge_id: string | null;
  event_key: string;
  trade_revision: number;
};
type RuntimeBundle = {
  accountRow: Record<string, unknown>;
  challengeRow: Record<string, unknown>;
  ruleSnapshotRow: Record<string, unknown>;
  executions: Record<string, unknown>[];
  accountEvents: Record<string, unknown>[];
  asOfUtc: string;
  selectedMode: "calm" | "balanced" | "gambler" | null;
  currentDailyPlan: Record<string, unknown> | null;
  persistedTimelineFacts: Record<string, unknown>[];
  killSwitchSettings: Record<string, unknown> | null;
  liveRiskSettings: Record<string, unknown> | null;
  recoveryState: Record<string, unknown> | null;
};

export type RuntimeProcessorReport = Readonly<{
  claimed: number;
  applied: number;
  alreadyApplied: number;
  failed: number;
}>;

export async function saveLiveRiskSettings(
  client: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<RuntimeProcessorReport> {
  const body = requiredObject(input, "settings_body");
  const accountId = requiredText(body.accountId, "account_id");
  const settings = validateLiveSettings(body.settings);
  const challengeId = await activeChallengeId(client, userId, accountId);
  const updated = await client.from("prop_live_risk_settings").upsert({
    user_id: userId, account_id: accountId, payload: settings, updated_at: settings.configuredAt,
  }, { onConflict: "user_id,account_id" });
  if (updated.error) throw new Error(`live_settings_write_failed:${updated.error.code ?? "unknown"}`);
  await queueSettingsRecalculation(client, userId, accountId, challengeId, "live_risk", settings);
  return processPendingRuntimeEvents(client, userId, 4);
}

export async function setManualSessionLock(
  client: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<RuntimeProcessorReport> {
  const body = requiredObject(input, "session_lock_body");
  const accountId = requiredText(body.accountId, "account_id");
  if (body.confirm !== true) throw new Error("manual_session_lock_confirmation_required");
  const challengeId = await activeChallengeId(client, userId, accountId);
  const current = await client.from("prop_kill_switch_settings").select("payload").eq("user_id", userId).eq("account_id", accountId).maybeSingle();
  if (current.error) throw new Error(`kill_switch_read_failed:${current.error.code ?? "unknown"}`);
  const prior = objectOrNull(current.data?.payload);
  const configuration = objectOrNull(prior?.configuration) ?? {
    maximumDailyLossMinor: null, maximumWeeklyLossMinor: null,
    maximumTradeCount: null, consecutiveLossLimit: null, cutoffMinuteLocal: null,
    stopAfterProfitLock: false, resetStrategy: "next_trading_day",
  };
  validateKillSwitchConfiguration(configuration);
  const now = new Date().toISOString();
  const settings = {
    configuration, configuredAt: now, manualSessionLockRequested: true,
    manualSessionLockConfirmed: true, manualSessionLockActivatedAt: now,
  };
  const updated = await client.from("prop_kill_switch_settings").upsert({
    user_id: userId, account_id: accountId, payload: settings, updated_at: now,
  }, { onConflict: "user_id,account_id" });
  if (updated.error) throw new Error(`kill_switch_write_failed:${updated.error.code ?? "unknown"}`);
  await queueSettingsRecalculation(client, userId, accountId, challengeId, "manual_lock", settings);
  return processPendingRuntimeEvents(client, userId, 4);
}

export async function processPendingRuntimeEvents(
  client: SupabaseClient,
  userId: string,
  limit = 4,
): Promise<RuntimeProcessorReport> {
  const { data, error } = await client.rpc("prop_os_processor_claim_pending_journal_events", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw new Error(`queue_claim_failed:${error.code ?? "unknown"}`);
  const events = Array.isArray(data) ? data as PendingEvent[] : [];
  let applied = 0;
  let alreadyApplied = 0;
  let failed = 0;
  for (const event of events) {
    try {
      const result = await processOne(client, event);
      if (result === "already_applied") alreadyApplied += 1;
      else applied += 1;
    } catch (error) {
      failed += 1;
      const digest = hashPropOsCommandPayload("prop_pass_runtime_failure", {
        eventKey: event.event_key,
        code: safeErrorCode(error),
      });
      await client.rpc("prop_os_processor_fail_journal_event", {
        p_user_id: event.user_id,
        p_event_key: event.event_key,
        p_result_digest: digest,
      });
    }
  }
  return { claimed: events.length, applied, alreadyApplied, failed };
}

async function processOne(
  client: SupabaseClient,
  event: PendingEvent,
): Promise<"applied" | "already_applied"> {
  if (!event.challenge_id) throw new Error("challenge_required");
  const bundle = await loadBundle(client, event);
  const rebuilt = rebuildPropPassRuntime(bundle);
  const { data: prior, error: priorError } = await client
    .from("prop_account_runtime_states")
    .select("state_revision")
    .eq("user_id", event.user_id)
    .eq("account_id", event.account_id)
    .maybeSingle();
  if (priorError) throw new Error(`runtime_revision_read_failed:${priorError.code ?? "unknown"}`);
  const priorRevision = Number(prior?.state_revision ?? 0);
  const stateRevision = Math.max(priorRevision + 1, Number(event.trade_revision));
  const resultDigest = hashPropOsCommandPayload("prop_pass_journal_result", rebuilt.output);
  // The digest intentionally excludes event identity. Concurrent wake-ups that
  // rebuild the same canonical state at the same revision reconcile safely.
  const stateDigest = hashPropOsCommandPayload("prop_pass_runtime_state", {
    stateRevision,
    output: rebuilt.output,
  });
  const calculatedAt = bundle.asOfUtc;
  const { data, error } = await client.rpc("prop_os_processor_complete_journal_event", {
    p_user_id: event.user_id,
    p_event_key: event.event_key,
    p_result_digest: resultDigest,
    p_state_revision: stateRevision,
    p_calculation_version: rebuilt.output.calculationVersion,
    p_rule_version: rebuilt.ruleVersion,
    p_instrument_version: rebuilt.instrumentVersion,
    p_lifecycle_status: rebuilt.lifecycleStatus,
    p_state_payload: rebuilt.output,
    p_state_digest: stateDigest,
    p_calculated_at: calculatedAt,
  });
  if (error) throw new Error(`runtime_complete_failed:${error.code ?? "unknown"}`);
  const kind = typeof data === "object" && data ? String((data as { kind?: string }).kind ?? "") : "";
  if (kind === "applied" || kind === "already_applied") return kind;
  throw new Error(`runtime_complete_${kind || "unknown"}`);
}

async function loadBundle(
  client: SupabaseClient,
  event: PendingEvent,
): Promise<RuntimeBundle> {
  const [account, challenge, rules, executions, accountEvents, plans, timeline, killSettings, liveSettings, recoveryState] = await Promise.all([
    requiredSingle(client.from("prop_accounts").select("*").eq("user_id", event.user_id).eq("id", event.account_id).maybeSingle(), "account"),
    requiredSingle(client.from("prop_challenges").select("*").eq("user_id", event.user_id).eq("id", event.challenge_id!).maybeSingle(), "challenge"),
    requiredSingle(client.from("prop_challenge_rule_snapshots").select("*").eq("user_id", event.user_id).eq("challenge_id", event.challenge_id!).maybeSingle(), "rules"),
    rows(client.from("prop_executions").select("*").eq("user_id", event.user_id).eq("challenge_id", event.challenge_id!).order("occurred_at", { ascending: true }), "executions"),
    rows(client.from("prop_account_events").select("*").eq("user_id", event.user_id).eq("challenge_id", event.challenge_id!).order("occurred_at", { ascending: true }), "account_events"),
    rows(client.from("prop_daily_plan_snapshots").select("payload").eq("user_id", event.user_id).eq("account_id", event.account_id).order("trading_day", { ascending: false }).limit(1), "daily_plan"),
    rows(client.from("prop_timeline_events").select("payload").eq("user_id", event.user_id).eq("account_id", event.account_id).order("occurred_at", { ascending: true }), "timeline"),
    optionalSingle(client.from("prop_kill_switch_settings").select("payload").eq("user_id", event.user_id).eq("account_id", event.account_id).maybeSingle(), "kill_switch"),
    optionalSingle(client.from("prop_live_risk_settings").select("payload").eq("user_id", event.user_id).eq("account_id", event.account_id).maybeSingle(), "live_settings"),
    optionalSingle(client.from("prop_recovery_mode_states").select("payload,updated_at").eq("user_id", event.user_id).eq("account_id", event.account_id).maybeSingle(), "recovery_state"),
  ]);
  const livePayload = objectOrNull(liveSettings?.payload);
  return {
    accountRow: account,
    challengeRow: challenge,
    ruleSnapshotRow: rules,
    executions,
    accountEvents,
    asOfUtc: new Date().toISOString(),
    selectedMode: mode(livePayload?.selectedMode),
    currentDailyPlan: objectOrNull(plans[0]?.payload),
    persistedTimelineFacts: timeline.map((row) => objectOrNull(row.payload)).filter((row): row is Record<string, unknown> => Boolean(row)),
    killSwitchSettings: objectOrNull(killSettings?.payload),
    liveRiskSettings: livePayload,
    recoveryState: recoveryState
      ? { state: objectOrNull(recoveryState.payload), updatedAt: recoveryState.updated_at }
      : null,
  };
}

async function requiredSingle(query: PromiseLike<{ data: unknown; error: { code?: string } | null }>, label: string): Promise<Record<string, unknown>> {
  const { data, error } = await query;
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error(`${label}_read_failed:${error?.code ?? "not_found"}`);
  return data as Record<string, unknown>;
}
async function optionalSingle(query: PromiseLike<{ data: unknown; error: { code?: string } | null }>, label: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await query;
  if (error) throw new Error(`${label}_read_failed:${error.code ?? "unknown"}`);
  return objectOrNull(data);
}
async function rows(query: PromiseLike<{ data: unknown; error: { code?: string } | null }>, label: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await query;
  if (error || !Array.isArray(data)) throw new Error(`${label}_read_failed:${error?.code ?? "invalid_rows"}`);
  return data.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row)));
}
function objectOrNull(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function mode(value: unknown): RuntimeBundle["selectedMode"] { return value === "calm" || value === "balanced" || value === "gambler" ? value : null; }
function safeErrorCode(error: unknown): string { const value = error instanceof Error ? error.message.split(":", 1)[0] : "calculation_failed"; return /^[a-z0-9_]+$/i.test(value) ? value : "calculation_failed"; }

/** Stable non-cryptographic digest used only for idempotency comparison. */
function hashPropOsCommandPayload(commandType: string, body: unknown): string {
  const raw = `${commandType}\0${stableStringify(body)}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
  let out = ""; let x = h >>> 0;
  for (let i = 0; i < 8; i += 1) { out += (x & 0xff).toString(16).padStart(2, "0"); x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0; }
  let h2 = 0x811c9dc5;
  for (let i = raw.length - 1; i >= 0; i -= 1) { h2 ^= raw.charCodeAt(i); h2 = Math.imul(h2, 0x01000193); }
  let y = h2 >>> 0;
  for (let i = 0; i < 8; i += 1) { out += (y & 0xff).toString(16).padStart(2, "0"); y = Math.imul(y ^ (y >>> 11), 0x27d4eb2d) >>> 0; }
  return out;
}
function stableStringify(value: unknown): string { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`; const object = value as Record<string, unknown>; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`; }

async function activeChallengeId(client: SupabaseClient, userId: string, accountId: string): Promise<string> {
  const account = await client.from("prop_accounts").select("id").eq("user_id", userId).eq("id", accountId).maybeSingle();
  if (account.error || !account.data) throw new Error("account_forbidden_or_missing");
  const challenge = await client.from("prop_challenges").select("id").eq("user_id", userId).eq("account_id", accountId).in("status", ["active", "at_risk", "passed", "funded"]).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (challenge.error || !challenge.data?.id) throw new Error("active_challenge_required");
  return String(challenge.data.id);
}
async function queueSettingsRecalculation(client: SupabaseClient, userId: string, accountId: string, challengeId: string, kind: string, payload: unknown): Promise<void> {
  const digest = hashPropOsCommandPayload(`prop_pass_${kind}_settings`, payload);
  const eventKey = `${accountId}:settings:${kind}:${digest}`;
  const queued = await client.rpc("prop_os_processor_queue_settings_recalculation", { p_user_id: userId, p_account_id: accountId, p_challenge_id: challengeId, p_event_key: eventKey, p_input_digest: digest });
  if (queued.error || (queued.data as { kind?: string } | null)?.kind !== "success") throw new Error(`settings_queue_failed:${queued.error?.code ?? "rejected"}`);
}
function validateLiveSettings(value: unknown): Record<string, unknown> {
  const settings = requiredObject(value, "live_settings");
  const rules = requiredObject(settings.rules, "live_rules");
  for (const field of ["dailyRiskBudgetMinor", "weeklyLossLimitMinor", "maximumDrawdownMinor", "perTradeRiskCapMinor"] as const) nonNegativeInteger(rules[field], field);
  positiveInteger(rules.maximumTrades, "maximumTrades");
  positiveInteger(rules.consecutiveLossLimit, "consecutiveLossLimit");
  const threshold = nonNegativeInteger(rules.recoveryModeThresholdBps, "recoveryModeThresholdBps");
  if (threshold > 10_000) throw new Error("recoveryModeThresholdBps_invalid");
  if (!requiredText(rules.id, "live_rule_id")) throw new Error("live_rule_id_invalid");
  if (settings.selectedMode !== "calm" && settings.selectedMode !== "balanced" && settings.selectedMode !== "gambler") throw new Error("selected_mode_invalid");
  if (settings.weekStartsOn !== 0 && settings.weekStartsOn !== 1) throw new Error("week_start_invalid");
  nonNegativeInteger(settings.normalRiskPerTradeMinor, "normalRiskPerTradeMinor");
  positiveInteger(settings.normalMaximumContracts, "normalMaximumContracts");
  const recovery = nonNegativeInteger(settings.recoveryRiskBps, "recoveryRiskBps");
  if (recovery > 10_000) throw new Error("recoveryRiskBps_invalid");
  if (positiveInteger(settings.minimumCompliantProfitableSessions, "minimumCompliantProfitableSessions") < 2) throw new Error("minimumCompliantProfitableSessions_invalid");
  const configuredAt = requiredText(settings.configuredAt, "configuredAt");
  if (Number.isNaN(Date.parse(configuredAt))) throw new Error("configuredAt_invalid");
  return settings;
}
function validateKillSwitchConfiguration(value: Record<string, unknown>): void {
  for (const field of ["maximumDailyLossMinor", "maximumWeeklyLossMinor", "maximumTradeCount", "consecutiveLossLimit", "cutoffMinuteLocal"] as const) if (value[field] != null) nonNegativeInteger(value[field], field);
  if (value.stopAfterProfitLock != null && typeof value.stopAfterProfitLock !== "boolean") throw new Error("stopAfterProfitLock_invalid");
  if (value.resetStrategy !== "next_trading_day" && value.resetStrategy !== "next_session") throw new Error("resetStrategy_invalid");
}
function requiredObject(value: unknown, label: string): Record<string, unknown> { const result = objectOrNull(value); if (!result) throw new Error(`${label}_invalid`); return result; }
function requiredText(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label}_invalid`); return value.trim(); }
function nonNegativeInteger(value: unknown, label: string): number { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`${label}_invalid`); return Number(value); }
function positiveInteger(value: unknown, label: string): number { const number = nonNegativeInteger(value, label); if (number < 1) throw new Error(`${label}_invalid`); return number; }
