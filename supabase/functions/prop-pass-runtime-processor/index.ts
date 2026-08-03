import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
import { processPendingRuntimeEvents, saveLiveRiskSettings, setManualSessionLock } from "./processor.ts";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function bearer(req: Request): string { return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim(); }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ kind: "method_not_allowed" }, 405);
  const token = bearer(req);
  if (!token) return json({ kind: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ kind: "configuration_error" }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ kind: "unauthorized" }, 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ kind: "invalid_body" }, 400);
  const op = (body as { op?: unknown }).op;
  if (op !== "process_pending" && op !== "save_live_settings" && op !== "activate_session_lock") return json({ kind: "invalid_body" }, 400);
  try {
    const report = op === "save_live_settings"
      ? await saveLiveRiskSettings(admin, auth.user.id, body)
      : op === "activate_session_lock"
        ? await setManualSessionLock(admin, auth.user.id, body)
        : await processPendingRuntimeEvents(admin, auth.user.id, 4);
    return json({ kind: "success", report });
  } catch (error) {
    console.error("prop-pass-runtime-processor", error instanceof Error ? error.message : "unknown_error");
    return json({ kind: "processor_failed" }, 500);
  }
});
