# Cloudflare Setup for YouTrader

Last updated: 2026-07-04

This guide prepares Cloudflare for DNS, CDN, and basic protection. DNS is **not** assumed to be connected yet.

## What stays where

| Asset / service | Host | Cloudflare role |
|----------------|------|-----------------|
| Mobile app | App Store / EAS | None |
| Supabase API + Auth | `*.supabase.co` | Do **not** proxy through Cloudflare |
| Supabase Edge Functions | Supabase | Do **not** cache |
| Static legal pages | Vercel / your web host | Proxy + CDN via Cloudflare |
| Privacy / Terms / Support | `youtrader.app` (or subdomain) | Cache static HTML |

## Step 1 — Add domain to Cloudflare

1. Create account at [cloudflare.com](https://cloudflare.com)
2. **Add a site** → enter your domain (e.g. `youtrader.app`)
3. Select **Free** plan
4. Cloudflare shows two nameservers — update these at your domain registrar
5. Wait for status **Active**

## Step 2 — DNS records

Typical setup (adjust to your Vercel/hosting provider):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` or `www` | Vercel/host target | Proxied (orange cloud) |
| CNAME | `www` | same as apex | Proxied |
| TXT | `@` | SPF/DKIM for email (Resend) | DNS only |

**Do not** create Cloudflare DNS records pointing at Supabase project URL for API traffic from the mobile app. The app talks to Supabase directly.

## Step 3 — Enable free CDN / proxy

- Ensure legal/support pages use **Proxied** (orange cloud) records
- SSL/TLS mode: **Full (strict)** if origin has valid cert

## Step 4 — Recommended cache rules

**Cache static pages (Browser + Edge):**

- Match: URI Path equals `/privacy`, `/terms`, `/support`, `/eula`
- Cache eligibility: eligible
- Edge TTL: 1 day
- Browser TTL: 1 hour

**Bypass cache for dynamic/API:**

- Match: URI Path starts with `/api`
- Cache: Bypass

**Do NOT cache:**

- Supabase REST/Auth URLs
- Webhook endpoints (RevenueCat, etc.)
- Any authenticated responses

## Step 5 — Security settings (Free tier)

1. **Security → Settings** — Security Level: Medium
2. **Bots → Bot Fight Mode** — On (optional for marketing site)
3. **SSL/TLS** — Full (strict), Always Use HTTPS: On
4. **Firewall rules** (optional):
   - Challenge countries with abnormal traffic only if you see abuse
   - Never block Apple/Google OAuth redirect paths on marketing domain

## Step 6 — Optional Workers / R2

Use only when needed:

- **Workers**: edge redirects (`youtrader.app/download` → App Store)
- **R2**: large static assets (share templates, marketing images) if Vercel bandwidth grows

Do **not** migrate user uploads or journal data to R2 without a separate security review.

## Step 7 — Keep Supabase safe

- Mobile app uses `EXPO_PUBLIC_SUPABASE_URL` directly — not through Cloudflare
- Edge Functions secrets (`RESEND_API_KEY`, `UPSTASH_*`) live in Supabase only
- CORS on Edge Functions: allow only `https://youtrader.app` origins (see `_shared/cors.ts`)

## Verification checklist

- [ ] Legal URLs in app open over HTTPS
- [ ] Supabase auth still works (unaffected by Cloudflare)
- [ ] No wildcard `*` CORS on production APIs
- [ ] Cache rules do not cache authenticated responses
- [ ] Resend SPF/DKIM TXT records present if sending email from your domain

## Manual steps still required from you

1. Connect registrar nameservers to Cloudflare
2. Point web hosting (Vercel) to Cloudflare-proxied CNAME
3. Add Resend domain verification DNS records when enabling transactional email
