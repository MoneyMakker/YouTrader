import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../config/appConfig";
import { recordSecurityEvent, withTimeout } from "./clientSecurity";
import { SECURITY_LIMITS, SECURITY_MESSAGES } from "./securityConfig";

export type SecureUploadCategory = "screenshot" | "voice-note" | "export" | "csv";

export type SecureUploadInput = {
  uri: string;
  category: SecureUploadCategory;
  originalName?: string | null;
  mimeType: string;
};

export type SecureUploadResult = {
  bucket: string;
  path: string;
  contentType: string;
  size: number;
  sha256: string;
  duplicate: boolean;
  createdAt: string;
};

const FILENAME_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const MIME_TO_EXT: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "audio/mpeg": ["mp3", "mpeg"],
  "audio/mp4": ["mp4", "m4a"],
  "audio/x-m4a": ["m4a"],
  "audio/wav": ["wav"],
  "audio/aac": ["aac"],
  "application/pdf": ["pdf"],
  "text/csv": ["csv"],
};

const CATEGORY_MIMES: Record<SecureUploadCategory, string[]> = {
  screenshot: ["image/jpeg", "image/png", "image/webp"],
  "voice-note": ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/aac"],
  export: ["application/pdf", "text/csv"],
  csv: ["text/csv"],
};

const CATEGORY_MAX_BYTES: Record<SecureUploadCategory, number> = {
  screenshot: 10 * 1024 * 1024,
  "voice-note": 25 * 1024 * 1024,
  export: 10 * 1024 * 1024,
  csv: 10 * 1024 * 1024,
};

function hasTraversalTrick(value: string) {
  const normalized = value.normalize("NFKC");
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

export function validateUploadFilename(name?: string | null) {
  const value = String(name || "upload").trim();
  if (!value || value.length > 100 || hasTraversalTrick(value) || !FILENAME_RE.test(value)) {
    return { ok: false, safeName: "upload" };
  }
  return { ok: true, safeName: value };
}

export function validateUploadMimeAndExtension(category: SecureUploadCategory, filename: string, mimeType: string) {
  const normalizedMime = String(mimeType || "").toLowerCase().trim();
  const allowed = CATEGORY_MIMES[category] || [];
  const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() || "" : "";
  const validMime = allowed.includes(normalizedMime);
  const validExt = !!ext && (MIME_TO_EXT[normalizedMime] || []).includes(ext);
  return { ok: validMime && validExt, mimeType: normalizedMime, extension: ext };
}

async function localFileSize(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === "number" ? info.size : 0;
}

export async function validateSecureUploadInput(input: SecureUploadInput) {
  const filename = validateUploadFilename(input.originalName || input.uri.split("/").pop() || "upload");
  if (!filename.ok) {
    await recordSecurityEvent("invalid_upload_filename", `upload:${input.category}`);
    return { ok: false, message: SECURITY_MESSAGES.invalidUpload };
  }
  const mime = validateUploadMimeAndExtension(input.category, filename.safeName, input.mimeType);
  if (!mime.ok) {
    await recordSecurityEvent("invalid_upload_mime", `upload:${input.category}`);
    return { ok: false, message: SECURITY_MESSAGES.invalidUpload };
  }
  const size = await localFileSize(input.uri);
  if (!size || size > CATEGORY_MAX_BYTES[input.category]) {
    await recordSecurityEvent("oversized_upload", `upload:${input.category}`);
    return { ok: false, message: SECURITY_MESSAGES.invalidUpload };
  }
  return { ok: true, filename: filename.safeName, mimeType: mime.mimeType, size };
}

export async function secureUploadFile(input: SecureUploadInput): Promise<SecureUploadResult> {
  if (!supabase) throw new Error("Secure upload is not configured in this build.");
  const local = await validateSecureUploadInput(input);
  if (!local.ok) throw new Error(local.message);

  const base64 = await FileSystem.readAsStringAsync(input.uri, { encoding: "base64" as any });
  const { data, error } = await withTimeout(supabase.functions.invoke("secure-upload", {
    body: {
      category: input.category,
      originalName: local.filename,
      mimeType: local.mimeType,
      base64,
      size: local.size,
    },
  }), SECURITY_LIMITS.requestTimeoutMs * 2);

  if (error) throw new Error(SECURITY_MESSAGES.invalidUpload);
  return data as SecureUploadResult;
}
