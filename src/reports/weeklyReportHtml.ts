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
const MUTED = "#6F7887";

export function buildWeeklyReportHtml(stats: ReportStats, logoDataUri = "") {
  const title = textValue(stats.title, "Monthly Performance Report");
  const rangeLabel = textValue(stats.rangeLabel, "");
  const tradeCount = numberValue(stats.trades);
  const equityCurve = numberArray(stats.equityCurve);
  const netPnl = numberValue(stats.netPnl);
  const performanceSummary = buildPerformanceSummary(stats);
  const nextFocus = buildNextFocus(stats);
  const logoHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="YouTrader"/>`
    : `<div class="text-logo">YouTrader</div>`;

  const kpiRows = [
    [
      kpi("Total Trades", tradeCount ? String(tradeCount) : "N/A"),
      kpi("Win Rate", tradeCount ? percent(stats.winRate) : "N/A"),
      kpi("Wins / Losses", tradeCount ? `${numberValue(stats.wins)} / ${numberValue(stats.losses)}` : "N/A"),
      kpi("Profit Factor", tradeCount ? fixedOrNA(stats.profitFactor) : "N/A"),
    ],
    [
      kpi("Expectancy", tradeCount ? money(numberValue(stats.expectancy)) : "N/A", toneForSigned(numberValue(stats.expectancy))),
      kpi("Max Drawdown", tradeCount ? money(numberValue(stats.drawdown)) : "N/A", "loss"),
      kpi("Best Day", textValue(stats.bestDay, "N/A")),
      kpi("Worst Day", textValue(stats.worstDay, "N/A"), "loss"),
    ],
    [
      kpi("Average Win", tradeCount ? money(numberValue(stats.avgWin)) : "N/A", "good"),
      kpi("Average Loss", tradeCount ? money(-Math.abs(numberValue(stats.avgLoss))) : "N/A", "loss"),
      kpi("Average R/R", tradeCount ? fixedOrNA(stats.avgWinLoss) : "N/A"),
      kpi("Trading Score", tradeCount ? textValue(stats.tradingScore, "N/A") : "N/A", "accent"),
    ],
    [
      kpi("Risk Control", tradeCount ? percent(stats.riskControl) : "N/A"),
      kpi("Consistency", tradeCount ? percent(stats.consistency) : "N/A"),
      kpi("Recovery Factor", tradeCount ? fixedOrNA(stats.recoveryFactor) : "N/A"),
      kpi("Grade", tradeCount ? textValue(stats.grade, "N/A") : "N/A", "accent"),
    ],
    [
      kpi("Best Session", textValue(stats.bestSession, "N/A"), "good"),
      kpi("Worst Session", textValue(stats.worstSession, "N/A"), "loss"),
    ],
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: ${PAPER}; color: ${INK}; font-family: -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", "Segoe UI", sans-serif; }
    .page { width: 100%; max-width: 186mm; margin: 0 auto; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding-bottom: 16px; border-bottom: 2px solid ${INK}; }
    .brand-block { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .logo { width: 48px; height: 48px; object-fit: contain; flex-shrink: 0; }
    .text-logo { font-size: 26px; font-weight: 900; color: ${PURPLE}; letter-spacing: -0.4px; line-height: 1; }
    .brand-copy { min-width: 0; }
    .brand-name { font-size: 22px; font-weight: 900; color: ${INK}; line-height: 1.1; }
    .brand-tagline { margin-top: 4px; color: ${SUB}; font-size: 10px; font-weight: 800; letter-spacing: 2.4px; text-transform: uppercase; }
    .period-block { text-align: right; flex-shrink: 0; max-width: 42%; }
    .period-label { color: ${MUTED}; font-size: 9px; font-weight: 800; letter-spacing: 1.6px; text-transform: uppercase; }
    .period-value { margin-top: 4px; color: ${INK}; font-size: 12px; font-weight: 800; line-height: 1.35; }
    .report-title { margin: 18px 0 0; font-size: 28px; font-weight: 900; letter-spacing: -0.3px; color: ${INK}; line-height: 1.1; }
    .hero { margin-top: 18px; padding: 22px 22px 18px; border-radius: 18px; border: 1px solid ${LINE}; background: linear-gradient(180deg, ${SOFT} 0%, ${PAPER} 100%); break-inside: avoid; }
    .hero-label { color: ${SUB}; font-size: 10px; font-weight: 900; letter-spacing: 1.8px; text-transform: uppercase; }
    .hero-value { margin-top: 8px; font-size: 52px; line-height: 1; font-weight: 900; color: ${netPnl >= 0 ? GREEN : RED}; }
    .hero-sub { margin-top: 8px; color: ${MUTED}; font-size: 12px; font-weight: 700; line-height: 1.4; }
    .section-title { margin: 18px 0 10px; color: ${INK}; font-size: 11px; font-weight: 900; letter-spacing: 1.6px; text-transform: uppercase; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; break-inside: avoid; }
    .kpi-grid.compact { grid-template-columns: repeat(2, 1fr); margin-top: 8px; }
    .kpi { background: ${PAPER}; border: 1px solid ${LINE}; border-radius: 12px; padding: 10px 11px; min-height: 68px; break-inside: avoid; }
    .kpi.good .kpi-value { color: ${GREEN}; }
    .kpi.loss .kpi-value { color: ${RED}; }
    .kpi.accent .kpi-value { color: ${PURPLE}; }
    .kpi-label { color: ${SUB}; font-size: 9px; font-weight: 900; letter-spacing: 1.2px; text-transform: uppercase; line-height: 1.25; }
    .kpi-value { margin-top: 6px; color: ${INK}; font-size: 17px; line-height: 1.15; font-weight: 900; word-break: break-word; }
    .chart-panel { margin-top: 6px; padding: 14px 14px 10px; border: 1px solid ${LINE}; border-radius: 16px; background: ${PAPER}; break-inside: avoid; }
    .chart-panel svg { width: 100%; height: 132px; display: block; overflow: visible; }
    .insights { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 10px; margin-top: 16px; break-inside: avoid; page-break-inside: avoid; }
    .insight-card { border: 1px solid ${LINE}; border-radius: 16px; background: ${SOFT}; padding: 14px 15px; min-height: 118px; }
    .insight-card.focus { border-color: rgba(176,38,255,0.28); background: rgba(176,38,255,0.05); }
    .insight-title { color: ${INK}; font-size: 10px; font-weight: 900; letter-spacing: 1.4px; text-transform: uppercase; }
    .insight-body { margin-top: 10px; color: ${INK}; font-size: 12px; line-height: 1.55; font-weight: 650; }
    .footer { margin-top: 18px; padding-top: 12px; border-top: 1px solid ${LINE}; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; break-inside: avoid; }
    .footer-left { flex: 1; min-width: 0; }
    .footer-brand { color: ${INK}; font-size: 11px; font-weight: 900; }
    .footer-disclaimer { margin-top: 4px; color: ${MUTED}; font-size: 10px; font-weight: 700; line-height: 1.4; }
    .footer-cta { color: ${PURPLE}; font-size: 10px; font-weight: 900; text-align: right; white-space: nowrap; }
    .page-break { page-break-before: always; break-before: page; }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="brand-block">
        ${logoHtml}
        <div class="brand-copy">
          <div class="brand-name">${EXPORT_BRAND.name}</div>
          <div class="brand-tagline">${EXPORT_BRAND.tagline}</div>
        </div>
      </div>
      <div class="period-block">
        <div class="period-label">Reporting Period</div>
        <div class="period-value">${escapeHtml(rangeLabel || "Current month")}</div>
      </div>
    </header>

    <h1 class="report-title">${escapeHtml(title)}</h1>

    <section class="hero">
      <div class="hero-label">Net P&amp;L</div>
      <div class="hero-value">${tradeCount ? money(netPnl) : "N/A"}</div>
      <div class="hero-sub">${tradeCount ? `${tradeCount} logged trade${tradeCount === 1 ? "" : "s"} in this period` : "No trades logged during this reporting period"}</div>
    </section>

    <div class="section-title">Core Performance</div>
    <div class="kpi-grid">
      ${kpiRows[0].join("")}
    </div>
    <div class="kpi-grid" style="margin-top:8px;">
      ${kpiRows[1].join("")}
    </div>

    <div class="section-title">Equity Curve</div>
    <div class="chart-panel">
      ${buildEquityChart(equityCurve, tradeCount)}
    </div>

    <div class="section-title">Advanced Metrics</div>
    <div class="kpi-grid">
      ${kpiRows[2].join("")}
    </div>
    <div class="kpi-grid" style="margin-top:8px;">
      ${kpiRows[3].join("")}
    </div>
    <div class="kpi-grid compact">
      ${kpiRows[4].join("")}
    </div>

    <div class="insights">
      <div class="insight-card">
        <div class="insight-title">Performance Summary</div>
        <div class="insight-body">${escapeHtml(performanceSummary)}</div>
      </div>
      <div class="insight-card focus">
        <div class="insight-title">Next Focus</div>
        <div class="insight-body">${escapeHtml(nextFocus)}</div>
      </div>
    </div>

    <footer class="footer">
      <div class="footer-left">
        <div class="footer-brand">YouTrader professional trading journal</div>
        <div class="footer-disclaimer">${EXPORT_BRAND.disclaimer}</div>
      </div>
      <div class="footer-cta">${EXPORT_BRAND.appStoreHint}</div>
    </footer>
  </div>
</body>
</html>`;
}

