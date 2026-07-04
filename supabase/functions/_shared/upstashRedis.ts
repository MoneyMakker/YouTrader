type UpstashResult = { result?: unknown; error?: string };

function getUpstashConfig() {
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL")?.trim() || "";
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN")?.trim() || "";
  if (!url || !token) return null;
  return { url, token };
}

export function isUpstashConfigured() {
  return !!getUpstashConfig();
}

/** Run a Redis command via Upstash REST API. Returns null if not configured or on failure. */
export async function upstashCommand<T = unknown>(command: (string | number)[]): Promise<T | null> {
  const config = getUpstashConfig();
  if (!config) return null;
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!response.ok) {
      console.warn("[YouTrader:upstash] command_failed", { status: response.status, command: command[0] });
      return null;
    }
    const payload = (await response.json()) as UpstashResult;
    if (payload.error) {
      console.warn("[YouTrader:upstash] redis_error", { error: payload.error, command: command[0] });
      return null;
    }
    return payload.result as T;
  } catch (error) {
    console.warn("[YouTrader:upstash] request_failed", {
      command: command[0],
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function upstashGet(key: string): Promise<string | null> {
  const value = await upstashCommand<string>(["GET", key]);
  return typeof value === "string" ? value : null;
}

export async function upstashSetEx(key: string, ttlSeconds: number, value: string): Promise<boolean> {
  const result = await upstashCommand<string>(["SET", key, value, "EX", ttlSeconds]);
  return result === "OK";
}

export async function upstashIncrWithExpire(key: string, ttlSeconds: number): Promise<number | null> {
  const count = await upstashCommand<number>(["INCR", key]);
  if (count === 1) {
    await upstashCommand(["EXPIRE", key, ttlSeconds]);
  }
  return typeof count === "number" ? count : null;
}
