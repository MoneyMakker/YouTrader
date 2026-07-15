# AI Benchmark Engine

Weekly model evaluation for YouTrader AI Platform V2.

**Status:** Dry-run only — **never modifies production routing**

---

## Purpose

Every week, run the **same Golden Test Suite** (~100 prompts) against every supported model and produce **recommendations only**. Production config changes require CEO approval.

---

## Golden Test Suite

File: `scripts/ai-platform-v2/golden-prompts.json`

| Category | Examples | Count |
|----------|----------|-------|
| Trading journal analysis | Long/short/empty journal | ~15 |
| Weekly coaching | Performance review, habits | ~15 |
| Risk management | Drawdown, position sizing | ~10 |
| Emotional trading | Revenge, FOMO, tilt | ~10 |
| Prop firm evaluation | Rules, consistency | ~8 |
| News explanation | Macro, earnings, crypto | ~10 |
| Market Intelligence | Sentiment, brief (Phase 2+) | ~10 |
| Stress / edge | Poor network sim, huge payload | ~12 |
| Localization | RU/EN/ES prompts | ~10 |

**Rule:** Every benchmark run uses **exactly** this file — no ad-hoc prompts.

---

## Dimensions evaluated

| Dimension | Measurement |
|-----------|-------------|
| Response quality | Schema validity + rubric (human or LLM-judge in live mode) |
| Speed / latency | p50, p95 ms |
| Reliability | Success rate, HTTP errors |
| Cost | Estimated USD from token counts |
| Token usage | Input + output |
| Fallback frequency | N/A per-model; tracked at router level |
| Instruction following | JSON schema compliance |
| Reasoning quality | Rubric on coach/risk prompts |
| Hallucination risk | Factuality checks vs payload |
| Localization quality | Language match |
| Long-context performance | Prompts >12k tokens |

---

## Supported providers (config-driven)

From `config.default.json` — not hardcoded in benchmark script:

- Claude (Anthropic / OpenRouter)
- GPT (OpenAI / OpenRouter)
- Gemini (Google / OpenRouter)
- DeepSeek (OpenRouter)
- Qwen (future — add to config)
- Kimi (OpenRouter)
- NVIDIA Llama (legacy fallback)

---

## Rankings output

Each weekly run produces:

| Ranking | Meaning |
|---------|---------|
| Best quality | Highest rubric + schema pass rate |
| Best latency | Lowest p95 |
| Best price | Lowest cost per successful request |
| Best overall | Weighted score (quality 40%, latency 25%, cost 25%, reliability 10%) |
| Best cost/quality | Quality ÷ cost |

Reports: `scripts/ai-platform-v2/reports/benchmark-YYYY-MM-DD.json`

---

## Commands

```bash
# Dry-run (default — no API calls)
npm run ai-platform:benchmark

# Live (CEO approval + provider keys in env)
node scripts/ai-platform-v2/run-benchmark.mjs --live
```

---

## Integration with validation pipeline

Static validation checks:

- Golden suite count = 100
- Coach endpoints represented
- Config models match benchmark candidates

Live benchmark runs **after** Preview Deploy approval.

---

## Safety rules

1. **Never** auto-update `config.default.json` or Supabase secrets from benchmark results
2. **Never** run live benchmarks against production user traffic
3. Store only aggregated metrics — no raw journal content in reports
4. Weekly cron (future): GitHub Action or Supabase cron → dry-run in CI; live in staging only

---

## Phase 6 checklist

- [ ] CEO approval for live benchmark in staging
- [ ] LLM-judge rubric for quality scoring
- [ ] Historical chart storage (Phase 3 cost tables or object storage)
- [ ] Slack/email summary of weekly rankings
- [ ] Compare benchmark winners vs current router defaults
