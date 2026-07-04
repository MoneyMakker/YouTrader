const RESEND_API = "https://api.resend.com/emails";

export type ResendEmailInput = {
  to: string;
  subject: string;
  html: string;
  tags?: { name: string; value: string }[];
};

function getResendConfig() {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() || "";
  const from = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "";
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export function isResendConfigured() {
  return !!getResendConfig();
}

export async function sendResendEmail(input: ResendEmailInput): Promise<{ id: string } | null> {
  const config = getResendConfig();
  if (!config) {
    console.warn("[YouTrader:resend] not_configured");
    return null;
  }
  try {
    const response = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        tags: input.tags,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.warn("[YouTrader:resend] send_failed", { status: response.status, body: body.slice(0, 200) });
      return null;
    }
    const payload = await response.json();
    return { id: String(payload.id || "") };
  } catch (error) {
    console.warn("[YouTrader:resend] request_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function emailShell(title: string, bodyHtml: string, footerNote?: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;background:#0A0C10;color:#E5E7EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0C10;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#141820;border:1px solid #1E2430;border-radius:16px;padding:28px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;color:#A3FF12;font-weight:700;">YOUTRADER</p>
          <h1 style="margin:0 0 16px;font-size:22px;color:#FFFFFF;">${title}</h1>
          <div style="font-size:15px;line-height:1.6;color:#D1D5DB;">${bodyHtml}</div>
          ${footerNote ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#6B7280;">${footerNote}</p>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function welcomeEmailHtml(displayName?: string) {
  const name = displayName?.trim() || "Trader";
  return emailShell(
    "Welcome to YouTrader",
    `<p>Hi ${name},</p>
     <p>Your AI trading journal is ready. Log your first trade while the session is still fresh — patterns emerge when you journal consistently.</p>
     <p style="color:#A3FF12;font-weight:600;">Journal first. Analyze second.</p>`,
    "You received this because you created a YouTrader account. Manage email preferences in app Settings.",
  );
}

export function weeklyReportEmailHtml(stats: {
  totalTrades: number;
  winRate: string;
  pnl: string;
  bestDay?: string;
  worstDay?: string;
  insight?: string;
}) {
  return emailShell(
    "Your weekly trading report",
    `<p><strong>Trades:</strong> ${stats.totalTrades}</p>
     <p><strong>Win rate:</strong> ${stats.winRate}</p>
     <p><strong>P&amp;L:</strong> ${stats.pnl}</p>
     ${stats.bestDay ? `<p><strong>Best day:</strong> ${stats.bestDay}</p>` : ""}
     ${stats.worstDay ? `<p><strong>Toughest day:</strong> ${stats.worstDay}</p>` : ""}
     ${stats.insight ? `<p style="margin-top:16px;padding:12px;border-left:3px solid #B026FF;color:#E5E7EB;">${stats.insight}</p>` : ""}`,
    "Weekly reports are journaling summaries, not trading signals. Disable in Settings → Notifications.",
  );
}

export function monthlyReportEmailHtml(stats: { totalTrades: number; winRate: string; pnl: string }) {
  return emailShell(
    "Your monthly trading report",
    `<p><strong>Trades logged:</strong> ${stats.totalTrades}</p>
     <p><strong>Win rate:</strong> ${stats.winRate}</p>
     <p><strong>Monthly P&amp;L:</strong> ${stats.pnl}</p>
     <p>Review your biggest patterns before the next month starts.</p>`,
    "Monthly reports are optional. Manage preferences in YouTrader Settings.",
  );
}

export function inactivityReminderEmailHtml(days: number) {
  return emailShell(
    "Journal check-in",
    `<p>You have not logged a trade in ${days} days.</p>
     <p>Even a quick note after your next session keeps your edge analysis accurate.</p>`,
    "Inactivity reminders help you stay consistent. Turn off in Settings if you prefer.",
  );
}
