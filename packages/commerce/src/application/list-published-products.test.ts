import { isErr, isOk, type PagedResult, type Pagination } from '@prana/core';
import { describe, expect, it } from 'vitest';
import type { Product, ProductRepository } from '../domain/product';
import { ListPublishedProductsService } from './list-published-products';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    sku: 'SKU-1',
    slug: 'rose-bouquet',
    name: 'Rose Bouquet',
    shortDescription: null,
    color: null,
    type: null,
    featuredImage: null,
    images: [],
    status: 'published',
    basePrice: 999,
    salePrice: null,
    availableQuantity: 10,
    ...overrides,
  };
}

class FakeProductRepository implements ProductRepository {
  constructor(private readonly products: Product[]) {}

  findById(id: string): Promise<Product | null> {
    return Promise.resolve(this.products.find((p) => p.id === id) ?? null);
  }

  findMany(_pagination: Pagination): Promise<PagedResult<Product>> {
    return Promise.resolve({ items: this.products, nextCursor: null });
  }

  findPublished(_pagination: Pagination): Promise<PagedResult<Product>> {
    return Promise.resolve({
      items: this.products.filter((p) => p.status === 'published'),
      nextCursor: null,
    });
  }
}

class ThrowingProductRepository implements ProductRepository {
  findById(): Promise<Product | null> {
    return Promise.reject(new Error('connection refused'));
  }
  findMany(): Promise<PagedResult<Product>> {
    return Promise.reject(new Error('connection refused'));
  }
  findPublished(): Promise<PagedResult<Product>> {
    return Promise.reject(new Error('connection refused'));
  }
}

describe('ListPublishedProductsService', () => {
  it('returns only published products, no database required', async () => {
    const repo = new FakeProductRepository([
      makeProduct({ id: '1', status: 'published' }),
      makeProduct({ id: '2', status: 'draft' }),
      makeProduct({ id: '3', status: 'published' }),
    ]);
    const service = new ListPublishedProductsService(repo);

    const result = await service.execute({ limit: 10 });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.items).toHaveLength(2);
      expect(result.value.items.map((p) => p.id)).toEqual(['1', '3']);
    }
  });

  it('wraps a repository failure in an InfrastructureError rather than throwing', async () => {
    const service = new ListPublishedProductsService(new ThrowingProductRepository());

    const result = await service.execute({ limit: 10 });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('INFRASTRUCTURE_ERROR');
      expect(result.error.httpStatus).toBe(500);
    }
  });
});
