import { BusinessRuleError, err, ok } from '@prana/core';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
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
});
