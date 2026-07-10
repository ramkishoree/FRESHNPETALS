import {
  type AppError,
  BusinessRuleError,
  err,
  InfrastructureError,
  ok,
  type Result,
} from '@prana/core';
import {
  type AdminProductRepository,
  canTransitionProductStatus,
  type Product,
  type ProductStatus,
} from '../../domain/product';

/** Ch.8 §16 Product State Machine — the only transitions this rejects are
 * ones the diagram never draws (e.g. `draft` straight to `published`). */
export class UpdateProductStatusService {
  constructor(private readonly products: AdminProductRepository) {}

  async execute(
    id: string,
    status: ProductStatus,
    actorId: string,
  ): Promise<Result<Product, AppError>> {
    const current = await this.products.findById(id);
    if (!current) {
      return err(new BusinessRuleError('Product not found.', { httpStatus: 404 }));
    }

    if (!canTransitionProductStatus(current.status, status)) {
      return err(
        new BusinessRuleError(`Cannot move a product from "${current.status}" to "${status}".`),
      );
    }

    try {
      const product = await this.products.updateStatus(id, status, actorId);
      return ok(product);
    } catch (cause) {
      return err(
        new InfrastructureError('Failed to update product status.', {
          cause: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }
  }
}
