export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (__DEV__) console.log('[analytics:event]', name, properties || {});
}
export function trackScreen(name: string, properties?: Record<string, unknown>) {
  if (__DEV__) console.log('[analytics:screen]', name, properties || {});
}
