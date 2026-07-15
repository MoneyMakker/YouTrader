# AI A/B Testing

Prompt experiment framework for Platform V2.

**Status:** Schema ready (Phase 5) — **not enabled in production**

---

## Goal

Compare prompt versions with measurable outcomes:

- Completion rate (valid JSON returned)
- User thumbs up / feedback (future client event)
- Conversation length / re-invocation rate
- Retention correlation (PostHog)
- Subscription conversion (RevenueCat events — read-only analytics)

---

## Schema (pending migration)

Table: `ai_prompt_experiments`

| Column | Purpose |
|--------|---------|
| `variant_a_version` / `variant_b_version` | e.g. `coach_v18` vs `coach_v19` |
| `traffic_split_a` | Default 50 |
| `status` | draft → running → completed |
| `winner_version` | Set after statistical review |

---

## Assignment algorithm (Phase 5)

```text
hash(user_id + experiment_id) % 100 < traffic_split_a → variant A
else → variant B
```

Sticky per user for experiment duration.

---

## Metrics collection

| Event | Source |
|-------|--------|
| `ai_request_completed` | Edge router (success, latency, version) |
| `ai_feedback_positive` | Client PostHog (future) |
| `ai_coach_completed` | Existing analytics |

Join on `request_id` + `user_id`.

---

## Winner selection

Automatic **recommendation only** — human approval required:

1. Minimum sample size (e.g. 500 requests per variant)
2. Compare JSON parse success rate
3. Compare median latency (must not regress >20%)
4. Compare downstream engagement (if available)
5. CEO approves promotion to `active` prompt version

---

## Safety

- No experiments on free-tier paid generation (free stays local fallback)
- No experiments that weaken financial-advice guardrails
- Instant rollback via `AI_PROMPT_VERSION_*` env override

---

## Phase 5 checklist

- [ ] CEO approval
- [ ] Apply migration `20260708180000_ai_platform_v2_foundation.sql`
- [ ] Implement experiment assignment in router
- [ ] PostHog event schema
- [ ] Internal dashboard or SQL views
