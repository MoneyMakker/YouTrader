/** Stable FNV-1a style hash for PI revisions (RN-safe). */

export function createHash(raw: string): string {
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = (h >>> 0).toString(16).padStart(8, "0");
  let h2 = 0x811c9dc5;
  for (let i = raw.length - 1; i >= 0; i--) {
    h2 ^= raw.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193);
  }
  out += (h2 >>> 0).toString(16).padStart(8, "0");
  return out;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}
