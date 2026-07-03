export function money(value: number, decimals = 0) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
}

export function pnlCompact(value: number) {
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function pnlDisplay(value: number, hasTrades: boolean) {
  if (!hasTrades) return "—";
  const positive = value >= 0;
  return `${positive ? "+" : "-"}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function traderTier(score: number | null | undefined) {
  if (score == null || !Number.isFinite(score)) return "ROOKIE";
  if (score >= 90) return "APEX";
  if (score >= 75) return "ELITE";
  if (score >= 60) return "CONSISTENT";
  return "ROOKIE";
}

export function formatMetric(value: string | number | null | undefined, fallback = "N/A") {
  if (value == null || value === "") return fallback;
  return String(value);
}
