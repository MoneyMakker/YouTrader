import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function bearer(req: Request): string {
  const h = req.headers.get("Authorization") ?? "";
  return h.replace(/^Bearer\s+/i, "").trim();
}

function jwtRole(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function assertTrustedProcessor(req: Request): boolean {
  const token = bearer(req);
  const shared = Deno.env.get("PROP_OS_PROCESSOR_SHARED_SECRET") ?? "";
  const headerSecret = req.headers.get("x-prop-os-processor-secret") ?? "";
  if (shared && headerSecret && headerSecret === shared) return true;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && token && token === serviceKey) return true;
  // Hosted edge may inject a different secret material than CLI-listed JWT; accept role claim.
  if (token && jwtRole(token) === "service_role") return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ kind: "method_not_allowed" }), { status: 405 });
  }
  if (!assertTrustedProcessor(req)) {
    return new Response(JSON.stringify({ kind: "forbidden" }), { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ kind: "invalid_body" }), { status: 400 });
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const op = String((body as { op?: string }).op ?? "");
  let rpc = "";
  let args: Record<string, unknown> = {};
  if (op === "complete") {
    rpc = "prop_os_cmd_complete_recalculation";
    args = {
      p_request_id: (body as any).requestId,
      p_request_hash: (body as any).requestHash,
      p_challenge_id: (body as any).challengeId,
      p_assignment_revision: (body as any).assignmentRevision,
      p_snapshot_revision: (body as any).snapshotRevision,
    };
  } else if (op === "fail") {
    rpc = "prop_os_cmd_fail_recalculation";
    args = {
      p_request_id: (body as any).requestId,
      p_request_hash: (body as any).requestHash,
      p_challenge_id: (body as any).challengeId,
      p_assignment_revision: (body as any).assignmentRevision,
      p_reason_code: (body as any).reasonCode ?? "recalc_failed",
    };
  } else if (op === "mark_running") {
    rpc = "prop_os_cmd_processor_mark_recalc_running";
    args = {
      p_challenge_id: (body as any).challengeId,
      p_assignment_revision: (body as any).assignmentRevision,
    };
  } else if (op === "ping") {
    return new Response(JSON.stringify({ kind: "pong", processor: "recalc" }), {
      headers: { "Content-Type": "application/json" },
    });
  } else {
    return new Response(JSON.stringify({ kind: "unknown_op" }), { status: 400 });
  }
  const { data, error } = await sb.rpc(rpc, args);
  if (error) {
    return new Response(JSON.stringify({ kind: "rpc_error", message: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify(data ?? { kind: "success" }), {
    headers: { "Content-Type": "application/json" },
  });
});
