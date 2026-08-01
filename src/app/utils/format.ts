export function money(n: number) {
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function moneyCompact(n: number) {
  const a = Math.abs(n);
  if (a >= 1000000) return `${n >= 0 ? "+" : "-"}$${(a / 1000000).toFixed(1)}M`;
  if (a >= 10000)
    return `${n >= 0 ? "+" : "-"}$${(a / 1000).toFixed(a >= 100000 ? 0 : 1)}K`;
  return money(n);
}
export function dayMoney(n: number) {
  return formatCompactMoney(n);
}
export function formatCompactMoney(n: number) {
  const a = Math.abs(n);
  if (!a) return "$0";
  const sign = n >= 0 ? "+" : "-";
  if (a >= 1000) {
    const value = a / 1000;
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
    return `${sign}$${formatted}K`;
  }
  return `${sign}$${Math.round(a)}`;
}
