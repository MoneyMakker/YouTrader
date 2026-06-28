type ReportStats = Record<string, unknown>;

const GREEN = "#9CFF00";
const PURPLE = "#B026FF";
const BG = "#030507";
const CARD = "#0A0F14";
const TEXT = "#F4F4F5";
const SUB = "#9CA3AF";

export function buildWeeklyReportHtml(stats: ReportStats) {
  const title = textValue(stats.title, "YouTrader Monthly Report");
  const rangeLabel = textValue(stats.rangeLabel, "");
  const equityCurve = numberArray(stats.equityCurve);
  const highlights = stringArray(stats.achievementsEarned).slice(0, 5);
  const aiSummary = textValue(stats.aiSummary, "AI Summary will appear after you generate trade analysis for this month.");
  const chart = buildEquityChart(equityCurve);
  const netPnl = numberValue(stats.netPnl);
  const pnlTone = netPnl >= 0 ? GREEN : "#FF3B5F";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: ${BG};
      color: ${TEXT};
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", "Segoe UI", sans-serif;
    }
    .page { padding: 42px; min-height: 100vh; background: radial-gradient(circle at 82% 0%, rgba(176,38,255,.16), transparent 34%), ${BG}; }
    .top { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.12); padding-bottom: 24px; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .mark { display: flex; align-items: flex-end; gap: 5px; height: 38px; }
    .bar { width: 9px; border-radius: 8px; background: ${GREEN}; }
    .bar.purple { height: 34px; background: ${PURPLE}; }
    .bar.one { height: 26px; }
    .bar.three { height: 30px; }
    .brand-name { font-size: 28px; font-weight: 900; letter-spacing: 0; }
    .brand-sub { color: ${SUB}; font-size: 9px; font-weight: 900; letter-spacing: 3px; margin-top: 3px; }
    .range { color: ${SUB}; text-align: right; font-size: 13px; font-weight: 800; }
    h1 { font-size: 38px; margin: 34px 0 10px; letter-spacing: 0; }
    .lead { color: ${SUB}; font-size: 15px; line-height: 1.55; max-width: 690px; }
    .hero { display: grid; grid-template-columns: 1.15fr .85fr; gap: 18px; margin-top: 28px; }
    .panel { background: ${CARD}; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; padding: 22px; }
    .label { color: ${SUB}; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
    .pnl { color: ${pnlTone}; font-size: 58px; line-height: 1; font-weight: 900; margin-top: 12px; }
    .score { color: ${GREEN}; font-size: 54px; line-height: 1; font-weight: 900; margin-top: 12px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; }
    .metric { background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 15px; min-height: 86px; }
    .value { font-size: 24px; font-weight: 900; margin-top: 8px; }
    .chart { margin-top: 28px; }
    svg { width: 100%; height: 190px; display: block; }
    .section { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .copy { color: ${TEXT}; font-size: 14px; line-height: 1.62; margin-top: 12px; }
    ul { padding: 0; list-style: none; margin: 14px 0 0; }
    li { color: ${TEXT}; margin: 9px 0; padding-left: 18px; position: relative; font-weight: 750; }
    li:before { content: ""; position: absolute; left: 0; top: 8px; width: 7px; height: 7px; border-radius: 50%; background: ${GREEN}; }
    .footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,.12); color: ${SUB}; font-size: 11px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div class="brand">
        <div class="mark"><div class="bar one"></div><div class="bar purple"></div><div class="bar three"></div></div>
        <div><div class="brand-name">YouTrader</div><div class="brand-sub">TRADE. ANALYZE. IMPROVE.</div></div>
      </div>
      <div class="range">${escapeHtml(rangeLabel)}</div>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <div class="lead">Institutional monthly performance review built from real journal data, risk metrics, execution quality, and YouTrader AI context.</div>

    <div class="hero">
      <div class="panel">
        <div class="label">Net P&L</div>
        <div class="pnl">${money(netPnl)}</div>
        <div class="grid">
          ${metric("Win Rate", percent(stats.winRate))}
          ${metric("Profit Factor", fixed(stats.profitFactor, 2))}
          ${metric("Drawdown", money(numberValue(stats.drawdown)))}
        </div>
      </div>
      <div class="panel">
        <div class="label">Trading Score</div>
        <div class="score">${escapeHtml(textValue(stats.tradingScore, "—"))}</div>
        <div class="copy">${escapeHtml(textValue(stats.grade, "Monthly grade"))}</div>
      </div>
    </div>

    <div class="panel chart">
      <div class="label">Equity Curve</div>
      ${chart}
    </div>

    <div class="grid">
      ${metric("Consistency", percent(stats.consistency))}
      ${metric("Risk Control", percent(stats.riskControl))}
      ${metric("Recovery Factor", fixed(stats.recoveryFactor, 2))}
      ${metric("Expectancy", money(numberValue(stats.expectancy)))}
      ${metric("Best Session", textValue(stats.bestSession, "—"))}
      ${metric("Worst Session", textValue(stats.worstSession, "—"))}
    </div>

    <div class="section">
      <div class="panel">
        <div class="label">AI Summary</div>
        <div class="copy">${escapeHtml(aiSummary)}</div>
      </div>
      <div class="panel">
        <div class="label">Monthly Highlights</div>
        <ul>${(highlights.length ? highlights : ["No achievements earned yet"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </div>

    <div class="section">
      <div class="panel">
        <div class="label">Best / Worst Day</div>
        <div class="copy">Best: ${escapeHtml(textValue(stats.bestDay, "—"))}<br/>Worst: ${escapeHtml(textValue(stats.worstDay, "—"))}</div>
      </div>
      <div class="panel">
        <div class="label">Next Focus</div>
        <div class="copy">${escapeHtml(textValue(stats.nextFocus, "Protect risk, reduce weak sessions, and journal every execution detail."))}</div>
      </div>
    </div>

    <div class="footer"><span>YouTrader professional performance report</span><span>Educational journal. Not financial advice.</span></div>
  </div>
</body>
</html>`;
}

function metric(label: string, value: string) {
  return `<div class="metric"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`;
}

function buildEquityChart(values: number[]) {
  const series = values.length ? values : [0, 0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const spread = Math.max(1, max - min);
  const points = series
    .map((value, index) => {
      const x = series.length === 1 ? 0 : (index / (series.length - 1)) * 700;
      const y = 150 - ((value - min) / spread) * 130;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return `<svg viewBox="0 0 700 180" preserveAspectRatio="none">
    <defs><linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GREEN}" stop-opacity=".22"/><stop offset="1" stop-color="${GREEN}" stop-opacity="0"/></linearGradient></defs>
    <polyline points="${points} 700,170 0,170" fill="url(#curveFill)" stroke="none"/>
    <polyline points="${points}" fill="none" stroke="${GREEN}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function textValue(value: unknown, fallback = "") {
  if (typeof value === "number") return String(Math.round(value));
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numberArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => Number(item)).filter(Number.isFinite) : [];
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function fixed(value: unknown, digits: number) {
  const n = numberValue(value);
  return n ? n.toFixed(digits) : "—";
}

function percent(value: unknown) {
  const n = numberValue(value);
  return Number.isFinite(n) ? `${Math.round(n)}%` : "—";
}

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] || char));
}
