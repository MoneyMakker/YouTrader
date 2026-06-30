// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const defaultAllowedOrigins = ["https://youtrader.app", "https://www.youtrader.app"];

function configuredAllowedOrigins() {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  const configured = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured.length ? configured : defaultAllowedOrigins;
}

function corsHeadersFor(req?: Request) {
  const allowedOrigins = configuredAllowedOrigins();
  const origin = req?.headers.get("Origin") || "";
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

type Category = "screenshot" | "voice-note" | "export" | "csv";

type UploadRequest = {
  category?: Category;
  originalName?: string;
  mimeType?: string;
  base64?: string;
  size?: number;
};

const config: Record<Category, { bucket: string; folder: string; maxBytes: number; mimes: Record<string, string[]> }> = {
  screenshot: {
    bucket: "user-screenshots",
    folder: "screenshots",
    maxBytes: 10 * 1024 * 1024,
    mimes: { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"] },
  },
  "voice-note": {
    bucket: "user-voice-notes",
    folder: "voice-notes",
    maxBytes: 25 * 1024 * 1024,
    mimes: {
      "audio/mpeg": ["mp3", "mpeg"],
      "audio/mp4": ["mp4", "m4a"],
      "audio/x-m4a": ["m4a"],
      "audio/wav": ["wav"],
      "audio/aac": ["aac"],
    },
  },
  export: {
    bucket: "user-exports",
    folder: "exports",
    maxBytes: 10 * 1024 * 1024,
    mimes: { "application/pdf": ["pdf"], "text/csv": ["csv"] },
  },
  csv: {
    bucket: "user-attachments",
    folder: "csv",
    maxBytes: 10 * 1024 * 1024,
    mimes: { "text/csv": ["csv"] },
  },
};

function json(status: number, body: Record<string, unknown>, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "content-type": "application/json" },
  });
}

function invalid(status = 400, req?: Request) {
  return json(status, { error: "Upload rejected." }, req);
}

