# AI Dev Tools Setup (9Router, Parallel Code, DeerFlow)

Last updated: 2026-07-08

This document describes the **local AI development stack** for YouTrader. These tools live **outside** the Expo app and must **not** modify runtime code, `package.json`, Supabase schema, RevenueCat IDs, or production secrets unless you explicitly approve.

**Install location:** `~/Projects/ai-dev-tools`
**Full README:** `~/Projects/ai-dev-tools/README.md`

---

## What this is for

| Tool | Purpose with YouTrader |
|------|------------------------|
| **9Router** | Route Cursor/Codex/CLI tools through one local OpenAI-compatible endpoint; connect **OpenRouter** as primary provider |
| **Parallel Code** | Run multiple coding agents in **parallel git worktrees** on `youtrader-final`; review diffs before merge |
| **DeerFlow** | Multi-agent harness for **read-only research**, reports, and orchestration (OpenRouter-backed) |

**OpenRouter** is the default model provider for this workflow. Your existing OpenRouter balance is used only from **local dev tools** — not from the Expo app.

---

## Critical safety rules

1. **Never** put `OPENROUTER_API_KEY` in YouTrader `EXPO_PUBLIC_*`, `app.json`, or client bundles
2. Server-side AI for the production app stays in **Supabase Edge Function secrets** (`docs/AI_PROVIDER_SETUP.md`)
3. Agents must **not auto-edit** YouTrader without your confirmation
4. **Review all diffs** before merging Parallel Code worktrees
5. **No** destructive git, `git push`, or production EAS builds from agent sessions

---

## Where to put OPENROUTER_API_KEY

**Recommended single location:**

```bash
mkdir -p ~/.config/youtrader-ai
cp ~/Projects/ai-dev-tools/.env.example ~/.config/youtrader-ai/.env
```

Edit `~/.config/youtrader-ai/.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-your-real-key
```

Launchers load this file automatically via `YOUTRADER_AI_SECRETS` (default path above).

**Also paste the key in 9Router Dashboard** (one-time UI setup):

1. Start 9Router (below)
2. Open http://localhost:20128/dashboard → **Providers → OpenRouter**
3. Paste the same key
4. Copy the **9Router API key** for Cursor/Codex (not the OpenRouter key directly in Cursor if you want RTK routing)

---

## Start commands

```bash
# 1. AI router (start first)
~/Projects/ai-dev-tools/scripts/start-9router.sh

# 2. Parallel agents (Electron) — YouTrader preconfigured
~/Projects/ai-dev-tools/scripts/configure-parallel-code-youtrader.sh   # once, or after preset changes
~/Projects/ai-dev-tools/scripts/start-parallel-code.sh
# → New Task → YouTrader → pick agent (YouTrader · …)

# Verify Parallel Code + parallel worktrees
~/Projects/ai-dev-tools/scripts/verify-parallel-code-youtrader.sh

# 3. DeerFlow research (OpenRouter; read-only by default)
~/Projects/ai-dev-tools/scripts/configure-deerflow-youtrader.sh
~/Projects/ai-dev-tools/scripts/start-deerflow.sh
# → UI: http://localhost:2026
# → Paste workflow: df-youtrader-prompt.sh <id> --copy
~/Projects/ai-dev-tools/scripts/verify-deerflow-youtrader.sh
```

### Cursor + 9Router + OpenRouter

**Cursor → 9Router (required for OpenRouter models):**

```bash
# Fully quit Cursor first (Cmd+Q). A running Cursor overwrites its settings DB.
~/Projects/ai-dev-tools/scripts/configure-cursor-9router.sh
# Reopen Cursor → model picker → openrouter/anthropic/claude-sonnet-4 or youtrader-dev
~/Projects/ai-dev-tools/scripts/verify-cursor-9router.sh
```

Manual UI (same result): Settings → Models → OpenAI Compatible / Override OpenAI Base URL

- **Base URL:** `http://127.0.0.1:20128/v1`
- **API Key:** 9Router dashboard key (not OpenRouter `sk-or-v1-...`)
- **Toggle:** OpenAI API Key = ON (`useOpenAIKey`)
- **Model:** `openrouter/anthropic/claude-sonnet-4` or combo `youtrader-dev`

If Composer still shows Cursor Grok / built-ins: Base URL alone is not enough — enable the OpenAI key toggle and select an `openrouter/...` model in the picker.

**Cursor 3.10+ model picker (important):**

