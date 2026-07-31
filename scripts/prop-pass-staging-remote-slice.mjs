/**
 * Remote staging vertical slice for Prop OS Internal TestFlight candidate.
 * Credentials: env only (never commit). Target must be zleojeqkzizeyerhjpur.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.SUPABASE_ANON_KEY ?? "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ALLOW = process.env.ALLOW_UID ?? "";
const DENY = process.env.DENY_UID ?? "";
const PROC = process.env.PROP_OS_PROCESSOR_SHARED_SECRET ?? "";

if (!URL.includes("zleojeqkzizeyerhjpur")) {
  console.error("REFUSE: not staging host");
  process.exit(2);
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/** Match App hashPropOsCommandPayload (FNV-style). */
function hashPropOsCommandPayload(commandType, body) {
  const raw = `${commandType}\0${stableStringify(body)}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  let x = h >>> 0;
  for (let i = 0; i < 8; i += 1) {
    out += (x & 0xff).toString(16).padStart(2, "0");
    x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
  }
  let h2 = 0x811c9dc5;
  for (let i = raw.length - 1; i >= 0; i -= 1) {
    h2 ^= raw.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193);
  }
  let y = h2 >>> 0;
  for (let i = 0; i < 8; i += 1) {
    out += (y & 0xff).toString(16).padStart(2, "0");
    y = Math.imul(y ^ (y >>> 11), 0x27d4eb2d) >>> 0;
  }
  return out;
}

function newRequestId() {
  return createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex").replace(
    /^(.{8})(.{4}).(.{3})(.{4})(.{12}).*$/,
    "$1-$2-4$3-a$4-$5",
  );
}

async function signIn(email, password) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signin ${email}: ${error?.message}`);
  return {
    userId: data.user.id,
    client: createClient(URL, ANON, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false },
    }),
  };
}

