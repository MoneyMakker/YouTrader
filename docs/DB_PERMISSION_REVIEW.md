# Database Permission Review — `user_subscriptions` / `service_role`

**Generated:** 2026-07-09
**Scope:** Preview / Staging (`izzrlsgumyabdvlmwlwn`)
**Migration:** `supabase/migrations/20260709203000_grant_service_role_user_subscriptions_select.sql`
**Status:** Applied to linked preview project · **NOT merged/pushed automatically**
**Production / TestFlight:** NOT approved

---

## Executive summary

| Check | Status |
|-------|--------|
| Migration created & reviewed | **PASS** |
| Migration applied (preview DB) | **PASS** |
| Least privilege (SELECT only, one role) | **PASS** |
| RLS unchanged for clients | **PASS** |
| Only `service_role` affected | **PASS** |
| No extra permissions in this migration | **PASS** |
| Follow-up: `ai_usage_events` for Edge quota | **WARNING** |
| AI Platform live validation (post-migration) | **PASS** |
| Preview gate | **READY FOR PREVIEW** |

---

## 1. Why this permission is required

Supabase Edge Functions (`ai-coach`, `market-intelligence`) validate **Pro entitlement on the server** before calling cloud AI:

```typescript
// supabase/functions/ai-coach/index.ts
const { data } = await supabaseAdmin
  .from("user_subscriptions")
  .select("status, expires_at")
  .eq("user_id", userId)
  .eq("entitlement_id", entitlementId)
  .maybeSingle();
```

The admin client uses **`SUPABASE_SERVICE_ROLE_KEY`**, which maps to Postgres role **`service_role`**.

On Supabase/PostgREST, **RLS bypass does not replace table-level GRANTs**. Without `GRANT SELECT`, the query returns `permission denied`, `hasServerProEntitlement()` returns `false`, and **all Pro users receive `free_preview` (local analysis only)** — even when RevenueCat/subscription rows exist.

This is independent of AI Platform V2; it affects **every server-side Pro gate** that reads `user_subscriptions`.

---

## 2. Why it was missing

| Factor | Detail |
|--------|--------|
| **Initial migration gap** | `20260627231000_add_runtime_tables_rls.sql` granted `SELECT` to **`authenticated`** only, not `service_role`. |
| **Pattern inconsistency** | Later migrations (e.g. `20260628233324_harden_market_intel_permissions.sql`) explicitly grant `service_role` on worker tables; `user_subscriptions` was omitted. |
| **Preview discovery** | Live validation during AI Platform V2 Preview Deploy surfaced `permission denied for table user_subscriptions` when creating ephemeral Pro test users. |
| **Manual hotfix (preview)** | Temporary `GRANT SELECT` was applied during preview validation; this migration **formalizes** that fix in version control. |

---

## 3. Functionality that depends on it

| Feature | Edge Function | Without SELECT |
|---------|---------------|----------------|
| **AI Coach (Pro cloud AI)** | `ai-coach` | Pro users get `free_preview` only |
| **Market Intelligence (Pro)** | `market-intelligence` | Pro market AI blocked |
| **AI Platform V2 router path** | via `ai-coach` | Router never reached for misclassified users |
| **Rate limits / quotas** | `ai-coach` (after Pro check) | Cloud path not entered |

**Not affected by this grant:** subscription **writes** (RevenueCat webhooks, admin tools, SQL workers) — those use other roles/paths with their own grants.

---

## 4. Security implications

| Topic | Assessment |
|-------|------------|
| **Privilege granted** | `SELECT` only — read-only |
| **Role** | `service_role` — server-side only; key must never ship in Expo client |
| **Scope of read** | PostgREST allows reading rows the query filters; Edge code **must** filter by `user_id` from verified JWT (current code does) |
| **RLS** | `service_role` bypasses RLS for this client; **defense in depth** relies on Edge Functions never exposing raw subscription tables to clients |
| **Client exposure** | Unchanged — `authenticated` still governed by RLS (`auth.uid() = user_id`) |
| **`anon`** | No `SELECT` on `user_subscriptions` — **PASS** |

**Risk if misused:** A leaked `service_role` key could read all subscription rows. This is **pre-existing** for any table with `service_role` grants (market intel, RAG, etc.). Mitigations: key in Supabase secrets only, rotation, no client exposure.

---

## 5. Least privilege verification

**Section status:** **PASS**

