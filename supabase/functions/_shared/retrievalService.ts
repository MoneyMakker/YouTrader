import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

type RetrievalChunk = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  provider: string;
  source_url: string | null;
  source_file: string;
  last_updated: string;
  heading: string | null;
  content: string;
  confidence: number;
  embedding_model: string;
};

export type RetrievalContext = {
  query: string;
  confidence: number;
  lowConfidence: boolean;
  contextText: string;
  sources: {
    source: string;
    document: string;
    lastUpdated: string;
    confidence: number;
    sourceUrl?: string | null;
  }[];
};

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const MIN_CONFIDENCE = 0.72;

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function safeQueryText(input: { action: string; period: string; payload: Record<string, unknown> }) {
  const payload = { ...input.payload };
  delete payload.photoUri;
  delete payload.voiceUri;
  delete payload.voiceName;
  delete payload.screenshots;
  delete payload.images;
  delete payload.notes;
  return JSON.stringify({ action: input.action, period: input.period, payload }).slice(0, 6000);
}

async function createEmbedding(text: string) {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY missing for RAG embeddings");
  const model = env("OPENAI_EMBEDDING_MODEL") || DEFAULT_EMBEDDING_MODEL;
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: text }),
  });
  if (!response.ok) throw new Error(`OpenAI embeddings status ${response.status}`);
  const json = await response.json();
  const embedding = json?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new Error("OpenAI embeddings response missing vector");
  return embedding as number[];
}

function vectorLiteral(embedding: number[]) {
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

export async function retrieveKnowledgeContext(input: {
  action: string;
  period: string;
  payload: Record<string, unknown>;
  matchCount?: number;
}): Promise<RetrievalContext> {
  const query = safeQueryText(input);
  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service env missing for RAG retrieval");

  const embedding = await createEmbedding(query);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.rpc("rag_match_knowledge_chunks", {
    query_embedding: vectorLiteral(embedding),
    match_count: input.matchCount || 6,
    min_confidence: MIN_CONFIDENCE,
    provider_filter: null,
  });
  if (error) throw new Error(`RAG retrieval failed: ${error.message}`);

  const chunks = ((data || []) as RetrievalChunk[]).slice(0, input.matchCount || 6);
  const confidence = chunks.length ? Math.max(...chunks.map((chunk) => Number(chunk.confidence || 0))) : 0;
  const sources = chunks.map((chunk) => ({
    source: chunk.provider,
    document: chunk.document_title,
    lastUpdated: chunk.last_updated,
    confidence: Number(Number(chunk.confidence || 0).toFixed(3)),
    sourceUrl: chunk.source_url,
  }));
  const contextText = chunks.map((chunk, index) => [
    `SOURCE ${index + 1}`,
    `Document: ${chunk.document_title}`,
    `Provider: ${chunk.provider}`,
    `Last updated: ${chunk.last_updated}`,
    `Confidence: ${Number(chunk.confidence || 0).toFixed(3)}`,
    chunk.heading ? `Section: ${chunk.heading}` : null,
    "Content:",
    chunk.content,
  ].filter(Boolean).join("\n")).join("\n\n---\n\n");

  return {
    query,
    confidence: Number(confidence.toFixed(3)),
    lowConfidence: confidence < MIN_CONFIDENCE,
    contextText,
    sources,
  };
}
