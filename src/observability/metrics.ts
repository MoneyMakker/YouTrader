export function recordMetric(name: string, value: number, tags?: Record<string, unknown>) {
  if (__DEV__) console.log('[metric]', name, value, tags || {});
}
