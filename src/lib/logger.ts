type Meta = Record<string, unknown> | undefined;
function log(level: 'log' | 'warn' | 'error', message: unknown, meta?: Meta) {
  if (!__DEV__ && level === 'log') return;
  const args = meta ? [message, meta] : [message];
  console[level](...args);
}
export const logger = {
  info: (message: unknown, meta?: Meta) => log('log', message, meta),
  warn: (message: unknown, meta?: Meta) => log('warn', message, meta),
  error: (message: unknown, meta?: Meta) => log('error', message, meta),
};
