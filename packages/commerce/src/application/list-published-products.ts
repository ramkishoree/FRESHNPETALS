import {
  type AppError,
  err,
  InfrastructureError,
  ok,
  type PagedResult,
  type Pagination,
  type Result,
} from '@prana/core';
import type { Product, ProductRepository } from '../domain/product';

/**
 * Ch.11 §5: Application Layer coordinates a use case and "does not know
 * SQL" — depends only on the ProductRepository interface, never a
 * concrete Supabase implementation, so it's testable with an in-memory
 * fake (see list-published-products.test.ts) with no database at all.
 */
export class ListPublishedProductsService {
  constructor(private readonly products: ProductRepository) {}

  async execute(pagination: Pagination): Promise<Result<PagedResult<Product>, AppError>> {
    try {
      const result = await this.products.findPublished(pagination);
      return ok(result);
    } catch (cause) {
      return err(
        new InfrastructureError('Failed to list published products.', {
          cause: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }
  }
}