| Check | Status | Detail |
|-------|--------|--------|
| Minimum privilege | **PASS** | `SELECT` only (not INSERT/UPDATE/DELETE) |
| Minimum role | **PASS** | `service_role` only |
| `anon` unchanged | **PASS** | No SELECT granted |
| `authenticated` unchanged | **PASS** | Existing SELECT + RLS preserved |
| Idempotent migration | **PASS** | Re-applying GRANT is safe |

```sql
-- Entire migration (intentionally minimal):
grant select on public.user_subscriptions to service_role;
```

---

## 6. Additional permissions required?

**Section status:** **WARNING**

Automated audit: `npm run ai-platform:verify-db-permissions`

| Table | Role | Privilege | Status | Notes |
|-------|------|-----------|--------|-------|
| `user_subscriptions` | `service_role` | SELECT | **PASS** | This migration |
| `user_subscriptions` | `authenticated` | SELECT | **PASS** | Pre-existing |
| `ai_usage_events` | `service_role` | SELECT | **WARNING** | Needed for rate-limit **count** in `rateLimits.ts` |
| `ai_usage_events` | `service_role` | INSERT | **WARNING** | Needed for usage/cost **metadata** persistence |
| `ai_usage_events` | `authenticated` | SELECT, INSERT | **PASS** | Pre-existing |

**Current behavior without `ai_usage_events` service_role grants:**

- Rate limit check **fails open** (`allowed: true`) on permission error — see `rateLimits.ts`.
- Usage insert **fails silently** (logged) — explains live validation **WARNING** on cost metadata.

**Recommendation:** Separate reviewed migration (CEO gate) before Production:

```sql
grant select, insert on public.ai_usage_events to service_role;
```

**Not included in this change** per scoped approval (subscriptions only).

Other Edge tables (`user_app_state`, `security_events`, `upload_files`) have separate permission models; **no additional grants required for AI Platform V2 Phase 1** beyond the WARNING above.

---

## 7. RLS behavior verification

**Section status:** **PASS**

| Check | Status | Detail |
|-------|--------|--------|
| RLS enabled on `user_subscriptions` | **PASS** | `relrowsecurity = true` |
| Policies unchanged | **PASS** | `Users read own subscriptions` — `auth.uid() = user_id` for `authenticated` |
| No new policies added | **PASS** | Migration is GRANT-only |
| `service_role` bypass | **PASS** | Expected for server-side entitlement lookup with JWT-scoped queries |

Verified policies (preview DB):

- `Users read own subscription status` → `authenticated`, SELECT, `auth.uid() = user_id`
- `Users read own subscriptions` → `authenticated`, SELECT, `auth.uid() = user_id`

---

## 8. Only `service_role` affected

**Section status:** **PASS**

| Role | Change |
|------|--------|
| `service_role` | **+SELECT** on `user_subscriptions` |
| `authenticated` | No change |
| `anon` | No change |
| `postgres` / others | No change |

---

## 9. Migration artifact

**File:** `supabase/migrations/20260709203000_grant_service_role_user_subscriptions_select.sql`

**Applied to preview project:** `izzrlsgumyabdvlmwlwn` (via Supabase migration API)
**Git:** Local file only — **not pushed/merged** per release policy.

---

## 10. Post-migration validation

**Section status:** **PASS**

| Command | Result |
|---------|--------|
| `npm run ai-platform:verify-db-permissions` | `user_subscriptions` SELECT **PASS** |
| `npm run ai-platform:validate -- --live` | **46 PASS · 0 FAIL · 3 WARN** |
| `npm run ai-platform:preview-report` | **READY FOR PREVIEW** |

Live comparison (post-migration):

- V2 success rate: **100%**
- Legacy success rate: **100%**
- Pro cloud provider: `openrouter` (not `free_preview`)

Reports: `scripts/ai-platform-v2/reports/live-comparison.json`, `docs/PREVIEW_DEPLOY_REPORT.md`

---

## Final gate status

```
READY FOR PREVIEW
```

Database permission fix for **Pro entitlement reads** is complete for preview. **TestFlight build not started.** **Production not approved.**

### Next steps (CEO gates)

1. Review & approve migration file for git (when you choose to commit — no auto-push)
2. Optional follow-up migration: `ai_usage_events` SELECT/INSERT for `service_role` (quota + cost metadata)
3. TestFlight build — **wait for explicit approval**

---

## Audit commands

```bash
npm run ai-platform:verify-db-permissions
npm run ai-platform:validate -- --live
npm run ai-platform:preview-report
```

Raw JSON: `scripts/ai-platform-v2/reports/db-permissions.json`