function hasTraversalTrick(value: string) {
  const normalized = value.normalize("NFKC").toLowerCase();
  return (
    normalized.includes("../") ||
    normalized.includes("..\\") ||
    normalized.includes("%2e") ||
    normalized.includes("%2f") ||
    normalized.includes("%5c") ||
    /[\u0000-\u001f\u007f]/.test(normalized) ||
    /[\\/:*?"<>|]/.test(normalized)
  );
}

function validateFilename(name: unknown) {
  const value = String(name || "").trim();
  return !!value && value.length <= 100 && /^[A-Za-z0-9_.-]+$/.test(value) && !hasTraversalTrick(value);
}

function extensionFor(name: string) {
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() || "" : "";
  return ext;
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function asciiPrefix(bytes: Uint8Array, length: number) {
  return String.fromCharCode(...bytes.slice(0, Math.min(bytes.length, length))).toLowerCase();
}

function isLikelyCsv(bytes: Uint8Array) {
  if (!bytes.length) return false;
  const sample = asciiPrefix(bytes, 512);
  if (sample.includes("\u0000")) return false;
  return /[a-z0-9_\- ]+,[a-z0-9_\- ]+/i.test(sample) || sample.includes("date,") || sample.includes("symbol,");
}

function validateMagicBytes(category: Category, mimeType: string, bytes: Uint8Array) {
  if (!bytes.length) return false;
  if (mimeType === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/webp") return asciiPrefix(bytes, 12).startsWith("riff") && asciiPrefix(bytes.slice(8), 4) === "webp";
  if (mimeType === "application/pdf") return asciiPrefix(bytes, 5) === "%pdf-";
  if (mimeType === "text/csv") return category === "csv" || category === "export" ? isLikelyCsv(bytes) : false;
  if (mimeType === "audio/mpeg") return startsWith(bytes, [0x49, 0x44, 0x33]) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (mimeType === "audio/wav") return asciiPrefix(bytes, 12).startsWith("riff") && asciiPrefix(bytes.slice(8), 4) === "wave";
  if (mimeType === "audio/aac") return bytes[0] === 0xff && (bytes[1] & 0xf0) === 0xf0;
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") {
    const box = asciiPrefix(bytes.slice(4), 4);
    const brand = asciiPrefix(bytes.slice(8), 24);
    return box === "ftyp" && (brand.includes("m4a") || brand.includes("mp4") || brand.includes("isom"));
  }
  return false;
}

async function sha256Text(value: string) {
  return sha256(new TextEncoder().encode(value));
}

async function consumeUploadLimit(admin: ReturnType<typeof createClient>, userId: string, action: string) {
  const actorHash = await sha256Text(userId);
  const { data, error } = await admin.rpc("security_consume_request_limit_for_actor", {
    p_actor_hash: actorHash,
    p_action: action,
    p_max_requests: 20,
    p_window_seconds: 60 * 60,
  });
  if (error) return true;
  return data?.allowed !== false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return invalid(405, req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return invalid(500, req);

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) return invalid(401, req);

  const logEvent = async (eventType: string, category = "upload", severity = "warning") => {
    await admin.from("security_events").insert({
      user_id: user.id,
      actor_hash: null,
      event_type: eventType,
      action: category,
      severity,
      metadata: {},
    });
  };

  let payload: UploadRequest;
  try {
    payload = await req.json();
  } catch {
    await logEvent("malformed_upload_metadata");
    return invalid(400, req);
  }

  const category = payload.category;
  if (!category || !config[category]) {
    await logEvent("invalid_upload_category");
    return invalid(400, req);
  }
  const rule = config[category];
  const limitAllowed = await consumeUploadLimit(admin, user.id, `upload:${category}`);
  if (!limitAllowed) {
    await logEvent("rate_limit_exceeded", category);
    return invalid(429, req);
  }

  const originalName = String(payload.originalName || "");
  if (!validateFilename(originalName)) {
    await logEvent(hasTraversalTrick(originalName) ? "path_traversal_attempt" : "invalid_filename", category);
    return invalid(400, req);
  }

  const mimeType = String(payload.mimeType || "").toLowerCase().trim();
  const ext = extensionFor(originalName);
  if (!rule.mimes[mimeType] || !rule.mimes[mimeType].includes(ext)) {
    await logEvent("invalid_mime_or_extension", category);
    return invalid(400, req);
  }

  if (!payload.base64 || typeof payload.base64 !== "string") {
    await logEvent("malformed_upload_metadata", category);
    return invalid(400, req);
  }

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(payload.base64);
  } catch {
    await logEvent("malformed_upload_body", category);
    return invalid(400, req);
  }

  const size = Number(payload.size || bytes.byteLength);
  if (!Number.isFinite(size) || size !== bytes.byteLength || size <= 0) {
    await logEvent("invalid_upload_size_metadata", category);
    return invalid(400, req);
  }
  if (size > rule.maxBytes) {
    await logEvent("oversized_upload", category);
    return invalid(413, req);
  }
  if (!validateMagicBytes(category, mimeType, bytes)) {
    await logEvent("invalid_magic_bytes", category);
    return invalid(400, req);
  }

  const fileHash = await sha256(bytes);
  const duplicateSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: duplicate } = await admin
    .from("upload_files")
    .select("bucket,path,content_type,file_size,sha256,created_at")
    .eq("user_id", user.id)
    .eq("sha256", fileHash)
    .eq("category", category)
    .gte("created_at", duplicateSince)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (duplicate) {
    await logEvent("duplicate_upload", category, "info");
    return json(200, {
      bucket: duplicate.bucket,
      path: duplicate.path,
      contentType: duplicate.content_type,
      size: duplicate.file_size,
      sha256: duplicate.sha256,
      duplicate: true,
      createdAt: duplicate.created_at,
    }, req);
  }

  const safeExt = rule.mimes[mimeType][0];
  const path = `${user.id}/${rule.folder}/${crypto.randomUUID()}.${safeExt}`;
  if (!path.startsWith(`${user.id}/`) || path.includes("..")) {
    await logEvent("path_traversal_attempt", category);
    return invalid(400, req);
  }

  const { error: uploadError } = await admin.storage.from(rule.bucket).upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) return invalid(500, req);

  const metadata = {
    user_id: user.id,
    category,
    bucket: rule.bucket,
    path,
    original_filename: originalName,
    content_type: mimeType,
    file_size: size,
    sha256: fileHash,
  };
  const { data: inserted, error: insertError } = await admin
    .from("upload_files")
    .insert(metadata)
    .select("bucket,path,content_type,file_size,sha256,created_at")
    .single();

  if (insertError) return invalid(500, req);
  return json(200, {
    bucket: inserted.bucket,
    path: inserted.path,
    contentType: inserted.content_type,
    size: inserted.file_size,
    sha256: inserted.sha256,
    duplicate: false,
    createdAt: inserted.created_at,
  }, req);
});
