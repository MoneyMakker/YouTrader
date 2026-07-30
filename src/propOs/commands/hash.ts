/**
 * Stable request hash for idempotency (RN-safe, no Node crypto).
 * Not a security primitive — collision resistance for command dedupe only.
 */
export function hashPropOsCommandPayload(
  commandType: string,
  body: unknown,
): string {
  const raw = `${commandType}\0${stableStringify(body)}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Expand to hex-like digest for RPC storage
  let out = "";
  let x = h >>> 0;
  for (let i = 0; i < 8; i += 1) {
    out += (x & 0xff).toString(16).padStart(2, "0");
    x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
  }
  // Second pass for more bits
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

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function newPropOsClientRequestId(): string {
  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0"),
  ).join("");
  return `${bytes.slice(0, 8)}-${bytes.slice(8, 12)}-4${bytes.slice(13, 16)}-a${bytes.slice(17, 20)}-${bytes.slice(20, 32)}`;
}
