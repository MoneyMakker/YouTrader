import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_EVENTS = 25;
const MAX_BODY_BYTES = 32_000;
const PROHIBITED_PROPERTY = /(email|phone|full.?name|name$|password|passcode|token|secret|authorization|cookie|api.?key|brokerage|account.?number|private.?note|note.?body|screenshot|image|voice|audio|order.?id|payment|card|user.?id|customer.?id|subscriber.?id|device.?id)/i;

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function isSafeValue(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.length <= 200);
}

function normalizePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid analytics payload.");
  const input = value as Record<string, unknown>;
  if (input.sourceName !== "youtrader-ios" || typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 8 || !Array.isArray(input.events) || input.events.length < 1 || input.events.length > MAX_EVENTS) throw new Error("Invalid analytics batch.");
  const events = input.events.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid analytics event.");
    const event = raw as Record<string, unknown>;
    if (typeof event.externalEventId !== "string" || event.externalEventId.length < 1 || event.externalEventId.length > 200 || typeof event.eventName !== "string" || event.eventName.length < 1 || event.eventName.length > 120 || typeof event.anonymousSubjectId !== "string" || event.anonymousSubjectId.length < 8 || event.anonymousSubjectId.length > 255 || typeof event.occurredAt !== "string" || Number.isNaN(Date.parse(event.occurredAt))) throw new Error("Invalid analytics event fields.");
    const rawProperties = event.properties ?? {};
    if (!rawProperties || typeof rawProperties !== "object" || Array.isArray(rawProperties)) throw new Error("Invalid analytics properties.");
    const properties: Record<string, string | number | boolean | null> = {};
    for (const [key, property] of Object.entries(rawProperties as Record<string, unknown>)) {
      if (key.length < 1 || key.length > 80 || PROHIBITED_PROPERTY.test(key)) throw new Error("Prohibited analytics property.");
      if (!isSafeValue(property)) throw new Error("Invalid analytics property value.");
      properties[key] = typeof property === "string" ? property.slice(0, 120) : property;
    }
    return { externalEventId: event.externalEventId, eventName: event.eventName, anonymousSubjectId: event.anonymousSubjectId, occurredAt: new Date(event.occurredAt).toISOString(), properties };
  });
  return { sourceName: "youtrader-ios", idempotencyKey: input.idempotencyKey, events };
}

async function sign(body: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`)));
  const hex = Array.from(signature, (item) => item.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const agentUrl = Deno.env.get("AGENT007_PRODUCT_ANALYTICS_INGEST_URL");
  const signingSecret = Deno.env.get("AGENT007_PRODUCT_ANALYTICS_SIGNING_SECRET");
  if (!supabaseUrl || !publishableKey || !agentUrl || !signingSecret) return response(503, { error: "Analytics ingestion is not configured." });
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return response(401, { error: "Unauthorized." });
  const supabase = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(authorization.slice("Bearer ".length));
  if (userError || !user) return response(401, { error: "Unauthorized." });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return response(413, { error: "Analytics batch is too large." });
  let payload: ReturnType<typeof normalizePayload>;
  try {
    payload = normalizePayload(JSON.parse(raw));
  } catch {
    return response(400, { error: "Analytics payload was rejected." });
  }
  const signedBody = JSON.stringify(payload);
  try {
    const upstream = await fetch(agentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Agent007-Analytics-Signature": await sign(signedBody, signingSecret) },
      body: signedBody,
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok) return response(upstream.status >= 500 ? 503 : 400, { error: "Analytics ingestion was rejected." });
    const result = await upstream.json().catch(() => ({}));
    return response(200, { accepted: Number(result.accepted ?? 0), duplicates: Number(result.duplicates ?? 0) });
  } catch {
    return response(503, { error: "Analytics ingestion is temporarily unavailable." });
  }
});