- Cursor no longer auto-imports models from `/v1/models` (`getModels()` returns `[]`).
- Custom models appear when registered via **`modelOverrideEnabled`** + **`userAddedModels`** (same as Settings → **Add Custom Model**).
- On startup, `refreshDefaultModels` removes custom models unless they are in the catalog or sent as `additionalModelNames`.
- Register while Cursor is **fully quit**:

```bash
~/Projects/ai-dev-tools/scripts/register-cursor-openrouter-models.sh
```

Manual fallback: **Settings → Models → Add Custom Model** → e.g. `openrouter/anthropic/claude-sonnet-4` → Add.

---

## YouTrader agent presets (Parallel Code)

Configure once — registers **15** **YouTrader · …** agents with worktree isolation and release auditors:

```bash
~/Projects/ai-dev-tools/scripts/configure-parallel-code-youtrader.sh
~/Projects/ai-dev-tools/scripts/orchestration-youtrader-status.sh
```

**Orchestration architecture:** [AI_DEVELOPMENT_WORKFLOW.md](./AI_DEVELOPMENT_WORKFLOW.md) — CEO talks only to **AI Release Manager**.

```bash
~/Projects/ai-dev-tools/scripts/configure-parallel-code-youtrader.sh
~/Projects/ai-dev-tools/scripts/verify-parallel-code-youtrader.sh
```

| Profile ID | Agent in Parallel Code | Role |
|------------|------------------------|------|
| `senior-rn` | YouTrader · Senior React Native Engineer | Expo/RN bugs and features |
| `senior-ts` | YouTrader · Senior TypeScript Refactoring Engineer | Refactors, types, small diffs |
| `supabase-security` | YouTrader · Supabase Security Engineer | RLS, Edge Functions, auth |
| `ui-ux` | YouTrader · UI/UX Designer | Premium iOS UI (`docs/MY_UI.md`) |
| `aso` | YouTrader · App Store ASO Specialist | ASO, metadata, review copy |
| `qa-auto` | YouTrader · QA Automation Engineer | typecheck, translations, export QA |
| `pm-ai` | YouTrader · AI Trading Product Manager | Product scope (no trade signals) |
| `code-reviewer` | YouTrader · Senior Code Reviewer | **Read-only** diff review — no writes/commits/merge |
| `qa-engineer` | YouTrader · AI QA Engineer | **Read-only** release QA |
| `localization-auditor` | YouTrader · Localization Auditor | **Read-only** i18n audit |
| `performance-auditor` | YouTrader · Performance Auditor | **Read-only** perf audit |
| `app-store-release-auditor` | YouTrader · App Store Release Auditor | **Read-only** ASC/RevenueCat |
| `parallel-code-manager` | YouTrader · Parallel Code Manager | Sub-orchestrator for Agents 1–5 |
| `release-manager` | YouTrader · AI Release Manager | **CEO-facing** 26-step release workflow |
| `project-historian` | YouTrader · AI Project Historian | **CKO** — `docs/history/` only |

Review report template: `docs/PARALLEL_CODE_REVIEW_REPORT.md`
Release workflow: `docs/AI_DEVELOPMENT_WORKFLOW.md`
Project history: `docs/AI_PROJECT_HISTORIAN.md`

Copy a preset prompt into a new task:

```bash
~/Projects/ai-dev-tools/scripts/pc-youtrader-prompt.sh senior-rn --copy
```

Agent definitions: `~/Projects/ai-dev-tools/youtrader/agents/`
Generated prompts: `~/Projects/ai-dev-tools/youtrader/parallel-code/prompts/`
Worktree context: `~/Projects/youtrader-final/.parallel-code/AGENTS.md`

**Safety (enforced in every preset):** work only in the assigned worktree; never push/merge/delete branches; never touch production secrets; reviewable commits only.

Legacy presets (Cursor-only, not in Parallel Code manifest): `revenuecat-app-store-expert.md`, `localization-auditor.md`, etc.

Example prompts: `~/Projects/ai-dev-tools/youtrader/prompts/examples.md`

---

## DeerFlow research workflows (read-only)

Configure once — OpenRouter models, **no bash**, **no file writes**, DuckDuckGo + Jina (free web tools):

```bash
~/Projects/ai-dev-tools/scripts/configure-deerflow-youtrader.sh
~/Projects/ai-dev-tools/scripts/verify-deerflow-youtrader.sh
```

