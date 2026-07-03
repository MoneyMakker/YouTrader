#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const DEFAULT_SOURCE_DIR = join(ROOT, 'knowledge', 'sources');
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const TARGET_CHARS = 2200;
const OVERLAP_CHARS = 260;

const PROVIDERS = new Map([
  ['topstep', 'topstep'],
  ['apex', 'apex'],
  ['take-profit-trader', 'take_profit_trader'],
  ['take_profit_trader', 'take_profit_trader'],
  ['lucid', 'lucid'],
  ['cme', 'cme'],
  ['economic-calendar-faq', 'economic_calendar_faq'],
  ['economic_calendar_faq', 'economic_calendar_faq'],
  ['risk-management-guide', 'risk_management_guide'],
  ['risk_management_guide', 'risk_management_guide'],
  ['journaling-guide', 'journaling_guide'],
  ['journaling_guide', 'journaling_guide'],
]);

function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return [path];
  });
}

function readPdf(path) {
  const out = join('/tmp', `youtrader-rag-${sha256(path).slice(0, 10)}.txt`);
  try {
    execFileSync('pdftotext', ['-layout', path, out], { stdio: 'ignore' });
    return readFileSync(out, 'utf8');
  } catch {
    throw new Error(`PDF import requires pdftotext. Install poppler: brew install poppler. File: ${path}`);
  }
}

function readSource(path) {
  const ext = extname(path).toLowerCase();
  if (ext === '.md' || ext === '.markdown') return { type: 'markdown', text: readFileSync(path, 'utf8') };
  if (ext === '.txt' || ext === '.text') return { type: 'text', text: readFileSync(path, 'utf8') };
  if (ext === '.pdf') return { type: 'pdf', text: readPdf(path) };
  return null;
}

function metadataFromText(path, text) {
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  const meta = {};
  if (frontmatter) {
    for (const line of frontmatter[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
  const rel = relative(DEFAULT_SOURCE_DIR, path).replaceAll('\\', '/');
  const name = basename(path, extname(path)).toLowerCase();
  const providerKey = String(meta.provider || rel.split('/')[0] || name).toLowerCase();
  const provider = PROVIDERS.get(providerKey) || PROVIDERS.get(name) || 'internal';
  return {
    slug: String(meta.slug || `${provider}-${name}`).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120),
    title: String(meta.title || basename(path, extname(path))).slice(0, 180),
    provider,
    sourceUrl: meta.source_url || meta.sourceUrl || null,
    lastUpdated: meta.last_updated || meta.lastUpdated || new Date().toISOString().slice(0, 10),
  };
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}

function splitSections(text) {
  const lines = stripFrontmatter(text).replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let current = { heading: '', lines: [] };
  for (const line of lines) {
    if (/^#{1,4}\s+/.test(line) && current.lines.join('\n').trim()) {
      sections.push(current);
      current = { heading: line.replace(/^#{1,4}\s+/, '').trim(), lines: [] };
    } else {
      if (/^#{1,4}\s+/.test(line)) current.heading = line.replace(/^#{1,4}\s+/, '').trim();
      current.lines.push(line);
    }
  }
  if (current.lines.join('\n').trim()) sections.push(current);
  return sections;
}

function semanticChunks(text) {
  const chunks = [];
  for (const section of splitSections(text)) {
    const paragraphs = section.lines.join('\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let buf = '';
    for (const paragraph of paragraphs) {
      const candidate = buf ? `${buf}\n\n${paragraph}` : paragraph;
      if (candidate.length > TARGET_CHARS && buf.length > 120) {
        chunks.push({ heading: section.heading || null, content: buf.trim() });
        buf = `${buf.slice(-OVERLAP_CHARS)}\n\n${paragraph}`.trim();
      } else {
        buf = candidate;
      }
    }
    if (buf.trim()) chunks.push({ heading: section.heading || null, content: buf.trim() });
  }
  return chunks.filter((chunk) => chunk.content.length >= 20).map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
    tokenEstimate: Math.ceil(chunk.content.length / 4),
    contentHash: sha256(chunk.content),
  }));
}

async function embed(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requiredEnv('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!response.ok) throw new Error(`OpenAI embeddings failed: ${response.status} ${await response.text()}`);
  const json = await response.json();
  const vector = json?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) throw new Error('Embedding response missing vector');
  return vector;
}

function vectorLiteral(vector) {
  return `[${vector.map((value) => Number(value).toFixed(8)).join(',')}]`;
}

async function importFile(supabase, path) {
  const source = readSource(path);
  if (!source) return { skipped: true, path };
  const meta = metadataFromText(path, source.text);
  const text = stripFrontmatter(source.text);
  const chunks = semanticChunks(text);
  if (!chunks.length) return { skipped: true, path, reason: 'no chunks' };
  const sourceFile = relative(ROOT, path).replaceAll('\\', '/');
  const { data: doc, error: docError } = await supabase
    .from('knowledge_documents')
    .upsert({
      slug: meta.slug,
      title: meta.title,
      provider: meta.provider,
      document_type: source.type,
      source_url: meta.sourceUrl,
      source_file: sourceFile,
      content_hash: sha256(text),
      last_updated: meta.lastUpdated,
      imported_at: new Date().toISOString(),
      metadata: { importer: 'scripts/rag/import-knowledge.mjs' },
    }, { onConflict: 'slug' })
    .select('id')
    .single();
  if (docError) throw docError;

  await supabase.from('knowledge_chunks').delete().eq('document_id', doc.id);
  for (const chunk of chunks) {
    const { data: inserted, error: chunkError } = await supabase
      .from('knowledge_chunks')
      .insert({
        document_id: doc.id,
        chunk_index: chunk.chunkIndex,
        heading: chunk.heading,
        content: chunk.content,
        token_estimate: chunk.tokenEstimate,
        content_hash: chunk.contentHash,
        metadata: {},
      })
      .select('id')
      .single();
    if (chunkError) throw chunkError;
    const vector = await embed(`${meta.title}\n${chunk.heading || ''}\n${chunk.content}`);
    const { error: embeddingError } = await supabase.from('knowledge_embeddings').insert({
      chunk_id: inserted.id,
      embedding_model: EMBEDDING_MODEL,
      embedding: vectorLiteral(vector),
    });
    if (embeddingError) throw embeddingError;
  }
  return { skipped: false, path, chunks: chunks.length };
}

async function main() {
  const sourceDir = resolve(arg('dir', DEFAULT_SOURCE_DIR));
  mkdirSync(sourceDir, { recursive: true });
  const files = walk(sourceDir).filter((path) => ['.md', '.markdown', '.txt', '.text', '.pdf'].includes(extname(path).toLowerCase()));
  if (!files.length) {
    console.log(`No knowledge files found in ${sourceDir}`);
    return;
  }
  const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'));
  const results = [];
  for (const file of files) {
    console.log(`Importing ${relative(ROOT, file)}...`);
    results.push(await importFile(supabase, file));
  }
  const imported = results.filter((r) => !r.skipped);
  const skipped = results.filter((r) => r.skipped);
  writeFileSync(join(sourceDir, '.last-import.json'), JSON.stringify({ imported, skipped, importedAt: new Date().toISOString() }, null, 2));
  console.log(`Imported ${imported.length} documents, skipped ${skipped.length}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
