import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function bearer(req: Request): string {
  const h = req.headers.get("Authorization") ?? "";
  return h.replace(/^Bearer\s+/i, "").trim();
}

/**
 * Trust only shared secret header or exact service-role key match.
 * Do not decode JWT payloads without signature verification.
 */
function assertTrustedProcessor(req: Request): boolean {
  const token = bearer(req);
  const shared = Deno.env.get("PROP_OS_PROCESSOR_SHARED_SECRET") ?? "";
  const headerSecret = req.headers.get("x-prop-os-processor-secret") ?? "";
  if (shared && headerSecret && headerSecret === shared) return true;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && token && token === serviceKey) return true;
  return false;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ kind: "method_not_allowed" }, 405);
  if (!assertTrustedProcessor(req)) return json({ kind: "forbidden" }, 403);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ kind: "invalid_body" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const op = String((body as { op?: string }).op ?? "");

  if (op === "ping") {
    return json({ kind: "pong", processor: "pi" });
  }

  if (op === "complete") {
    const { data, error } = await sb.rpc("prop_os_cmd_complete_performance_intelligence", {
      p_user_id: (body as { userId?: string }).userId,
      p_scope_key: (body as { scopeKey?: string }).scopeKey,
      p_assignment_revision: (body as { assignmentRevision?: number }).assignmentRevision,
      p_snapshot: (body as { snapshot?: unknown }).snapshot,
    });
    if (error) return json({ kind: "rpc_error", message: error.message }, 500);
    return json(data ?? { kind: "success" });
  }

  if (op === "fail") {
    const { data, error } = await sb.rpc("prop_os_cmd_fail_performance_intelligence", {
      p_user_id: (body as { userId?: string }).userId,
      p_scope_key: (body as { scopeKey?: string }).scopeKey,
      p_assignment_revision: (body as { assignmentRevision?: number }).assignmentRevision,
      p_reason_code: (body as { reasonCode?: string }).reasonCode ?? "pi_failed",
    });
    if (error) return json({ kind: "rpc_error", message: error.message }, 500);
    return json(data ?? { kind: "success" });
  }

  if (op === "claim") {
    const { data, error } = await sb.rpc("prop_os_cmd_claim_performance_intelligence", {
      p_user_id: (body as { userId?: string }).userId,
      p_scope_key: (body as { scopeKey?: string }).scopeKey,
      p_assignment_revision: (body as { assignmentRevision?: number }).assignmentRevision,
    });
    if (error) return json({ kind: "rpc_error", message: error.message }, 500);
    return json(data ?? { kind: "success" });
  }

  if (op === "reap") {
    const { data, error } = await sb.rpc("prop_os_cmd_reap_stalled_performance_intelligence");
    if (error) return json({ kind: "rpc_error", message: error.message }, 500);
    return json(data ?? { kind: "success" });
  }

  if (op === "probe_recalc_complete") {
    const { data, error } = await sb.rpc("prop_os_cmd_complete_recalculation", {
      p_request_id: (body as { requestId?: string }).requestId ?? "probe",
      p_request_hash: (body as { requestHash?: string }).requestHash ?? "probe",
      p_challenge_id: (body as { challengeId?: string }).challengeId,
      p_assignment_revision: (body as { assignmentRevision?: number }).assignmentRevision ?? 0,
      p_snapshot_revision: (body as { snapshotRevision?: number }).snapshotRevision ?? 0,
    });
    if (error) return json({ kind: "rpc_error", message: error.message, note: "service_role_may_bypass_role_isolation" }, 500);
    return json({ kind: "probe_result", data });
  }

  return json({ kind: "unknown_op" }, 400);
});
