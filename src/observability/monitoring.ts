import React from 'react';
export function initializeMonitoring() {}
export function captureAppError(error: unknown, context?: Record<string, unknown>) {
  if (__DEV__) console.error('[app:error]', error, context || {});
}
export function logCrashlyticsBreadcrumb(message: string, data?: Record<string, unknown>) {
  if (__DEV__) console.log('[breadcrumb]', message, data || {});
}
export function wrapAppWithSentry<T extends React.ComponentType<any>>(Component: T): T {
  return Component;
}
