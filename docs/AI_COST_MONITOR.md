# AI Cost Monitor

Cost observability design for AI Platform V2.

**Phase 1:** Estimates in router response → `ai_usage_events.metadata`  
**Phase 3:** Dedicated `ai_platform_requests` table + dashboard (migration pending)

---

## Metrics tracked (Phase 1 via metadata)

| Metric | Source |
|--------|--------|
| requests / action | `ai_usage_events` |
| provider / model | `metadata.modelId`, `metadata.modelRef` |
| latency | `metadata.latencyMs` |
| fallback | `metadata.usedFallback`, `metadata.fallbackReason` |
| cache hit | `metadata.cacheHit` |
| tokens (est.) | `metadata.estimatedInputTokens`, `estimatedOutputTokens` |
| cost (est.) | `metadata.estimatedCostUsd` |
| prompt version | `metadata.promptVersion` |
| request id | `metadata.requestId` |

---

## Cost estimation

Per-model rates in `config.default.json`:

```json
"costPer1MInputUsd": 3,
"costPer1MOutputUsd": 15
```

Formula: `(input/1e6 * inRate) + (output/1e6 * outRate)`

**Note:** Estimates until provider usage APIs integrated. Langfuse can refine with actual usage when available.

---

## Phase 3 dashboard queries (after migration)

```sql
-- Daily cost by endpoint
select date_trunc('day', created_at) as day,
       endpoint,
       sum(estimated_cost_usd) as cost_usd,
       count(*) as requests
from ai_platform_requests
where success = true
group by 1, 2
order by 1 desc;

-- Fallback rate
select endpoint,
       avg(case when used_fallback then 1.0 else 0.0 end) as fallback_rate
from ai_platform_requests
where created_at > now() - interval '7 days'
group by 1;

-- P95 latency
select endpoint,
       percentile_cont(0.95) within group (order by latency_ms) as p95_ms
from ai_platform_requests
where created_at > now() - interval '7 days'
group by 1;
```

---

## Alerts (recommended)

| Alert | Threshold |
|-------|-----------|
| Daily spend | > 7-day rolling avg × 1.5 |
| Fallback rate | > 15% over 1 hour |
| P95 latency | > 12s for fast tier |
| Cache hit rate | < 10% for idempotent endpoints |

Implement via Supabase cron + webhook or external monitoring (Phase 3).

---

## Forecast

Monthly forecast (Phase 3):

```text
forecast = avg(daily_cost_last_14d) * days_in_month
```

Adjust for Pro user growth using `requests/user` trend.

---

## Privacy

Cost logs must **not** store:

- Raw prompts
- Journal payloads
- Photos / voice notes
- User email

Only: `user_id`, endpoint, metrics, prompt version id.
