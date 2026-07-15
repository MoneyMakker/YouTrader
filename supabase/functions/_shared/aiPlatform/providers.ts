import type { ProviderConfig, ProviderKind, RouterMessage } from "./types.ts";

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

export type ChatCallInput = {
  providerName: string;
  providerConfig: ProviderConfig;
  modelId: string;
  messages: RouterMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  jsonMode?: boolean;
};

export type ChatCallResult = {
  content: string;
  rawUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
};

function timeoutSignal(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, done: () => clearTimeout(id) };
}

async function callOpenAICompatible(input: ChatCallInput, attempt = 0): Promise<ChatCallResult> {
  const apiKey = env(input.providerConfig.secretEnv);
  if (!apiKey) throw new Error(`${input.providerName}_api_key_missing`);

  const { controller, done } = timeoutSignal(input.timeoutMs);
  try {
    const response = await fetch(`${input.providerConfig.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(input.providerConfig.headers || {}),
      },
      body: JSON.stringify({
        model: input.modelId,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        ...(input.jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: input.messages,
      }),
    });

    if ([401, 403, 429].includes(response.status)) {
      throw new Error(`${input.providerName}_non_retryable_${response.status}`);
    }
    if (!response.ok) {
      if (attempt < 1 && response.status >= 500) return callOpenAICompatible(input, attempt + 1);
      throw new Error(`${input.providerName}_status_${response.status}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error(`${input.providerName}_empty_response`);
    return {
      content,
      rawUsage: json?.usage,
    };
  } catch (error) {
    if (attempt < 1 && error instanceof TypeError) return callOpenAICompatible(input, attempt + 1);
    throw error;
  } finally {
    done();
  }
}

async function callGemini(input: ChatCallInput, attempt = 0): Promise<ChatCallResult> {
  const apiKey = env(input.providerConfig.secretEnv);
  if (!apiKey) throw new Error("gemini_api_key_missing");
  const system = input.messages.find((m) => m.role === "system")?.content || "";
  const user = input.messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
  const { controller, done } = timeoutSignal(input.timeoutMs);

  try {
    const url = `${input.providerConfig.baseUrl}/models/${encodeURIComponent(input.modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: input.temperature, maxOutputTokens: input.maxTokens },
      }),
    });
    if ([401, 403, 429].includes(response.status)) throw new Error(`gemini_non_retryable_${response.status}`);
    if (!response.ok) {
      if (attempt < 1 && response.status >= 500) return callGemini(input, attempt + 1);
      throw new Error(`gemini_status_${response.status}`);
    }
    const json = await response.json();
    const content = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("\n");
    if (typeof content !== "string" || !content.trim()) throw new Error("gemini_empty_response");
    return { content };
  } catch (error) {
    if (attempt < 1 && error instanceof TypeError) return callGemini(input, attempt + 1);
    throw error;
  } finally {
    done();
  }
}

async function callAnthropic(input: ChatCallInput, attempt = 0): Promise<ChatCallResult> {
  const apiKey = env(input.providerConfig.secretEnv);
  if (!apiKey) throw new Error("anthropic_api_key_missing");
  const system = input.messages.find((m) => m.role === "system")?.content || "";
  const userMessages = input.messages.filter((m) => m.role !== "system").map((m) => ({
    role: m.role === "assistant" ? "assistant" as const : "user" as const,
    content: m.content,
  }));
  const { controller, done } = timeoutSignal(input.timeoutMs);

  try {
    const response = await fetch(`${input.providerConfig.baseUrl.replace(/\/$/, "")}/messages`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.modelId,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        system,
        messages: userMessages.length ? userMessages : [{ role: "user", content: "Respond in JSON." }],
      }),
    });
    if ([401, 403, 429].includes(response.status)) throw new Error(`anthropic_non_retryable_${response.status}`);
    if (!response.ok) {
      if (attempt < 1 && response.status >= 500) return callAnthropic(input, attempt + 1);
      throw new Error(`anthropic_status_${response.status}`);
    }
    const json = await response.json();
    const content = json?.content?.map((p: { text?: string }) => p.text || "").join("\n");
    if (typeof content !== "string" || !content.trim()) throw new Error("anthropic_empty_response");
    return { content };
  } catch (error) {
    if (attempt < 1 && error instanceof TypeError) return callAnthropic(input, attempt + 1);
    throw error;
  } finally {
    done();
  }
}

export async function invokeProvider(input: ChatCallInput): Promise<ChatCallResult> {
  const kind: ProviderKind = input.providerConfig.kind;
  if (kind === "gemini") return callGemini(input);
  if (kind === "anthropic") return callAnthropic(input);
  return callOpenAICompatible(input);
}

export function providerAvailable(providerConfig: ProviderConfig): boolean {
  return providerConfig.enabled && !!env(providerConfig.secretEnv);
}
