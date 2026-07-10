import {
  type AppError,
  err,
  InfrastructureError,
  ok,
  type PagedResult,
  type Pagination,
  type Result,
} from '@prana/core';
import type { AdminProductFilter, AdminProductRepository, Product } from '../../domain/product';

/** Ch.16 §93: admin product listing — unlike ListPublishedProductsService,
 * sees every status and supports the search/status filters the Product
 * Module (Ch.12 §47) needs. */
export class ListAdminProductsService {
  constructor(private readonly products: AdminProductRepository) {}

  async execute(
    filter: AdminProductFilter,
    pagination: Pagination,
  ): Promise<Result<PagedResult<Product>, AppError>> {
    try {
      const result = await this.products.list(filter, pagination);
      return ok(result);
    } catch (cause) {
      return err(
        new InfrastructureError('Failed to list products.', {
          cause: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }
  }
}
