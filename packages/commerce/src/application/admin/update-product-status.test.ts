import { isErr, isOk } from '@prana/core';
import { describe, expect, it } from 'vitest';
import { UpdateProductStatusService } from './update-product-status';
import { FakeAdminProductRepository, makeProduct } from './product-test-fakes';

describe('UpdateProductStatusService', () => {
  it('allows a valid transition (draft -> pending_review)', async () => {
    const repo = new FakeAdminProductRepository([makeProduct({ id: '1', status: 'draft' })]);
    const service = new UpdateProductStatusService(repo);

    const result = await service.execute('1', 'pending_review', 'actor-1');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status).toBe('pending_review');
    }
  });

  it('allows draft -> published: a new listing must be able to go on sale', async () => {
    // This used to be forbidden by the editorial pipeline, which meant a
    // product created in the admin could never actually be sold.
    const repo = new FakeAdminProductRepository([makeProduct({ id: '1', status: 'draft' })]);
    const service = new UpdateProductStatusService(repo);

    const result = await service.execute('1', 'published', 'actor-1');

    expect(isErr(result)).toBe(false);
    if (!isErr(result)) {
      expect(result.value.status).toBe('published');
    }
  });

  it('allows archived -> published, so a removed product can be restored', async () => {
    const repo = new FakeAdminProductRepository([makeProduct({ id: '1', status: 'archived' })]);
    const service = new UpdateProductStatusService(repo);

    const result = await service.execute('1', 'published', 'actor-1');

    expect(isErr(result)).toBe(false);
    if (!isErr(result)) {
      expect(result.value.status).toBe('published');
    }
  });

  it('allows archived -> draft (Ch.8 §16 explicitly draws this edge)', async () => {
    const repo = new FakeAdminProductRepository([makeProduct({ id: '1', status: 'archived' })]);
    const service = new UpdateProductStatusService(repo);

    const result = await service.execute('1', 'draft', 'actor-1');

    expect(isOk(result)).toBe(true);
  });

  it('returns a 404-shaped error for a missing product', async () => {
    const service = new UpdateProductStatusService(new FakeAdminProductRepository());

    const result = await service.execute('missing', 'published', 'actor-1');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.httpStatus).toBe(404);
    }
  });
});
