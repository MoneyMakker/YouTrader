import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { corsHeadersFor, jsonResponse } from "../_shared/cors.ts";
import {
  inactivityReminderEmailHtml,
  isResendConfigured,
  monthlyReportEmailHtml,
  sendResendEmail,
  welcomeEmailHtml,
  weeklyReportEmailHtml,
} from "../_shared/resendEmail.ts";

type EmailType = "welcome" | "weekly_report" | "monthly_report" | "inactivity_reminder";

type EmailPreferences = {
  email_welcome_sent?: boolean;
  weekly_report_enabled?: boolean;
  monthly_report_enabled?: boolean;
  inactivity_reminders_enabled?: boolean;
  last_journal_reminder_sent_at?: string;
};

function getEnv(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function readPrefs(raw: unknown): EmailPreferences {
  if (!raw || typeof raw !== "object") return {};
  return raw as EmailPreferences;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

  if (!isResendConfigured()) {
    return jsonResponse({ error: "Email service is not configured." }, 503, req);
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server configuration missing." }, 500, req);
  }

  const cronSecret = getEnv("TRANSACTIONAL_EMAIL_CRON_SECRET");
  const authHeader = req.headers.get("Authorization") || "";
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!isCron) {
    return jsonResponse({ error: "Unauthorized." }, 401, req);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  let body: { type?: EmailType; userId?: string; email?: string; stats?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON." }, 400, req);
  }

  const type = body.type;
  if (!type) return jsonResponse({ error: "Missing type." }, 400, req);

  if (type === "welcome") {
    const userId = body.userId?.trim();
    const email = body.email?.trim();
    if (!userId || !email) return jsonResponse({ error: "Missing userId or email." }, 400, req);

    const { data: state } = await supabaseAdmin
      .from("user_app_state")
      .select("preferences")
      .eq("user_id", userId)
      .maybeSingle();
    const prefs = readPrefs(state?.preferences);
    if (prefs.email_welcome_sent) {
      return jsonResponse({ skipped: true, reason: "already_sent" });
    }

    const sent = await sendResendEmail({
      to: email,
      subject: "Welcome to YouTrader",
      html: welcomeEmailHtml(),
      tags: [{ name: "type", value: "welcome" }],
    });
    if (!sent) return jsonResponse({ error: "Send failed." }, 502, req);

    await supabaseAdmin.from("user_app_state").upsert({
      user_id: userId,
      preferences: { ...prefs, email_welcome_sent: true },
      updated_at: new Date().toISOString(),
    });

    return jsonResponse({ ok: true, id: sent.id });
  }

  const email = body.email?.trim();
  if (!email) return jsonResponse({ error: "Missing email." }, 400, req);
  const stats = body.stats || {};

  if (type === "weekly_report") {
    const sent = await sendResendEmail({
      to: email,
      subject: "Your YouTrader weekly report",
      html: weeklyReportEmailHtml({
        totalTrades: Number(stats.totalTrades || 0),
        winRate: String(stats.winRate || "—"),
        pnl: String(stats.pnl || "—"),
        bestDay: stats.bestDay ? String(stats.bestDay) : undefined,
        worstDay: stats.worstDay ? String(stats.worstDay) : undefined,
        insight: stats.insight ? String(stats.insight) : undefined,
      }),
      tags: [{ name: "type", value: "weekly_report" }],
    });
    return sent ? jsonResponse({ ok: true, id: sent.id }) : jsonResponse({ error: "Send failed." }, 502, req);
  }

  if (type === "monthly_report") {
    const sent = await sendResendEmail({
      to: email,
      subject: "Your YouTrader monthly report",
      html: monthlyReportEmailHtml({
        totalTrades: Number(stats.totalTrades || 0),
        winRate: String(stats.winRate || "—"),
        pnl: String(stats.pnl || "—"),
      }),
      tags: [{ name: "type", value: "monthly_report" }],
    });
    return sent ? jsonResponse({ ok: true, id: sent.id }) : jsonResponse({ error: "Send failed." }, 502, req);
  }

  if (type === "inactivity_reminder") {
    const days = Number(stats.days || 5);
    const sent = await sendResendEmail({
      to: email,
      subject: "You haven't journaled in a while",
      html: inactivityReminderEmailHtml(days),
      tags: [{ name: "type", value: "inactivity_reminder" }],
    });
    return sent ? jsonResponse({ ok: true, id: sent.id }) : jsonResponse({ error: "Send failed." }, 502, req);
  }

  return jsonResponse({ error: "Unsupported type." }, 400, req);
});
