# AI Health Dashboard

Production observability surface for YouTrader AI Platform V2.

**Status:** Design + data sources defined — **dashboard UI not deployed**

---

## Purpose

Single pane for AI reliability, cost, and model health. Used by engineering and CEO before/after each phase deploy.

---

## Dashboard sections

### AI Status (per product)

| Product | Metrics |
|---------|---------|
| **AI Coach** | Current model, latency p50/p95, cost today, success rate |
| **Market Intelligence** | Same (Phase 2+) |

### Cost

| Widget | Source (Phase 1) | Source (Phase 3+) |
|--------|------------------|-------------------|
| Today's cost | `ai_usage_events.metadata.estimatedCostUsd` | `ai_platform_requests` |
| Yesterday's cost | Same | Same |
| Monthly projection | 14-day avg × days in month | SQL view |
| Yearly projection | Monthly × 12 × growth factor | Same |
| Avg cost / user | cost ÷ distinct user_id | Same |
| Avg tokens / request | metadata tokens | Same |

### Traffic

| Widget | Metric |
|--------|--------|
| Requests today | count by endpoint |
| Requests / user | distribution |
| Cache hit rate | `cacheHit=true` ÷ total |
| Fallback count | `usedFallback=true` |
| Slow requests | latency > 10s |

### Distribution

| Widget | Breakdown |
|--------|-----------|
| Provider distribution | openrouter, gemini, anthropic, nvidia, local |
| Model distribution | modelRef / modelId |
| Prompt version | coach_v1, coach_v2, … |

### Performance

| Widget | Description |
|--------|-------------|
| Best performing model | Highest success rate + lowest p95 (7d) |
| Worst performing model | Highest fallback or error rate |
| Recommendation engine | Benchmark + A/B winners (read-only) |

### Health score

Composite **AI Health Score** (0–100):

```text
score = 100
  - (fallback_rate × 30)
  - (error_rate × 40)
  - (p95_latency_penalty)   // >8s fast, >15s deep
  - (daily_cost_spike_penalty)
```

### Alerts

| Level | Condition |
|-------|-----------|
| Warning | Fallback rate > 10% (1h) |
| Warning | Cache hit < 5% on cacheable endpoints |
| Error | Success rate < 95% (1h) |
| Error | Daily cost > 1.5× 7-day average |

---

## Data pipeline

```text
Edge Router
  ├─► Structured log (ai_platform_request)
  ├─► Langfuse trace
  ├─► ai_usage_events.metadata (Phase 1)
  └─► ai_platform_requests row (Phase 3 migration)

PostHog (client)
  └─► ai_coach_* product events

Sentry (client)
  └─► Crashes near AI screens

Supabase SQL / Retool / Grafana
  └─► Dashboard widgets
```

---

## Example layout

```text
┌─────────────────────────────────────────────────────────┐
│ AI STATUS          │ Today's Cost │ Health Score: 94   │
├────────────────────┼──────────────┼────────────────────┤
│ AI Coach           │ $12.40       │ ✅ Success 98.2%   │
│  gemini-flash      │              │ p95 4.2s           │
├────────────────────┼──────────────┼────────────────────┤
│ Market Intel       │ $3.10        │ ⚠️ Legacy path     │
│  nvidia-llama      │              │ Phase 2 pending    │
├─────────────────────────────────────────────────────────┤
│ Fallbacks: 23 │ Cache: 18% │ Slow: 4 │ Requests: 1,842  │
├─────────────────────────────────────────────────────────┤
│ Provider ████ OpenRouter 62%  Gemini 21%  Local 12%    │
│ Model    ████ gemini-flash 55%  claude-sonnet 30%      │
├─────────────────────────────────────────────────────────┤
│ Warnings: fallback spike on risk_predictor (staging)   │
│ Recommendation: benchmark suggests deepseek for fast   │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation phases

| Phase | Deliverable |
|-------|-------------|
| 1 | Query `ai_usage_events` metadata in Supabase SQL editor |
| 3 | `ai_platform_requests` + materialized views |
| 3 | Cost projection SQL functions |
| 5 | Experiment overlay on dashboard |
| 6 | Benchmark recommendation panel |

---

## Access control

- Dashboard: **service role / internal only**
- No PII, prompts, or journal content in widgets
- CEO + engineering read; no external sharing

---

## Validation

Health data sources verified in:

```bash
npm run ai-platform:validate:report
```

Checks: Langfuse, PostHog, Sentry, structured logs, cost metadata fields.