async function callProcessor(name, body) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SR}`,
      apikey: ANON,
      "Content-Type": "application/json",
      "x-prop-os-processor-secret": PROC,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const results = {};
const allowEmail = process.env.STAGING_QA_ALLOW_EMAIL ?? "";
const allowPassword = process.env.STAGING_QA_ALLOW_PASSWORD ?? "";
const denyEmail = process.env.STAGING_QA_DENY_EMAIL ?? "";
const denyPassword = process.env.STAGING_QA_DENY_PASSWORD ?? "";
if (!allowEmail || !allowPassword || !denyEmail || !denyPassword) {
  console.error(
    "REFUSE: set STAGING_QA_ALLOW_EMAIL/PASSWORD and STAGING_QA_DENY_EMAIL/PASSWORD (see .codex/secrets/staging-qa-credentials.env)",
  );
  process.exit(2);
}
const allow = await signIn(allowEmail, allowPassword);
const deny = await signIn(denyEmail, denyPassword);
results.auth =
  allow.userId === ALLOW && deny.userId === DENY ? "PASS" : "FAIL uid mismatch";

// Deny create
{
  const cmd = {
    label: "Denied Acc",
    firmKey: "apex-demo",
    accountSizeMinor: 5_000_000,
    currency: "USD",
    firmTimezone: "America/New_York",
    clientRequestId: newRequestId(),
  };
  const { data } = await deny.client.rpc("prop_os_cmd_create_account", {
    p_request_id: cmd.clientRequestId,
    p_request_hash: hashPropOsCommandPayload("create_account", cmd),
    p_label: cmd.label,
    p_firm_key: cmd.firmKey,
    p_account_size_minor: cmd.accountSizeMinor,
    p_currency: cmd.currency,
    p_firm_timezone: cmd.firmTimezone,
  });
  results.deny_create = data?.kind === "forbidden" ? "PASS" : `FAIL ${JSON.stringify(data)}`;
}

let accountId = "";
{
  const cmd = {
    label: `Staging TF Acc ${Date.now()}`,
    firmKey: "apex-demo",
    accountSizeMinor: 5_000_000,
    currency: "USD",
    firmTimezone: "America/New_York",
    clientRequestId: newRequestId(),
  };
  const { data, error } = await allow.client.rpc("prop_os_cmd_create_account", {
    p_request_id: cmd.clientRequestId,
    p_request_hash: hashPropOsCommandPayload("create_account", cmd),
    p_label: cmd.label,
    p_firm_key: cmd.firmKey,
    p_account_size_minor: cmd.accountSizeMinor,
    p_currency: cmd.currency,
    p_firm_timezone: cmd.firmTimezone,
  });
  if (error || data?.kind !== "success") {
    results.create_account = `FAIL ${error?.message ?? JSON.stringify(data)}`;
  } else {
    accountId = data.value.account.id;
    results.create_account = "PASS";
  }
}

let challengeId = "";
{
  const ruleSnapshot = {
    version: "rs-stg-112",
    firmKey: "apex-demo",
    currency: "USD",
    firmTimezone: "America/New_York",
    tradingDayRolloverHour: 0,
    profitTargetMinor: 300000,
    dailyLossLimitMinor: 1000000,
    dailyLossBasis: "realized_only",
    dailyLossPolicyVersion: "daily-loss-v0",
    drawdown: { kind: "static", amountMinor: 200000 },
    minimumTradingDays: 1,
  };
  const cmd = {
    accountId,
    templateId: "internal.apex-demo.eval.static",
    templateVersion: "v0",
    ruleSnapshot,
    phase: "evaluation",
    startedAtUtc: new Date().toISOString(),
    resetOfChallengeId: null,
    clientRequestId: newRequestId(),
  };
  const { data, error } = await allow.client.rpc("prop_os_cmd_create_challenge_attempt", {
    p_request_id: cmd.clientRequestId,
    p_request_hash: hashPropOsCommandPayload("create_challenge_attempt", cmd),
    p_account_id: cmd.accountId,
    p_template_id: cmd.templateId,
    p_template_version: cmd.templateVersion,
    p_rule_snapshot: cmd.ruleSnapshot,
    p_phase: cmd.phase,
    p_started_at: cmd.startedAtUtc,
    p_reset_of: null,
  });
  if (error || data?.kind !== "success") {
    results.create_challenge = `FAIL ${error?.message ?? JSON.stringify(data)}`;
  } else {
    challengeId = data.value.challenge?.id ?? data.value.challengeId;
    results.create_challenge = challengeId ? "PASS" : `FAIL ${JSON.stringify(data)}`;
  }
}

const tradeDate = new Date().toISOString().slice(0, 10);
const tradeClientId = `stg-tf-${Date.now()}`;
{
  // Prefer authenticated owner insert (service-role REST may be gated by project auth settings).
  const { error } = await allow.client.from("trade_journal").insert({
    user_id: ALLOW,
    client_id: tradeClientId,
    trade_date: tradeDate,
    symbol: "ES",
    direction: "LONG",
    entry_time: `${tradeDate}T15:00:00Z`,
    exit_time: `${tradeDate}T16:00:00Z`,
    contracts: 1,
    pnl: 250,
    notes: "staging-112-fixture",
  });
  results.seed_trade = error ? `FAIL ${error.message}` : "PASS";
}

let assignmentRevision = 0;
if (accountId && challengeId && results.seed_trade === "PASS") {
  const cmd = {
    accountId,
    challengeId,
    tradeClientIds: [tradeClientId],
    source: "manual",
    reasonCode: null,
    allowReassign: false,
    clientRequestId: newRequestId(),
  };
  const { data, error } = await allow.client.rpc("prop_os_cmd_assign_trades", {
    p_request_id: cmd.clientRequestId,
    p_request_hash: hashPropOsCommandPayload("assign_trades", cmd),
    p_account_id: accountId,
    p_challenge_id: challengeId,
    p_trade_client_ids: [tradeClientId],
    p_source: "manual",
    p_reason_code: null,
    p_allow_reassign: false,
  });
  if (error || data?.kind !== "success") {
    results.assign = `FAIL ${error?.message ?? JSON.stringify(data)}`;
  } else {
    assignmentRevision = Number(data.value?.assignmentRevision ?? 1);
    results.assign = "PASS";
  }
}

{
  const ping = await callProcessor("prop-os-recalc-processor", { op: "ping" });
  results.recalc_ping =
    ping.status === 200 && ping.body?.processor === "recalc" ? "PASS" : `FAIL ${JSON.stringify(ping)}`;
  const pingPi = await callProcessor("prop-os-pi-processor", { op: "ping" });
  results.pi_ping =
    pingPi.status === 200 && pingPi.body?.processor === "pi" ? "PASS" : `FAIL ${JSON.stringify(pingPi)}`;
  const anon = await fetch(`${URL}/functions/v1/prop-os-recalc-processor`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ op: "ping" }),
  });
  results.anon_processor_denied = anon.status === 403 ? "PASS" : `FAIL ${anon.status}`;
}

{
  const { data, error } = await deny.client.from("prop_accounts").select("id").eq("id", accountId);
  results.deny_read_foreign =
    !error && Array.isArray(data) && data.length === 0 ? "PASS" : `FAIL ${JSON.stringify({ data, error })}`;
  const own = await allow.client.from("prop_accounts").select("id").eq("id", accountId).maybeSingle();
  results.allow_read_own =
    !own.error && own.data?.id === accountId ? "PASS" : `FAIL ${JSON.stringify(own)}`;
}

const out = {
  results,
  accountPrefix: accountId ? `${accountId.slice(0, 8)}…` : null,
  challengePrefix: challengeId ? `${challengeId.slice(0, 8)}…` : null,
  assignmentRevision,
};
console.log(JSON.stringify(out, null, 2));
writeFileSync("/tmp/stg_vertical_slice.json", JSON.stringify(out, null, 2));
const failed = Object.values(results).filter((v) => !String(v).startsWith("PASS"));
process.exit(failed.length ? 1 : 0);
