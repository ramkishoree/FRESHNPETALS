import {
  type AppError,
  BusinessRuleError,
  err,
  InfrastructureError,
  ok,
  type Result,
  ValidationError,
} from '@prana/core';
import {
  type AdminProductInput,
  type AdminProductRepository,
  type Product,
  validateAdminProductInput,
} from '../../domain/product';

/** Ch.8 §20: "SKU — Immutable after publication." Everything else may
 * change on any update; only the already-published check on SKU is
 * state-dependent, so it lives here rather than in the pure validator. */
export class UpdateProductService {
  constructor(private readonly products: AdminProductRepository) {}

  async execute(
    id: string,
    input: Partial<AdminProductInput>,
    actorId: string,
  ): Promise<Result<Product, AppError>> {
    const current = await this.products.findById(id);
    if (!current) {
      return err(new BusinessRuleError('Product not found.', { httpStatus: 404 }));
    }

    if (input.sku != null && input.sku !== current.sku) {
      const published = await this.products.hasBeenPublished(id);
      if (published) {
        return err(new BusinessRuleError('SKU cannot change once a product has been published.'));
      }
    }

    // Only the fields the caller actually supplied are validated —
    // validateAdminProductInput checks each field independently of the
    // others, so a partial edit never gets rejected over an unrelated
    // field it didn't touch.
    const violations = validateAdminProductInput(input);
    if (violations.length > 0) {
      return err(new ValidationError('Product input failed validation.', { violations }));
    }

    try {
      const product = await this.products.update(id, input, actorId);
      return ok(product);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes('duplicate key')) {
        return err(new BusinessRuleError('SKU or slug is already in use.', { httpStatus: 409 }));
      }
      return err(new InfrastructureError('Failed to update product.', { cause: message }));
    }
  }
}
