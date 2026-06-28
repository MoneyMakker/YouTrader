export function buildWeeklyReportHtml(stats: Record<string, unknown>) {
  const rows = Object.entries(stats)
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(formatValue(value))}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"/><style>body{background:#05070A;color:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:32px}h1{color:#A3FF12}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid rgba(255,255,255,.12);padding:10px;text-align:left}th{color:#9CA3AF;text-transform:uppercase;font-size:12px}</style></head><body><h1>YouTrader Report</h1><table>${rows}</table><p>Educational journal. Not financial advice.</p></body></html>`;
}
function formatValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}
function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char));
}
