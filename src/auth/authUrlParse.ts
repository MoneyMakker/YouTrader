export type ParsedAuthUrl = {
  query: Record<string, string>;
  hash: Record<string, string>;
  merged: Record<string, string>;
  hasTokenHash: boolean;
  hasCode: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasType: boolean;
  hasError: boolean;
};

export function redactSecret(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 10) return `[redacted:${value.length}]`;
  return `${value.slice(0, 6)}…${value.slice(-4)} (len=${value.length})`;
}

function redactAuthParams(params: Record<string, string>) {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === "access_token" || key === "refresh_token" || key === "token_hash" || key === "code") {
      next[key] = redactSecret(value) || "";
    } else {
      next[key] = value;
    }
  }
  return next;
}

function readAuthUrlParams(url: string) {
  const query = new URLSearchParams();
  const hash = new URLSearchParams();

  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((value, key) => query.set(key, value));
    const hashRaw = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    new URLSearchParams(hashRaw).forEach((value, key) => hash.set(key, value));
  } catch {
    const queryPart = url.includes("?") ? url.split("?")[1]?.split("#")[0] || "" : "";
    const hashPart = url.includes("#") ? url.split("#")[1] || "" : "";
    new URLSearchParams(queryPart).forEach((value, key) => query.set(key, value));
    new URLSearchParams(hashPart).forEach((value, key) => hash.set(key, value));
  }

  const queryObj = Object.fromEntries(query.entries());
  const hashObj = Object.fromEntries(hash.entries());
  const merged: Record<string, string> = { ...queryObj };
  for (const [key, value] of Object.entries(hashObj)) {
    if (!merged[key]) merged[key] = value;
  }

  return { queryObj, hashObj, merged };
}

function authUrlFlags(merged: Record<string, string>) {
  return {
    hasTokenHash: !!merged.token_hash,
    hasCode: !!merged.code,
    hasAccessToken: !!merged.access_token,
    hasRefreshToken: !!merged.refresh_token,
    hasType: !!merged.type,
    hasError: !!(merged.error || merged.error_description),
  };
}

/** Raw callback params for auth processing — never log this output. */
export function parseAuthCallbackParams(url: string) {
  const { queryObj, hashObj, merged } = readAuthUrlParams(url);
  return {
    query: queryObj,
    hash: hashObj,
    merged,
    ...authUrlFlags(merged),
  };
}

/** Redacted callback params safe for logs and diagnostics. */
export function parseAuthCallbackUrl(url: string): ParsedAuthUrl {
  const { queryObj, hashObj, merged } = readAuthUrlParams(url);
  const flags = authUrlFlags(merged);
  return {
    query: redactAuthParams(queryObj),
    hash: redactAuthParams(hashObj),
    merged: redactAuthParams(merged),
    ...flags,
  };
}
