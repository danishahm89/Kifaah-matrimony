// ── Structured logger ──────────────────────────────────────────────
// Sends log entries to console in dev and stores the last N for the
// Observability screen. Keep lightweight – no external dependencies.

const MAX_ENTRIES = 200;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: number;          // epoch ms
  level: LogLevel;
  tag: string;         // short context label, e.g. 'API', 'AUTH'
  message: string;
  data?: unknown;
}

const _log: LogEntry[] = [];
const _listeners: Array<(e: LogEntry) => void> = [];

function emit(level: LogLevel, tag: string, message: string, data?: unknown) {
  const entry: LogEntry = { ts: Date.now(), level, tag, message, data };
  _log.push(entry);
  if (_log.length > MAX_ENTRIES) _log.shift();
  _listeners.forEach(fn => fn(entry));
  if (__DEV__) {
    const prefix = `[${tag}]`;
    if (level === 'error') console.error(prefix, message, data ?? '');
    else if (level === 'warn') console.warn(prefix, message, data ?? '');
    else console.log(prefix, message, data ?? '');
  }
}

export const logger = {
  debug: (tag: string, msg: string, data?: unknown) => emit('debug', tag, msg, data),
  info:  (tag: string, msg: string, data?: unknown) => emit('info',  tag, msg, data),
  warn:  (tag: string, msg: string, data?: unknown) => emit('warn',  tag, msg, data),
  error: (tag: string, msg: string, data?: unknown) => emit('error', tag, msg, data),
  getEntries: () => [..._log],
  subscribe: (fn: (e: LogEntry) => void) => {
    _listeners.push(fn);
    return () => { const i = _listeners.indexOf(fn); if (i > -1) _listeners.splice(i, 1); };
  },
};
