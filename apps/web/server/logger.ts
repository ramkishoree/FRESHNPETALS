/**
 * Ch.11 §13: structured JSON logging. Every request logs request ID, trace
 * ID, user ID, route, duration, status, errors; sensitive values redacted.
 * No vendor is named for v1 (Ch.14: "Version 1 may use centralized
 * structured logs") — this writes JSON lines to stdout, which Vercel
 * already captures and indexes, rather than adding a logging dependency
 * before there's a concrete need for one.
 */

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /password|token|secret|authorization|api[-_]?key|refresh_token/i;

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  requestId?: string;
  traceId?: string;
  userId?: string;
  route?: string;
  durationMs?: number;
  status?: number;
  [key: string]: unknown;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(val),
      ]),
    );
  }
  return value;
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  const line = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(redact(fields) as LogFields),
  };
  const serialized = JSON.stringify(line);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
};
