import { isErr, isOk } from '@prana/core';
import { describe, expect, it } from 'vitest';
import type { AdminProductRepository } from '../../domain/product';
import { ListAdminProductsService } from './list-admin-products';
import { FakeAdminProductRepository, makeProduct } from './product-test-fakes';

class ThrowingAdminProductRepository implements Partial<AdminProductRepository> {
  list(): Promise<never> {
    return Promise.reject(new Error('connection refused'));
  }
}

describe('ListAdminProductsService', () => {
  it('lists every status, unlike the customer-facing published-only list', async () => {
    const repo = new FakeAdminProductRepository([
      makeProduct({ id: '1', status: 'draft' }),
      makeProduct({ id: '2', status: 'published' }),
      makeProduct({ id: '3', status: 'archived' }),
    ]);
    const service = new ListAdminProductsService(repo);

    const result = await service.execute({}, { limit: 10 });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.items).toHaveLength(3);
  });

  it('filters by status', async () => {
    const repo = new FakeAdminProductRepository([
      makeProduct({ id: '1', status: 'draft' }),
      makeProduct({ id: '2', status: 'published' }),
    ]);
    const service = new ListAdminProductsService(repo);

    const result = await service.execute({ status: 'published' }, { limit: 10 });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.items.map((p) => p.id)).toEqual(['2']);
  });

  it('filters by case-insensitive free-text search', async () => {
    const repo = new FakeAdminProductRepository([
      makeProduct({ id: '1', name: 'Red Rose Bouquet' }),
      makeProduct({ id: '2', name: 'Lily Basket' }),
    ]);
    const service = new ListAdminProductsService(repo);

    const result = await service.execute({ search: 'rose' }, { limit: 10 });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.items.map((p) => p.id)).toEqual(['1']);
  });

  it('wraps a repository failure in an InfrastructureError rather than throwing', async () => {
    const service = new ListAdminProductsService(
      new ThrowingAdminProductRepository() as unknown as AdminProductRepository,
    );

    const result = await service.execute({}, { limit: 10 });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('INFRASTRUCTURE_ERROR');
      expect(result.error.httpStatus).toBe(500);
    }
  });
});
