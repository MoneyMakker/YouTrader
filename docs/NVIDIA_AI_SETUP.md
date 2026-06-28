# NVIDIA AI Setup

YouTrader uses NVIDIA NIM through Supabase Edge Functions. The mobile app must never call NVIDIA directly and must never contain `NVIDIA_API_KEY`.

## 1. Create NVIDIA API key

1. Go to https://build.nvidia.com.
2. Create or sign in to your NVIDIA account.
3. Choose an OpenAI-compatible NIM chat model.
4. Generate an API key.
5. Keep the key private. Do not paste it into React Native code, `.env` public variables, screenshots, or chats.

## 2. Add Supabase secrets

Run from the project root after logging in to Supabase CLI. Paste the real key only into the interactive prompt or a trusted local shell, never into docs or AI chat:

```bash
supabase secrets set NVIDIA_API_KEY
supabase secrets set NVIDIA_MODEL="meta/llama-3.1-70b-instruct"
```

Optional OpenAI fallback may be added later only as a server-side secret. It is not required for the NVIDIA path.

## 3. Apply AI usage table

Apply `supabase/ai-coach-schema.sql` in Supabase SQL editor or with your preferred Supabase CLI workflow. This creates `public.ai_usage_events` for per-user quota tracking.

## 4. Deploy Edge Function

```bash
supabase functions deploy ai-coach
```

## 5. Important production notes

- NVIDIA Build/NIM free API access can have rate limits and may be intended for development/prototyping.
- Do not promise unlimited free production AI.
- Production usage may require paid NVIDIA deployment, account approval, or a separate license.
- If NVIDIA returns `401`, `403`, `429`, times out, or is unavailable, YouTrader falls back to safe local coaching.
- The app sends summarized journal/stat/news data only. It does not send screenshots or voice notes.

## 6. TestFlight checklist

- Pro user can generate AI Daily Plan.
- Pro user can generate Risk Predictor.
- Pro user can generate Weekly Coach.
- Pro user can generate Journal Summary.
- Pro user can explain a news item with AI.
- Pro user can generate Daily Challenge.
- Free user sees premium preview and lock overlay, not a black screen.
- NVIDIA `401` logs setup issue server-side and shows a friendly fallback in app.
- NVIDIA `429` shows a rate-limit friendly fallback.
- App works if NVIDIA is unavailable.
- No `NVIDIA_API_KEY` exists in `App.tsx`, `src/`, Expo public env vars, or the mobile bundle.
- RevenueCat purchase/restore and Supabase auth still work.