| Workflow ID | Report |
|-------------|--------|
| `app-store-competitors` | App Store competitor analysis |
| `reddit-trader-pains` | Reddit trader pain point analysis |
| `futures-trader-workflow` | Futures trader workflow research |
| `journal-feature-ideas` | Trading journal feature ideas |
| `aso-keywords` | App Store ASO keyword research |
| `review-clustering` | User review clustering |
| `ai-feature-brainstorm` | AI feature brainstorming (no signals) |

Copy a workflow prompt into a new DeerFlow thread:

```bash
~/Projects/ai-dev-tools/scripts/df-youtrader-prompt.sh app-store-competitors --copy
```

Skills: `~/Projects/ai-dev-tools/youtrader/deerflow/skills/public/`
Config: `~/Projects/ai-dev-tools/youtrader/deerflow-openrouter.yaml`

Each workflow returns a **structured markdown report in chat** (metadata, summary, findings, recommendations, sources). No paid search APIs required.

---

## Typical workflow

### Bug fix (single agent)

1. Start **9Router**
2. Open **Cursor** on `youtrader-final` (routed through 9Router)
3. Paste **safety prefix** + agent preset + task from `prompts/examples.md`
4. Approve edits manually; run `npm run typecheck` and `npm run translations:check`

### Parallel features (multiple agents)

1. Start **9Router** + configure/start **Parallel Code**
2. **New Task → YouTrader** → pick a **YouTrader · …** agent
3. Paste prompt: `pc-youtrader-prompt.sh <profile-id> --copy`
4. Each task gets an isolated worktree under `.worktrees/`
5. Review each diff in sidebar → merge manually (never auto-push)

### Research / audit (no code changes)

1. Configure/start **DeerFlow** (`configure-deerflow-youtrader.sh`)
2. New thread → paste: `df-youtrader-prompt.sh <workflow-id> --copy`
3. Review markdown report in chat; implement separately in Cursor with approval

### Production release (AI Release Manager — CEO interface only)

1. Read: `docs/AI_DEVELOPMENT_WORKFLOW.md`
2. Reconfigure if needed: `configure-parallel-code-youtrader.sh`
3. Bootstrap: `prepare-youtrader-release.sh 1.6.0`
4. In Cursor: **Prepare Release 1.6.0**
5. Approve **each of 25 steps** explicitly
6. Release Manager Step 26 → **Record release X.Y.Z** → Project Historian updates `docs/history/`

### Project knowledge (AI Project Historian)

```bash
~/Projects/ai-dev-tools/scripts/init-youtrader-history.sh --seed
~/Projects/ai-dev-tools/scripts/historian-youtrader-prompt.sh why --copy
```

Ask: `Why is cloud sync implemented this way?` or `Record decision: …`
Docs: `docs/AI_PROJECT_HISTORIAN.md`, `docs/history/`

---

## What was NOT changed in YouTrader

This setup does **not** modify:

- App runtime / `App.tsx` / `src/**`
- `package.json`, `app.json`, iOS native files, EAS
- Supabase migrations, RLS, Edge Functions
- RevenueCat product or entitlement IDs

Related existing docs:

- `docs/AI_DEV_WORKFLOW.md` — Context7, Playwright MCP, etc.
- `docs/AI_PROVIDER_SETUP.md` — production server-side AI keys
- `docs/AI_CODING_SECURITY_RULES.md` — coding safety rules

---

## Manual steps you may still need

| Step | Status |
|------|--------|
| Paste real `OPENROUTER_API_KEY` into `~/.config/youtrader-ai/.env` | **Required** |
| 9Router Dashboard: connect OpenRouter provider | **Required** |
| Cursor: configure OpenAI-compatible endpoint | **Required** |
| Parallel Code: install a CLI agent (Codex, Claude Code, etc.) | If not already installed |
| DeerFlow: optional web search keys (Serper/Tavily) | **Not needed** — DuckDuckGo + Jina used |
| Docker for DeerFlow sandbox mode | Optional (local mode used) |

---

## Validation

After setup, verify:

```bash
# 9Router responds
curl -s -o /dev/null -w "%{http_code}" http://localhost:20128/dashboard

# DeerFlow deps
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"
cd ~/Projects/ai-dev-tools/deer-flow && make check

# Parallel Code compiles
cd ~/Projects/ai-dev-tools/parallel-code && npm run compile
```

See `~/Projects/ai-dev-tools/README.md` for troubleshooting.
