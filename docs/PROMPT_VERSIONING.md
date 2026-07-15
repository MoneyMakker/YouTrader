# Prompt Versioning

Platform V2 prompt lifecycle for coach and market features.

**Phase 1:** In-code registry (`prompts/registry.ts`) + env override
**Phase 4:** Postgres `ai_prompt_versions` table (migration pending approval)

---

## Naming convention

```text
{family}_v{N}

Examples:
  coach_v1
  coach_v18
  market_v1
```

---

## Version metadata

Each version stores:

| Field | Purpose |
|-------|---------|
| `version` | Unique id |
| `date` | Introduced |
| `description` | What changed |
| `author` | Owner |
| `expectedOutcome` | Success criteria |
| `systemTemplate` | Prompt with `{{SCHEMA}}` placeholder |

---

## Current baseline

| Version | Family | Status |
|---------|--------|--------|
| `coach_v1` | coach | Active default |
| `market_v1` | market | Active default (Phase 2) |

---

## Override (no deploy)

```bash
supabase secrets set AI_PROMPT_VERSION_COACH=coach_v1
supabase secrets set AI_PROMPT_VERSION_WEEKLY_COACH=coach_v1
```

Per-endpoint: `AI_PROMPT_VERSION_{ENDPOINT_UPPERCASE}`

---

## Rollback

1. Set env to previous version id
2. Redeploy `ai-coach` (or hot-reload secrets)
3. Never delete old versions from registry / DB

---

## Phase 4 workflow (after migration)

1. Insert new row in `ai_prompt_versions` with `active=false`
2. Test in staging with env override
3. Set `active=true` on new version, deactivate old
4. Record in `docs/history/AI_EVOLUTION.md`

Migration file: `supabase/migrations/20260708180000_ai_platform_v2_foundation.sql`

**Do not apply until CEO approves Phase 4.**

---

## API (Edge, future)

```typescript
import { resolvePromptVersion, buildSystemPrompt } from "./aiPlatform/index.ts";

const meta = resolvePromptVersion("weekly_coach");
const system = buildSystemPrompt("weekly_coach", schemaInstruction);
```

Router attaches `promptVersion` to every request log and Langfuse trace.
