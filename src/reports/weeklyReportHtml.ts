import { EXPORT_BRAND, EXPORT_COLORS } from "../components/insights/exportDesign";

type ReportStats = Record<string, unknown>;

const GREEN = "#147A2E";
const RED = "#C5223F";
const PURPLE = EXPORT_COLORS.purple;
const INK = "#101217";
const SUB = "#4C5564";
const LINE = "#DDE2EA";
const PAPER = "#FFFFFF";
const SOFT = "#F5F7FA";

export function buildWeeklyReportHtml(stats: ReportStats, logoDataUri = "") {
  const title = textValue(stats.title, "YouTrader Monthly Report");
  const rangeLabel = textValue(stats.rangeLabel, "");
  const equityCurve = numberArray(stats.equityCurve);
  const highlights = stringArray(stats.achievementsEarned).slice(0, 6);
  const aiSummary = textValue(stats.aiSummary, "AI Summary will appear after you generate trade analysis for this month.");
  const chart = buildEquityChart(equityCurve);
  const netPnl = numberValue(stats.netPnl);
  const watermarked = Boolean(stats.watermarked);
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
    body { margin: 0; background: ${PAPER}; color: ${INK}; font-family: -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", "Segoe UI", sans-serif; }
    .page { min-height: 297mm; padding: 30px 34px 24px; background: ${PAPER}; }
    .top { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${INK}; padding-bottom: 16px; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .logo { width: 52px; height: 52px; object-fit: contain; }
    .fallback-logo { width: 52px; height: 52px; border-radius: 15px; background: ${INK}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; }
    .brand-name { font-size: 30px; font-weight: 900; letter-spacing: 0; color: ${INK}; }
    .brand-sub { color: ${SUB}; font-size: 10px; font-weight: 900; letter-spacing: 3px; margin-top: 3px; }
    .range { color: ${INK}; text-align: right; font-size: 13px; font-weight: 900; max-width: 240px; }
    h1 { font-size: 34px; line-height: 1.08; margin: 24px 0 8px; letter-spacing: 0; color: ${INK}; }
    .lead { color: ${SUB}; font-size: 14px; line-height: 1.45; max-width: 720px; font-weight: 700; }
    .hero { display: grid; grid-template-columns: 1.12fr .88fr; gap: 14px; margin-top: 20px; }
    .panel { background: ${SOFT}; border: 1px solid ${LINE}; border-radius: 16px; padding: 17px; break-inside: avoid; }
    .panel.dark { background: ${INK}; color: white; border-color: ${INK}; }
    .label { color: ${SUB}; font-size: 10px; font-weight: 900; letter-spacing: 1.8px; text-transform: uppercase; }
    .dark .label { color: #C9D0DA; }
    .pnl { color: ${netPnl >= 0 ? GREEN : RED}; font-size: 54px; line-height: 1; font-weight: 900; margin-top: 10px; }
    .score { color: ${PURPLE}; font-size: 54px; line-height: 1; font-weight: 900; margin-top: 10px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
    .metric { background: ${PAPER}; border: 1px solid ${LINE}; border-radius: 12px; padding: 11px; min-height: 72px; break-inside: avoid; }
    .metric.loss .value { color: ${RED}; }
    .metric.good .value { color: ${GREEN}; }
    .value { color: ${INK}; font-size: 21px; line-height: 1.12; font-weight: 900; margin-top: 7px; }
    .chart { margin-top: 14px; background: ${PAPER}; }
    svg { width: 100%; height: 148px; display: block; }
    .section { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .copy { color: ${INK}; font-size: 13px; line-height: 1.48; margin-top: 10px; font-weight: 700; }
    ul { padding: 0; list-style: none; margin: 10px 0 0; }
    li { color: ${INK}; margin: 7px 0; padding-left: 16px; position: relative; font-weight: 800; font-size: 13px; line-height: 1.32; }
    li:before { content: ""; position: absolute; left: 0; top: 7px; width: 7px; height: 7px; border-radius: 50%; background: ${PURPLE}; }
    .footer { margin-top: 16px; padding-top: 13px; border-top: 1px solid ${LINE}; color: ${SUB}; font-size: 11px; display: flex; align-items: center; justify-content: space-between; gap: 14px; font-weight: 800; }
    .footer-brand { display: flex; align-items: center; gap: 8px; color: ${INK}; font-weight: 900; }
    .footer-logo { width: 24px; height: 24px; object-fit: contain; }
    .cta { color: ${PURPLE}; font-weight: 900; }
    .watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(16,18,23,.075); font-size: 64px; font-weight: 900; transform: rotate(-28deg); pointer-events: none; letter-spacing: 2px; }
  </style>
</head>
<body>
  ${watermarked ? '<div class="watermark">FREE PREVIEW</div>' : ''}
  <div class="page">
    <div class="top">
      <div class="brand">
        ${logoHtml}
        <div><div class="brand-name">${EXPORT_BRAND.name}</div><div class="brand-sub">${EXPORT_BRAND.tagline}</div></div>
      </div>
      <div class="range">${escapeHtml(rangeLabel)}</div>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <div class="lead">Institutional monthly performance review built from journal data, risk metrics, execution quality, and YouTrader AI context.</div>

    <div class="hero">
      <div class="panel dark">
        <div class="label">Net P&L</div>
        <div class="pnl">${money(netPnl)}</div>
        <div class="grid">
          ${metric("Win Rate", percent(stats.winRate), "good")}
          ${metric("Profit Factor", fixed(stats.profitFactor, 2), "")}
          ${metric("Drawdown", money(numberValue(stats.drawdown)), "loss")}
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
      ${metric("Consistency", percent(stats.consistency), "")}
      ${metric("Risk Control", percent(stats.riskControl), "")}
      ${metric("Recovery Factor", fixed(stats.recoveryFactor, 2), "")}
      ${metric("Expectancy", money(numberValue(stats.expectancy)), numberValue(stats.expectancy) >= 0 ? "good" : "loss")}
      ${metric("Best Session", textValue(stats.bestSession, "-"), "")}
      ${metric("Worst Session", textValue(stats.worstSession, "-"), "")}
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

    <div class="footer">
      <span class="footer-brand">${logoDataUri ? `<img class="footer-logo" src="${logoDataUri}"/>` : ""}YouTrader professional performance report</span>
      <span class="cta">${EXPORT_BRAND.appStoreHint}</span>
      <span>${EXPORT_BRAND.disclaimer}</span>
    </div>
  </div>
</body>
</html>`;
}

function metric(label: string, value: string, tone = "") {
  return `<div class="metric ${tone}"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`;
}

function buildEquityChart(values: number[]) {
  const series = values.length ? values : [0, 0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const spread = Math.max(1, max - min);
  const points = series
    .map((value, index) => {
      const x = series.length === 1 ? 0 : (index / (series.length - 1)) * 700;
      const y = 140 - ((value - min) / spread) * 118;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return `<svg viewBox="0 0 700 165" preserveAspectRatio="none">
    <defs><linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GREEN}" stop-opacity=".20"/><stop offset="1" stop-color="${GREEN}" stop-opacity="0"/></linearGradient></defs>
    <line x1="0" y1="140" x2="700" y2="140" stroke="${LINE}" stroke-width="2"/>
    <polyline points="${points} 700,152 0,152" fill="url(#curveFill)" stroke="none"/>
    <polyline points="${points}" fill="none" stroke="${GREEN}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
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
