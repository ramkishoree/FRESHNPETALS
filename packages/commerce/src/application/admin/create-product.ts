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

/** Ch.8 §19 Product Creation Workflow's write step, minus the AI-generation
 * steps either side of it (Phase 11) — administrator-supplied fields in,
 * a stored `draft` product out. */
export class CreateProductService {
  constructor(private readonly products: AdminProductRepository) {}

  async execute(input: AdminProductInput, actorId: string): Promise<Result<Product, AppError>> {
    const violations = validateAdminProductInput(input);
    if (violations.length > 0) {
      return err(new ValidationError('Product input failed validation.', { violations }));
    }

    try {
      const product = await this.products.create(input, actorId);
      return ok(product);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes('duplicate key')) {
        return err(new BusinessRuleError('SKU or slug is already in use.', { httpStatus: 409 }));
      }
      return err(new InfrastructureError('Failed to create product.', { cause: message }));
    }
  }
}
