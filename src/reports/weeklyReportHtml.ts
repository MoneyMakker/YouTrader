import { EXPORT_BRAND, EXPORT_COLORS } from "../components/insights/exportDesign";

type ReportStats = Record<string, unknown>;

const GREEN = EXPORT_COLORS.green;
const PURPLE = EXPORT_COLORS.purple;
const BG = EXPORT_COLORS.bg;
const CARD = EXPORT_COLORS.panel;
const TEXT = EXPORT_COLORS.text;
const SUB = EXPORT_COLORS.sub;
const RED = EXPORT_COLORS.red;

export function buildWeeklyReportHtml(stats: ReportStats, logoDataUri = "") {
  const title = textValue(stats.title, "YouTrader Monthly Report");
  const rangeLabel = textValue(stats.rangeLabel, "");
  const equityCurve = numberArray(stats.equityCurve);
  const highlights = stringArray(stats.achievementsEarned).slice(0, 6);
  const aiSummary = textValue(stats.aiSummary, "AI Summary will appear after you generate trade analysis for this month.");
  const chart = buildEquityChart(equityCurve);
  const netPnl = numberValue(stats.netPnl);
  const pnlTone = netPnl >= 0 ? GREEN : RED;
  const logoHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}"/>`
    : `<div class="fallback-logo">YT</div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: ${BG}; color: ${TEXT}; font-family: -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", "Segoe UI", sans-serif; }
    .page { min-height: 297mm; padding: 34px; background: radial-gradient(circle at 90% 0%, rgba(176,38,255,.20), transparent 32%), linear-gradient(180deg, #05070A 0%, #030507 100%); }
    .top { display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.035); border-radius: 18px; padding: 18px 20px; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .logo { width: 48px; height: 48px; object-fit: contain; }
    .fallback-logo { width: 48px; height: 48px; border-radius: 14px; background: ${PURPLE}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; }
    .brand-name { font-size: 28px; font-weight: 900; letter-spacing: 0; }
    .brand-sub { color: ${SUB}; font-size: 9px; font-weight: 900; letter-spacing: 3px; margin-top: 3px; }
    .range { color: ${SUB}; text-align: right; font-size: 13px; font-weight: 800; max-width: 220px; }
    h1 { font-size: 38px; margin: 28px 0 8px; letter-spacing: 0; }
    .lead { color: ${SUB}; font-size: 14px; line-height: 1.48; max-width: 710px; font-weight: 700; }
    .hero { display: grid; grid-template-columns: 1.15fr .85fr; gap: 14px; margin-top: 20px; }
    .panel { background: ${CARD}; border: 1px solid rgba(255,255,255,.13); border-radius: 16px; padding: 18px; box-shadow: 0 18px 42px rgba(0,0,0,.22); }
    .label { color: ${SUB}; font-size: 9px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
    .pnl { color: ${pnlTone}; font-size: 54px; line-height: 1; font-weight: 900; margin-top: 11px; }
    .score { color: ${PURPLE}; font-size: 52px; line-height: 1; font-weight: 900; margin-top: 11px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
    .metric { background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.11); border-radius: 12px; padding: 12px; min-height: 74px; }
    .value { color: ${TEXT}; font-size: 21px; line-height: 1.15; font-weight: 900; margin-top: 7px; }
    .chart { margin-top: 16px; }
    svg { width: 100%; height: 158px; display: block; }
    .section { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .copy { color: ${TEXT}; font-size: 13px; line-height: 1.5; margin-top: 10px; font-weight: 750; }
    ul { padding: 0; list-style: none; margin: 10px 0 0; }
    li { color: ${TEXT}; margin: 7px 0; padding-left: 16px; position: relative; font-weight: 800; font-size: 13px; line-height: 1.35; }
    li:before { content: ""; position: absolute; left: 0; top: 7px; width: 7px; height: 7px; border-radius: 50%; background: ${PURPLE}; }
    .footer { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.12); color: ${SUB}; font-size: 11px; display: flex; justify-content: space-between; font-weight: 800; }
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div class="brand">
        ${logoHtml}
        <div><div class="brand-name">${EXPORT_BRAND.name}</div><div class="brand-sub">${EXPORT_BRAND.tagline}</div></div>
      </div>
      <div class="range">${escapeHtml(rangeLabel)}</div>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <div class="lead">Premium monthly performance review built from journal data, risk metrics, execution quality, and YouTrader AI context.</div>

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
        <div class="score">${escapeHtml(textValue(stats.tradingScore, "-"))}</div>
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
      ${metric("Best Session", textValue(stats.bestSession, "-"))}
      ${metric("Worst Session", textValue(stats.worstSession, "-"))}
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
        <div class="copy">Best: ${escapeHtml(textValue(stats.bestDay, "-"))}<br/>Worst: ${escapeHtml(textValue(stats.worstDay, "-"))}</div>
      </div>
      <div class="panel">
        <div class="label">Next Focus</div>
        <div class="copy">${escapeHtml(textValue(stats.nextFocus, "Protect risk, reduce weak sessions, and journal every execution detail."))}</div>
      </div>
    </div>

    <div class="footer"><span>YouTrader professional performance report</span><span>${EXPORT_BRAND.disclaimer}</span></div>
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
