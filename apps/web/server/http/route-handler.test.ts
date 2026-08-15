import { BusinessRuleError, InfrastructureError, err, ok } from '@prana/core';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { logger } from '@/server/logger';
import { createApiRoute } from './route-handler';

vi.mock('@/server/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeRequest(url: string): NextRequest {
  return new NextRequest(new Request(url));
}

describe('createApiRoute', () => {
  it('returns a success envelope with 200 when the handler resolves Ok', async () => {
    const route = createApiRoute({
      handler: async () => Promise.resolve(ok({ hello: 'world' })),
    });

    const response = await route(makeRequest('http://localhost/api/v1/example'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ hello: 'world' });
    expect(body.meta.correlationId).toBeTypeOf('string');
  });

  it('maps an AppError from the handler to its own code/httpStatus', async () => {
    const route = createApiRoute({
      handler: async () =>
        Promise.resolve(err(new BusinessRuleError('duplicate', { httpStatus: 409 }))),
    });

    const response = await route(makeRequest('http://localhost/api/v1/example'));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('BUSINESS_RULE_ERROR');
    expect(body.error.message).toBe('duplicate');
  });

  it('logs the error details server-side so the underlying cause is diagnosable', async () => {
    // A 500 whose real cause is only in `details` is invisible in
    // production: that is how a `gen_random_bytes does not exist` error
    // hid behind "Failed to start checkout." for days. The details never
    // cross the API boundary — only the log gets them.
    vi.mocked(logger.error).mockClear();
    const route = createApiRoute({
      handler: async () =>
        Promise.resolve(
          err(
            new InfrastructureError('Failed to start checkout.', {
              cause: 'function gen_random_bytes(integer) does not exist',
            }),
          ),
        ),
    });

    const response = await route(makeRequest('http://localhost/api/v1/example'));
    expect(response.status).toBe(500);

    const logged = vi.mocked(logger.error).mock.calls.find(([event]) => event === 'api.error');
    expect(logged?.[1]).toMatchObject({
      code: 'INFRASTRUCTURE_ERROR',
      details: { cause: 'function gen_random_bytes(integer) does not exist' },
    });

    // ...and still never leaks to the client.
    const body = await response.json();
    expect(body.error.details).toBeUndefined();
  });

  it('rejects a request that fails Zod validation before the handler runs', async () => {
    const handler = vi.fn();
    const route = createApiRoute({
      querySchema: z.object({ limit: z.coerce.number().min(1) }),
      handler,
    });

    const response = await route(makeRequest('http://localhost/api/v1/example?limit=0'));
    expect(response.status).toBe(422);
    expect(handler).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('never leaks a raw thrown error — maps to a 500 InfrastructureError instead', async () => {
    const route = createApiRoute({
      handler: async () => {
        throw new Error('unexpected null pointer somewhere internal');
      },
    });

    const response = await route(makeRequest('http://localhost/api/v1/example'));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe('INFRASTRUCTURE_ERROR');
    expect(body.error.message).not.toMatch(/null pointer/);
  });

  it('names the field that failed instead of a generic message', async () => {
    // "Invalid request body." was identical whichever field was wrong. A
    // product with a 98-character description refused every save and the
    // only way to learn why was to read server logs.
    const route = createApiRoute({
      bodySchema: z.object({ description: z.string().min(100) }),
      handler: async () => Promise.resolve(ok({})),
    });

    const response = await route(
      new NextRequest(
        new Request('http://localhost/api/v1/example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: 'too short' }),
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.message).toContain('description');
    expect(body.error.message).toContain('at least 100');
  });

  it('counts array entries as items, not characters', async () => {
    const route = createApiRoute({
      bodySchema: z.object({ lines: z.array(z.string()).min(1) }),
      handler: async () => Promise.resolve(ok({})),
    });

    const response = await route(
      new NextRequest(
        new Request('http://localhost/api/v1/example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lines: [] }),
        }),
      ),
    );
    const body = await response.json();

    expect(body.error.message).toContain('at least 1 items');
    expect(body.error.message).not.toContain('characters');
  });

  it('summarises several failures without listing every one', async () => {
    const route = createApiRoute({
      bodySchema: z.object({
        a: z.string(),
        b: z.string(),
        c: z.string(),
        d: z.string(),
      }),
      handler: async () => Promise.resolve(ok({})),
    });

    const response = await route(
      new NextRequest(
        new Request('http://localhost/api/v1/example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      ),
    );
    const body = await response.json();

    expect(body.error.message).toContain('+1 more');
  });
});
