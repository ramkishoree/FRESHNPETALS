import type { PagedResult, Pagination } from '@prana/core';
import type {
  AdminProductInput,
  AdminProductRepository,
  Product,
  ProductStatus,
} from '../../domain/product';

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    sku: 'SKU-1',
    slug: 'rose-bouquet',
    name: 'Premium Red Rose Bouquet',
    shortDescription: null,
    color: null,
    featuredImage: 'https://example.com/rose.jpg',
    images: ['https://example.com/rose.jpg'],
    status: 'draft',
    basePrice: 999,
    salePrice: null,
    availableQuantity: 10,
    ...overrides,
  };
}

export function makeValidInput(overrides: Partial<AdminProductInput> = {}): AdminProductInput {
  return {
    sku: 'SKU-1',
    slug: 'rose-bouquet',
    name: 'Premium Red Rose Bouquet',
    description: 'A'.repeat(120),
    categoryId: 'cat-1',
    basePrice: 999,
    focusKeyword: 'red roses',
    featuredImage: 'https://example.com/rose.jpg',
    ...overrides,
  };
}

export class FakeAdminProductRepository implements AdminProductRepository {
  constructor(
    private readonly products: Product[] = [],
    private readonly publishedIds: Set<string> = new Set(),
  ) {}

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

  list(
    filter: { status?: ProductStatus; search?: string },
    _pagination: Pagination,
  ): Promise<PagedResult<Product>> {
    const items = this.products.filter((p) => {
      if (filter.status && p.status !== filter.status) return false;
      if (filter.search && !p.name.toLowerCase().includes(filter.search.toLowerCase()))
        return false;
      return true;
    });
    return Promise.resolve({ items, nextCursor: null });
  }

  create(input: AdminProductInput, _actorId: string): Promise<Product> {
    const product = makeProduct({
      id: `new-${this.products.length + 1}`,
      sku: input.sku,
      slug: input.slug,
      name: input.name,
      basePrice: input.basePrice,
      salePrice: input.salePrice ?? null,
      featuredImage: input.featuredImage,
    });
    this.products.push(product);
    return Promise.resolve(product);
  }

  update(id: string, input: Partial<AdminProductInput>, _actorId: string): Promise<Product> {
    const index = this.products.findIndex((p) => p.id === id);
    const existing = this.products[index];
    if (index === -1 || !existing) throw new Error('not found');
    const updated: Product = {
      ...existing,
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.basePrice !== undefined ? { basePrice: input.basePrice } : {}),
    };
    this.products[index] = updated;
    return Promise.resolve(updated);
  }

  updateStatus(id: string, status: ProductStatus, _actorId: string): Promise<Product> {
    const index = this.products.findIndex((p) => p.id === id);
    const existing = this.products[index];
    if (index === -1 || !existing) throw new Error('not found');
    const updated = { ...existing, status };
    this.products[index] = updated;
    if (status === 'published') this.publishedIds.add(id);
    return Promise.resolve(updated);
  }

  hasBeenPublished(id: string): Promise<boolean> {
    return Promise.resolve(this.publishedIds.has(id));
  }
}
