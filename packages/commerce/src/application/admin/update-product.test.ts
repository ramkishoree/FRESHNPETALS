import { isErr, isOk } from '@prana/core';
import { describe, expect, it } from 'vitest';
import { UpdateProductService } from './update-product';
import { FakeAdminProductRepository, makeProduct } from './product-test-fakes';

describe('UpdateProductService', () => {
  it('updates an unpublished product, including its SKU', async () => {
    const repo = new FakeAdminProductRepository([makeProduct({ id: '1', status: 'draft' })]);
    const service = new UpdateProductService(repo);

    const result = await service.execute('1', { sku: 'SKU-2' }, 'actor-1');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.sku).toBe('SKU-2');
    }
  });

  it('rejects an SKU change once the product has been published', async () => {
    const repo = new FakeAdminProductRepository([makeProduct({ id: '1', status: 'published' })]);
    // Mark it published in the fake's tracking set via the status service path.
    await repo.updateStatus('1', 'published', 'actor-1');
    const service = new UpdateProductService(repo);

    const result = await service.execute('1', { sku: 'SKU-NEW' }, 'actor-1');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('BUSINESS_RULE_ERROR');
    }
  });

  it('returns a 404-shaped error for a missing product', async () => {
    const service = new UpdateProductService(new FakeAdminProductRepository());

    const result = await service.execute('missing', { name: 'New Name' }, 'actor-1');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.httpStatus).toBe(404);
    }
  });

  it('only validates fields actually supplied in a partial update', async () => {
    const repo = new FakeAdminProductRepository([makeProduct({ id: '1' })]);
    const service = new UpdateProductService(repo);

    // basePrice is untouched; only name is being changed, and validly so.
    const result = await service.execute('1', { name: 'Updated Bouquet Name' }, 'actor-1');

    expect(isOk(result)).toBe(true);
  });
});
