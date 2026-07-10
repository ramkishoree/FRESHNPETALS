import { describe, expect, it } from 'vitest';
import { apiError, apiSuccess } from './envelope';

describe('apiSuccess', () => {
  it('produces the exact Ch.11 §10 envelope shape with a 200 default', async () => {
    const response = apiSuccess({ id: '1' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, data: { id: '1' }, meta: null, error: null });
  });

  it('accepts a custom status and meta', async () => {
    const response = apiSuccess({ id: '1' }, { status: 201, meta: { correlationId: 'abc' } });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.meta).toEqual({ correlationId: 'abc' });
  });
});

describe('apiError', () => {
  it('produces the exact envelope shape with data: null', async () => {
    const response = apiError('VALIDATION_ERROR', 'Invalid input.', 422, 'corr-1');
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      data: null,
      meta: null,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', correlationId: 'corr-1' },
    });
  });
});
