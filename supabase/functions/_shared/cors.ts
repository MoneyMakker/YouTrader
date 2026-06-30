const DEFAULT_ALLOWED_ORIGINS = ["https://youtrader.app", "https://www.youtrader.app"];

function configuredAllowedOrigins() {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  const configured = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

export function corsHeadersFor(req?: Request) {
  const allowedOrigins = configuredAllowedOrigins();
  const origin = req?.headers.get("Origin") || "";
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export const corsHeaders = corsHeadersFor();

export function jsonResponse(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersFor(req),
      "Content-Type": "application/json",
    },
  });
}
