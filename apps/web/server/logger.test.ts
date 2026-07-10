import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

function lastLogLine(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const call = spy.mock.calls.at(-1);
  return JSON.parse(call?.[0] as string) as Record<string, unknown>;
}

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes structured JSON with level/message/timestamp plus given fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logger.info('api.success', { route: '/api/v1/products', durationMs: 12, status: 200 });

    const line = lastLogLine(spy);
    expect(line['level']).toBe('info');
    expect(line['message']).toBe('api.success');
    expect(line['route']).toBe('/api/v1/products');
    expect(line['durationMs']).toBe(12);
    expect(typeof line['timestamp']).toBe('string');
  });

  it('redacts sensitive keys (Ch.11 §13)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logger.error('auth.failed', {
      password: 'hunter2',
      refresh_token: 'abc.def.ghi',
      apiKey: 'sk_live_xxx',
      email: 'alice@example.com',
    });

    const line = lastLogLine(spy);
    expect(line['password']).toBe('[REDACTED]');
    expect(line['refresh_token']).toBe('[REDACTED]');
    expect(line['apiKey']).toBe('[REDACTED]');
    expect(line['email']).toBe('alice@example.com');
  });

  it('redacts sensitive keys nested inside an object field', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logger.warn('webhook.received', {
      payload: { authorization: 'Bearer xyz', event: 'payment.captured' },
    });

    const line = lastLogLine(spy);
    const payload = line['payload'] as Record<string, unknown>;
    expect(payload['authorization']).toBe('[REDACTED]');
    expect(payload['event']).toBe('payment.captured');
  });

  it('routes info/warn/error to the matching console method', () => {
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logger.info('a');
    logger.warn('b');
    logger.error('c');

    expect(infoSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
