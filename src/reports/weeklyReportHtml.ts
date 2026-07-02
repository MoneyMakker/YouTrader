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
  const copy = reportCopy(textValue(stats.lang, "en"));
  const rawTitle = textValue(stats.title, "");
  const title = rawTitle && rawTitle !== "Monthly Performance Report" ? rawTitle : copy.title;
  const rangeLabel = textValue(stats.rangeLabel, "");
  const tradeCount = numberValue(stats.trades);
  const equityCurve = numberArray(stats.equityCurve);
  const netPnl = numberValue(stats.netPnl);
  const tradingScore = textValue(stats.tradingScore, "N/A");
  const grade = textValue(stats.grade, "N/A");
  const performanceSummary = buildPerformanceSummary(stats, copy);
  const nextFocus = buildNextFocus(stats, copy);
  const logoHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="YouTrader"/>`
    : `<div class="text-logo">${copy.brand}</div>`;

  const kpiRows = [
    [
      kpi(copy.totalTrades, tradeCount ? String(tradeCount) : copy.na),
      kpi(copy.winRate, tradeCount ? percent(stats.winRate) : copy.na),
      kpi(copy.winsLosses, tradeCount ? `${numberValue(stats.wins)} / ${numberValue(stats.losses)}` : copy.na),
      kpi(copy.profitFactor, tradeCount ? fixedOrNA(stats.profitFactor) : copy.na),
    ],
    [
      kpi(copy.expectancy, tradeCount ? money(numberValue(stats.expectancy)) : copy.na, toneForSigned(numberValue(stats.expectancy))),
      kpi(copy.maxDrawdown, tradeCount ? money(numberValue(stats.drawdown)) : copy.na, "loss"),
      kpi(copy.bestDay, textValue(stats.bestDay, copy.na)),
      kpi(copy.worstDay, textValue(stats.worstDay, copy.na), "loss"),
    ],
    [
      kpi(copy.averageWin, tradeCount ? money(numberValue(stats.avgWin)) : copy.na, "good"),
      kpi(copy.averageLoss, tradeCount ? money(-Math.abs(numberValue(stats.avgLoss))) : copy.na, "loss"),
      kpi(copy.averageRR, tradeCount ? fixedOrNA(stats.avgWinLoss) : copy.na),
      kpi(copy.tradingScore, tradeCount ? textValue(stats.tradingScore, copy.na) : copy.na, "accent"),
    ],
    [
      kpi(copy.riskControl, tradeCount ? percent(stats.riskControl) : copy.na),
      kpi(copy.consistency, tradeCount ? percent(stats.consistency) : copy.na),
      kpi(copy.recoveryFactor, tradeCount ? fixedOrNA(stats.recoveryFactor) : copy.na),
      kpi(copy.grade, tradeCount ? textValue(stats.grade, copy.na) : copy.na, "accent"),
    ],
    [
      kpi(copy.bestSession, textValue(stats.bestSession, copy.na), "good"),
      kpi(copy.worstSession, textValue(stats.worstSession, copy.na), "loss"),
    ],
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <style>
    @page { size: A4; margin: 11mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: ${PAPER}; color: ${INK}; font-family: -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", "Segoe UI", sans-serif; }
    .page { width: 100%; max-width: 190mm; margin: 0 auto; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 0 0 13px; border-bottom: 2px solid ${INK}; }
    .brand-block { display: flex; align-items: center; gap: 16px; min-width: 0; }
    .logo { width: 58px; height: 58px; object-fit: contain; flex-shrink: 0; }
    .text-logo { font-size: 26px; font-weight: 900; color: ${PURPLE}; letter-spacing: -0.4px; line-height: 1; }
    .brand-copy { min-width: 0; }
    .brand-name { font-size: 24px; font-weight: 900; color: ${INK}; line-height: 1.05; }
    .brand-tagline { margin-top: 5px; color: ${SUB}; font-size: 9px; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase; }
    .period-block { text-align: right; flex-shrink: 0; max-width: 42%; }
    .period-label { color: ${MUTED}; font-size: 8px; font-weight: 900; letter-spacing: 1.6px; text-transform: uppercase; }
    .period-value { margin-top: 5px; color: ${INK}; font-size: 12px; font-weight: 850; line-height: 1.35; }
    .report-title { margin: 14px 0 0; font-size: 29px; font-weight: 900; letter-spacing: -0.45px; color: ${INK}; line-height: 1.06; }
    .hero { margin-top: 13px; padding: 17px 18px; border-radius: 16px; border: 1px solid ${LINE}; background: linear-gradient(135deg, ${SOFT} 0%, ${PAPER} 68%, rgba(176,38,255,0.035) 100%); break-inside: avoid; display: grid; grid-template-columns: 1.18fr 0.82fr; gap: 16px; align-items: stretch; }
    .hero-label { color: ${SUB}; font-size: 10px; font-weight: 900; letter-spacing: 1.8px; text-transform: uppercase; }
    .hero-value { margin-top: 7px; font-size: 49px; line-height: 0.98; font-weight: 900; color: ${netPnl >= 0 ? GREEN : RED}; }
    .hero-sub { margin-top: 8px; color: ${MUTED}; font-size: 12px; font-weight: 700; line-height: 1.4; }
    .hero-side { border-left: 1px solid ${LINE}; padding-left: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-content: center; }
    .hero-mini { border: 1px solid ${LINE}; border-radius: 11px; background: ${PAPER}; padding: 9px; min-height: 55px; }
    .hero-mini-label { color: ${SUB}; font-size: 8px; font-weight: 900; letter-spacing: 1.1px; text-transform: uppercase; }
    .hero-mini-value { color: ${INK}; font-size: 18px; font-weight: 900; margin-top: 5px; }
    .hero-mini.accent .hero-mini-value { color: ${PURPLE}; }
    .section-title { margin: 13px 0 8px; color: ${INK}; font-size: 10px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; break-inside: avoid; }
    .kpi-grid.compact { grid-template-columns: repeat(2, 1fr); margin-top: 7px; }
    .kpi { background: ${PAPER}; border: 1px solid ${LINE}; border-radius: 11px; padding: 9px 10px; min-height: 63px; break-inside: avoid; }
    .kpi.good .kpi-value { color: ${GREEN}; }
    .kpi.loss .kpi-value { color: ${RED}; }
    .kpi.accent .kpi-value { color: ${PURPLE}; }
    .kpi-label { color: ${SUB}; font-size: 9px; font-weight: 900; letter-spacing: 1.2px; text-transform: uppercase; line-height: 1.25; }
    .kpi-value { margin-top: 5px; color: ${INK}; font-size: 16px; line-height: 1.14; font-weight: 900; word-break: break-word; }
    .chart-panel { margin-top: 5px; padding: 10px 12px 8px; border: 1px solid ${LINE}; border-radius: 15px; background: ${PAPER}; break-inside: avoid; }
    .chart-panel svg { width: 100%; height: 118px; display: block; overflow: visible; }
    .insights { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 9px; margin-top: 13px; break-inside: avoid; page-break-inside: avoid; }
    .insight-card { border: 1px solid ${LINE}; border-radius: 15px; background: ${SOFT}; padding: 12px 13px; min-height: 104px; }
    .insight-card.focus { border-color: rgba(176,38,255,0.28); background: rgba(176,38,255,0.05); }
    .insight-title { color: ${INK}; font-size: 10px; font-weight: 900; letter-spacing: 1.4px; text-transform: uppercase; }
    .insight-body { margin-top: 8px; color: ${INK}; font-size: 11px; line-height: 1.48; font-weight: 650; }
    .footer { margin-top: 13px; padding-top: 10px; border-top: 1px solid ${LINE}; display: flex; align-items: center; justify-content: space-between; gap: 12px; break-inside: avoid; }
    .footer-logo { width: 24px; height: 24px; object-fit: contain; margin-right: 8px; vertical-align: middle; }
    .footer-left { flex: 1; min-width: 0; }
    .footer-brand { color: ${INK}; font-size: 11px; font-weight: 900; display: flex; align-items: center; }
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
          <div class="brand-name">${copy.brand}</div>
          <div class="brand-tagline">${copy.tagline}</div>
        </div>
      </div>
      <div class="period-block">
        <div class="period-label">${copy.reportingPeriod}</div>
        <div class="period-value">${escapeHtml(rangeLabel || copy.currentMonth)}</div>
      </div>
    </header>

    <h1 class="report-title">${escapeHtml(title)}</h1>

    <section class="hero">
      <div>
        <div class="hero-label">${copy.netPnl}</div>
        <div class="hero-value">${tradeCount ? money(netPnl) : copy.na}</div>
        <div class="hero-sub">${tradeCount ? copy.loggedTrades(tradeCount) : copy.noTrades}</div>
      </div>
      <div class="hero-side">
        <div class="hero-mini accent"><div class="hero-mini-label">${copy.tradingScore}</div><div class="hero-mini-value">${escapeHtml(tradingScore)}</div></div>
        <div class="hero-mini"><div class="hero-mini-label">${copy.grade}</div><div class="hero-mini-value">${escapeHtml(grade)}</div></div>
        <div class="hero-mini"><div class="hero-mini-label">${copy.winRate}</div><div class="hero-mini-value">${tradeCount ? percent(stats.winRate) : copy.na}</div></div>
        <div class="hero-mini"><div class="hero-mini-label">${copy.profitFactor}</div><div class="hero-mini-value">${tradeCount ? fixedOrNA(stats.profitFactor) : copy.na}</div></div>
      </div>
    </section>

    <div class="section-title">${copy.corePerformance}</div>
    <div class="kpi-grid">
      ${kpiRows[0].join("")}
    </div>
    <div class="kpi-grid" style="margin-top:8px;">
      ${kpiRows[1].join("")}
    </div>

    <div class="section-title">${copy.equityCurve}</div>
    <div class="chart-panel">
      ${buildEquityChart(equityCurve, tradeCount)}
    </div>

    <div class="section-title">${copy.advancedMetrics}</div>
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
        <div class="insight-title">${copy.performanceSummary}</div>
        <div class="insight-body">${escapeHtml(performanceSummary)}</div>
      </div>
      <div class="insight-card focus">
        <div class="insight-title">${copy.nextFocus}</div>
        <div class="insight-body">${escapeHtml(nextFocus)}</div>
      </div>
    </div>

    <footer class="footer">
      <div class="footer-left">
        <div class="footer-brand">${logoDataUri ? `<img class="footer-logo" src="${logoDataUri}" alt=""/>` : ""}${copy.footerBrand}</div>
        <div class="footer-disclaimer">${copy.disclaimer}</div>
      </div>
      <div class="footer-cta">${copy.footerCta}</div>
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
      ${chartGrid(680, 132, 24, 18, 22)}
      <line x1="24" y1="82" x2="656" y2="82" stroke="${MUTED}" stroke-width="1.8" stroke-linecap="round"/>
      <text x="340" y="58" text-anchor="middle" fill="${MUTED}" font-size="13" font-weight="700" font-family="-apple-system, sans-serif">Log trades to generate an equity curve</text>
    </svg>`;
  }

  const series = values.length ? values : [0];
  const width = 680;
  const height = 132;
  const padX = 24;
  const padTop = 14;
  const padBottom = 22;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;

  if (series.length <= 1 || tradeCount <= 1) {
    const y = padTop + chartH / 2;
    const value = series[0] || 0;
    const stroke = value >= 0 ? GREEN : RED;
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${chartGrid(width, height, padX, padTop, padBottom)}
      <line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="${width - padX}" cy="${y}" r="4.8" fill="${PAPER}" stroke="${stroke}" stroke-width="2.5"/>
      <text x="${padX}" y="${height - 5}" fill="${MUTED}" font-size="10" font-weight="700" font-family="-apple-system, sans-serif">Single-trade sample. Curve will develop as more trades are logged.</text>
    </svg>`;
  }

  const normalized = series;
  const min = Math.min(0, ...normalized);
  const max = Math.max(0, ...normalized);
  const spread = Math.max(1, max - min);

  const coords = normalized.map((value, index) => {
    const x = padX + (index / (normalized.length - 1)) * chartW;
    const y = padTop + chartH - ((value - min) / spread) * chartH;
    return { x, y };
  });

  const linePoints = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const zeroY = padTop + chartH - ((0 - min) / spread) * chartH;
  const stroke = normalized[normalized.length - 1] >= 0 ? GREEN : RED;
  const start = coords[0];
  const end = coords[coords.length - 1];

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
    <defs>
      <filter id="softLineShadow" x="-8%" y="-40%" width="116%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${stroke}" flood-opacity="0.16"/>
      </filter>
      <linearGradient id="equityStroke" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${PURPLE}" stop-opacity="0.78"/>
        <stop offset="100%" stop-color="${stroke}" stop-opacity="1"/>
      </linearGradient>
    </defs>
    ${chartGrid(width, height, padX, padTop, padBottom)}
    <line x1="${padX}" y1="${zeroY.toFixed(1)}" x2="${width - padX}" y2="${zeroY.toFixed(1)}" stroke="${MUTED}" stroke-width="1.25" stroke-dasharray="4 5" opacity="0.45"/>
    <polyline points="${linePoints}" fill="none" stroke="url(#equityStroke)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#softLineShadow)"/>
    <circle cx="${start.x.toFixed(1)}" cy="${start.y.toFixed(1)}" r="3.8" fill="${PAPER}" stroke="${PURPLE}" stroke-width="2"/>
    <circle cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="5.2" fill="${PAPER}" stroke="${stroke}" stroke-width="2.6"/>
  </svg>`;
}

