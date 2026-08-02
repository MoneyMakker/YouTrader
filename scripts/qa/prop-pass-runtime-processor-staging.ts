import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const email = process.env.STAGING_QA_ALLOW_EMAIL ?? "";
const password = process.env.STAGING_QA_ALLOW_PASSWORD ?? "";
const expectedUserId = process.env.ALLOW_UID ?? process.env.STAGING_QA_ALLOW_USER_ID ?? "";
if (!url.includes("zleojeqkzizeyerhjpur") || !anonKey || !serviceKey || !email || !password || !expectedUserId) {
  throw new Error("REFUSE: complete staging QA environment is required");
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const auth = createClient(url, anonKey, { auth: { persistSession: false } });
const signed = await auth.auth.signInWithPassword({ email, password });
if (signed.error || !signed.data.session || signed.data.user?.id !== expectedUserId) throw new Error("staging disposable QA sign-in failed");

const { data: challenge, error: challengeError } = await admin
  .from("prop_challenges")
  .select("id,account_id")
  .eq("user_id", expectedUserId)
  .in("status", ["active", "at_risk", "passed", "funded"])
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (challengeError || !challenge) throw new Error("disposable staging challenge fixture unavailable");

const { data: priorRuntime } = await admin
  .from("prop_account_runtime_states")
  .select("*")
  .eq("user_id", expectedUserId)
  .eq("account_id", challenge.account_id)
  .maybeSingle();
const suffix = randomUUID();
const eventKey = `${challenge.account_id}:runtime-worker-qa:${suffix}`;
try {
  const inserted = await admin.from("prop_processed_journal_events").insert({
    user_id: expectedUserId,
    account_id: challenge.account_id,
    challenge_id: challenge.id,
    event_key: eventKey,
    event_type: "trade_saved",
    journal_trade_id: null,
    trade_client_id: `runtime-worker-qa-${suffix}`,
    trade_revision: 1,
    calculation_version: "build117.pipeline.v2",
    prior_event_key: null,
    input_digest: `qa-${suffix}`,
    processing_state: "pending",
  });
  if (inserted.error) throw new Error(`fixture insert failed:${inserted.error.code}`);
  const response = await fetch(`${url}/functions/v1/prop-pass-runtime-processor`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signed.data.session.access_token}`,
      apikey: anonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ op: "process_pending" }),
  });
  const body = await response.json() as { kind?: string; report?: { applied?: number; failed?: number } };
  assert.equal(response.status, 200);
  assert.equal(body.kind, "success");
  assert.ok((body.report?.applied ?? 0) >= 1);
  assert.equal(body.report?.failed, 0);
  const [{ data: event }, { data: runtime }] = await Promise.all([
    admin.from("prop_processed_journal_events").select("processing_state,result_digest").eq("user_id", expectedUserId).eq("event_key", eventKey).single(),
    admin.from("prop_account_runtime_states").select("calculation_version,payload").eq("user_id", expectedUserId).eq("account_id", challenge.account_id).single(),
  ]);
  assert.equal(event?.processing_state, "applied");
  assert.ok(event?.result_digest);
  assert.equal(runtime?.calculation_version, "build117.pipeline.v2");
  assert.equal((runtime?.payload as { calculationVersion?: string } | null)?.calculationVersion, "build117.pipeline.v2");
  console.log("prop-pass-runtime-processor-staging: PASS");
} finally {
  await admin.from("prop_processed_journal_events").delete().eq("user_id", expectedUserId).eq("event_key", eventKey);
  if (priorRuntime) {
    await admin.from("prop_account_runtime_states").upsert(priorRuntime, { onConflict: "user_id,account_id" });
  } else {
    await admin.from("prop_account_runtime_states").delete().eq("user_id", expectedUserId).eq("account_id", challenge.account_id);
  }
  await auth.auth.signOut();
}