function kpi(label: string, value: string, tone = "") {
  return `<div class="kpi ${tone}"><div class="kpi-label">${escapeHtml(label)}</div><div class="kpi-value">${escapeHtml(value)}</div></div>`;
}

function buildEquityChart(values: number[], tradeCount: number) {
  if (!tradeCount) {
    return `<svg viewBox="0 0 680 132" preserveAspectRatio="xMidYMid meet">
      <line x1="24" y1="98" x2="656" y2="98" stroke="${LINE}" stroke-width="1.5"/>
      <text x="340" y="58" text-anchor="middle" fill="${MUTED}" font-size="13" font-weight="700" font-family="-apple-system, sans-serif">Log trades to generate an equity curve</text>
    </svg>`;
  }

  const series = values.length ? values : [0];
  const normalized = series.length === 1 ? [series[0], series[0]] : series;
  const width = 680;
  const height = 132;
  const padX = 24;
  const padTop = 14;
  const padBottom = 22;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;
  const min = Math.min(0, ...normalized);
  const max = Math.max(0, ...normalized);
  const spread = Math.max(1, max - min);

  const coords = normalized.map((value, index) => {
    const x = padX + (index / (normalized.length - 1)) * chartW;
    const y = padTop + chartH - ((value - min) / spread) * chartH;
    return { x, y };
  });

  const linePoints = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const baselineY = padTop + chartH;
  const areaPoints = `${coords[0].x.toFixed(1)},${baselineY} ${linePoints} ${coords[coords.length - 1].x.toFixed(1)},${baselineY}`;
  const zeroY = padTop + chartH - ((0 - min) / spread) * chartH;
  const stroke = normalized[normalized.length - 1] >= 0 ? GREEN : RED;

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${stroke}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <line x1="${padX}" y1="${zeroY.toFixed(1)}" x2="${width - padX}" y2="${zeroY.toFixed(1)}" stroke="${LINE}" stroke-width="1.5" stroke-dasharray="4 4"/>
    <polygon points="${areaPoints}" fill="url(#equityFill)"/>
    <polyline points="${linePoints}" fill="none" stroke="${stroke}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function buildPerformanceSummary(stats: ReportStats): string {
  const trades = numberValue(stats.trades);
  if (!trades) {
    return "No trades were logged during this reporting period. Continue journaling to build a monthly performance record.";
  }

  const netPnl = numberValue(stats.netPnl);
  const winRate = numberValue(stats.winRate);
  const profitFactor = numberValue(stats.profitFactor);
  const expectancy = numberValue(stats.expectancy);
  const consistency = numberValue(stats.consistency);
  const drawdown = numberValue(stats.drawdown);
  const score = textValue(stats.tradingScore, "—");

  const resultPhrase =
    netPnl > 0 ? "finished the period positive" : netPnl < 0 ? "finished the period negative" : "closed the period flat";

  const qualityBits: string[] = [];
  if (profitFactor >= 1.4) qualityBits.push("profit factor remained supportive");
  else if (profitFactor > 0 && profitFactor < 1) qualityBits.push("losses outweighed wins on a gross basis");
  if (consistency >= 65) qualityBits.push("day-to-day consistency was stable");
  else if (consistency > 0 && consistency < 55) qualityBits.push("daily results were uneven");
  if (Math.abs(drawdown) > Math.max(150, Math.abs(netPnl) * 0.4)) qualityBits.push("drawdown pressure was meaningful");

  const qualityText = qualityBits.length ? ` ${qualityBits.slice(0, 2).join(", ")}.` : "";
  return `You logged ${trades} trade${trades === 1 ? "" : "s"} with a ${Math.round(winRate)}% win rate and ${resultPhrase} at ${money(netPnl)}.${qualityText} Expectancy registered ${money(expectancy)} with a Trading Score of ${score}.`;
}