function chartGrid(width: number, height: number, padX: number, padTop: number, padBottom: number) {
  const right = width - padX;
  const bottom = height - padBottom;
  const rows = [padTop, padTop + (bottom - padTop) / 2, bottom];
  const cols = [padX, padX + (right - padX) / 3, padX + ((right - padX) * 2) / 3, right];
  return `
    <rect x="${padX}" y="${padTop}" width="${right - padX}" height="${bottom - padTop}" rx="8" fill="#FBFCFE" stroke="${LINE}" stroke-width="1"/>
    ${rows.map((y) => `<line x1="${padX}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${LINE}" stroke-width="0.9" opacity="0.72"/>`).join("")}
    ${cols.map((x) => `<line x1="${x.toFixed(1)}" y1="${padTop}" x2="${x.toFixed(1)}" y2="${bottom}" stroke="${LINE}" stroke-width="0.9" opacity="0.42"/>`).join("")}
  `;
}

function reportCopy(langValue: string) {
  const lang = String(langValue || "en").toLowerCase();
  const base = {
    brand: "YouTrader",
    tagline: "Professional trading performance report",
    title: "Monthly Performance Report",
    reportingPeriod: "Reporting Period",
    currentMonth: "Current month",
    netPnl: "Net P&L",
    totalTrades: "Total Trades",
    winRate: "Win Rate",
    winsLosses: "Wins / Losses",
    profitFactor: "Profit Factor",
    expectancy: "Expectancy",
    maxDrawdown: "Max Drawdown",
    averageWin: "Average Win",
    averageLoss: "Average Loss",
    averageRR: "Average R/R",
    tradingScore: "Trading Score",
    grade: "Grade",
    riskControl: "Risk Control",
    consistency: "Consistency",
    recoveryFactor: "Recovery Factor",
    bestDay: "Best Day",
    worstDay: "Worst Day",
    bestSession: "Best Session",
    worstSession: "Worst Session",
    corePerformance: "Core Performance",
    equityCurve: "Equity Curve",
    advancedMetrics: "Advanced Metrics",
    performanceSummary: "Performance Summary",
    nextFocus: "Next Focus",
    noTrades: "No trades logged during this reporting period",
    noTradesSummary: "No trades were logged during this reporting period. Continue journaling to build a monthly performance record.",
    noTradesFocus: "Start logging trades consistently to unlock meaningful monthly insights.",
    loggedTrades: (count: number) => `${count} logged trade${count === 1 ? "" : "s"} in this period`,
    footerBrand: "Professional trading journal",
    footerCta: "YouTrader Available on the App Store",
    disclaimer: "Educational journal. Not financial advice.",
    na: "N/A",
  };

  const localized: Record<string, Partial<typeof base>> = {
    ru: {
      tagline: "Профессиональный отчёт по торговой эффективности",
      title: "Месячный отчёт по эффективности",
      reportingPeriod: "Отчётный период",
      currentMonth: "Текущий месяц",
      netPnl: "Итоговый P&L",
      totalTrades: "Всего сделок",
      winRate: "Процент побед",
      winsLosses: "Победы / лоссы",
      profitFactor: "Профит-фактор",
      expectancy: "Ожидание",
      maxDrawdown: "Макс. просадка",
      averageWin: "Средняя победа",
      averageLoss: "Средний лосс",
      averageRR: "Средний R/R",
      tradingScore: "Trading Score",
      grade: "Оценка",
      riskControl: "Контроль риска",
      consistency: "Стабильность",
      recoveryFactor: "Recovery Factor",
      bestDay: "Лучший день",
      worstDay: "Худший день",
      bestSession: "Лучшая сессия",
      worstSession: "Худшая сессия",
      corePerformance: "Основные показатели",
      equityCurve: "Кривая капитала",
      advancedMetrics: "Продвинутые метрики",
      performanceSummary: "Сводка эффективности",
      nextFocus: "Следующий фокус",
      noTrades: "За этот период сделок нет",
      noTradesSummary: "За этот отчётный период сделок не было. Продолжай вести журнал, чтобы построить месячную статистику.",
      noTradesFocus: "Начни стабильно логировать сделки, чтобы открыть полезные месячные выводы.",
      loggedTrades: (count: number) => `${count} сделок в этом периоде`,
      footerBrand: "Профессиональный торговый журнал",
      footerCta: "YouTrader Available on the App Store",
      disclaimer: "Образовательный журнал. Не финансовый совет.",
    },
    es: {
      title: "Informe mensual de rendimiento",
      reportingPeriod: "Periodo del informe",
      netPnl: "P&L neto",
      totalTrades: "Total de trades",
      winRate: "Tasa de acierto",
      winsLosses: "Ganadas / Perdidas",
      profitFactor: "Factor de beneficio",
      expectancy: "Expectativa",
      maxDrawdown: "Drawdown máximo",
      averageWin: "Ganancia media",
      averageLoss: "Pérdida media",
      averageRR: "R/R medio",
      riskControl: "Control de riesgo",
      consistency: "Consistencia",
      bestDay: "Mejor día",
      worstDay: "Peor día",
      bestSession: "Mejor sesión",
      worstSession: "Peor sesión",
      performanceSummary: "Resumen de rendimiento",
      nextFocus: "Próximo foco",
      footerBrand: "Diario profesional de trading",
      disclaimer: "Diario educativo. No es asesoramiento financiero.",
    },
    de: {
      title: "Monatlicher Performance-Bericht",
      reportingPeriod: "Berichtszeitraum",
      netPnl: "Netto P&L",
      totalTrades: "Trades gesamt",
      winRate: "Win Rate",
      winsLosses: "Gewinne / Verluste",
      profitFactor: "Profit Factor",
      expectancy: "Erwartungswert",
      maxDrawdown: "Max. Drawdown",
      averageWin: "Durchschn. Gewinn",
      averageLoss: "Durchschn. Verlust",
      averageRR: "Durchschn. R/R",
      riskControl: "Risikokontrolle",
      consistency: "Konsistenz",
      bestDay: "Bester Tag",
      worstDay: "Schlechtester Tag",
      bestSession: "Beste Session",
      worstSession: "Schlechteste Session",
      performanceSummary: "Performance-Zusammenfassung",
      nextFocus: "Nächster Fokus",
      footerBrand: "Professionelles Trading-Journal",
      disclaimer: "Bildungsjournal. Keine Finanzberatung.",
    },
  };

  return { ...base, ...(localized[lang] || {}) };
}

function buildPerformanceSummary(stats: ReportStats, copy: ReturnType<typeof reportCopy>): string {
  const trades = numberValue(stats.trades);
  if (!trades) {
    return copy.noTradesSummary;
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

function buildNextFocus(stats: ReportStats, copy: ReturnType<typeof reportCopy>): string {
  const trades = numberValue(stats.trades);
  if (!trades) return copy.noTradesFocus;

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