function buildNextFocus(stats: ReportStats): string {
  const trades = numberValue(stats.trades);
  if (!trades) return "Start logging trades consistently to unlock meaningful monthly insights.";

  const drawdown = Math.abs(numberValue(stats.drawdown));
  const netPnl = numberValue(stats.netPnl);
  const avgWinLoss = numberValue(stats.avgWinLoss);
  const consistency = numberValue(stats.consistency);
  const winRate = numberValue(stats.winRate);
  const expectancy = numberValue(stats.expectancy);

  const options: Array<{ score: number; text: string }> = [];

  if (drawdown > Math.max(120, Math.abs(netPnl) * 0.35)) {
    options.push({ score: 90, text: "Reduce drawdown by tightening daily loss limits and pausing after consecutive losing trades." });
  }
  if (avgWinLoss > 0 && avgWinLoss < 1.25) {
    options.push({ score: 82, text: "Improve reward/risk by letting winners run while keeping average losses contained." });
  }
  if (consistency > 0 && consistency < 58) {
    options.push({ score: 78, text: "Improve consistency by standardizing session rules and avoiding oversized daily swings." });
  }
  if (winRate >= 52 && expectancy <= 0) {
    options.push({ score: 76, text: "Control losses so winning days are not erased by a few oversized losing trades." });
  }
  if (winRate >= 58 && netPnl > 0) {
    options.push({ score: 70, text: "Protect winning days by keeping size disciplined after strong sessions." });
  }
  if (expectancy < 0) {
    options.push({ score: 74, text: "Control losses and review execution quality on your weakest sessions." });
  }

  options.sort((a, b) => b.score - a.score);
  return options[0]?.text || "Keep journaling every session and review your weakest day before the next trading week.";
}

function toneForSigned(value: number) {
  if (value > 0) return "good";
  if (value < 0) return "loss";
  return "";
}

function textValue(value: unknown, fallback = "") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
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

function fixedOrNA(value: unknown) {
  const n = numberValue(value);
  return n ? n.toFixed(2) : "N/A";
}

function percent(value: unknown) {
  const n = numberValue(value);
  return Number.isFinite(n) ? `${Math.round(n)}%` : "N/A";
}

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] || char));
}
