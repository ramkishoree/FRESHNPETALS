import type { Pagination, PagedResult, ReadRepository } from '@prana/core';

/**
 * Mirrors infrastructure/database/migrations/0005 products + product_prices
 * — a listing DTO, not a 1:1 table mapping (price is joined in because
 * that's what a "list products" use case actually needs to return).
 */
export type ProductStatus =
  | 'draft'
  | 'ai_generated'
  | 'pending_review'
  | 'approved'
  | 'published'
  | 'archived'
  | 'out_of_stock'
  | 'hidden';

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  featuredImage: string | null;
  status: ProductStatus;
  basePrice: number;
  salePrice: number | null;
}

export interface ProductRepository extends ReadRepository<Product> {
  findPublished(pagination: Pagination): Promise<PagedResult<Product>>;
}

/**
 * Ch.8 §16 Product State Machine. `approved` sits alongside the diagram's
 * PendingReview→Published edge (Ch.10's enum has both, the state diagram
 * doesn't distinguish them) — treated as a synonym administrators can
 * publish from, same as pending_review.
 */
export const PRODUCT_STATUS_TRANSITIONS: Readonly<Record<ProductStatus, readonly ProductStatus[]>> =
  {
    draft: ['ai_generated', 'pending_review'],
    ai_generated: ['pending_review', 'published'],
    pending_review: ['approved', 'published'],
    approved: ['published'],
    published: ['archived', 'out_of_stock', 'hidden'],
    out_of_stock: ['published', 'archived'],
    hidden: ['published', 'archived'],
    archived: ['draft'],
  };

export function canTransitionProductStatus(from: ProductStatus, to: ProductStatus): boolean {
  return from === to || PRODUCT_STATUS_TRANSITIONS[from].includes(to);
}

/** Ch.8 §20 Product Validation Rules. */
export const PRODUCT_LIMITS = {
  nameMin: 3,
  nameMax: 120,
  descriptionMin: 100,
  imagesMin: 1,
  imagesMax: 20,
  seoTitleMax: 60,
  metaDescriptionMax: 160,
} as const;

export interface AdminProductInput {
  sku: string;
  slug: string;
  name: string;
  shortDescription?: string;
  description: string;
  categoryId: string;
  collectionId?: string;
  basePrice: number;
  salePrice?: number;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword: string;
  featuredImage: string;
  /** Gallery beyond the featured image (Ch.8 §20: 1-20 images total). */
  additionalImages?: string[];
}

/**
 * Ch.8 §20's rules, enforced once here rather than re-implemented at every
 * transport (HTTP admin API today, Telegram AI Assistant in Phase 11) —
 * the handbook's own Product Wizard and Telegram workflow both funnel
 * through "Administrator approves" before the same underlying write, so
 * the write-side rule belongs in the domain layer, not a route schema.
 * Validates whichever fields are present on `input` — every rule is
 * independently gated on the field it checks existing, so this same
 * function serves both full creation (every required field present) and
 * partial updates (only supplied fields get checked).
 */
export function validateAdminProductInput(input: Partial<AdminProductInput>): string[] {
  const violations: string[] = [];

  if (input.name !== undefined) {
    if (input.name.trim().length < PRODUCT_LIMITS.nameMin) {
      violations.push(`Name must be at least ${PRODUCT_LIMITS.nameMin} characters.`);
    }
    if (input.name.length > PRODUCT_LIMITS.nameMax) {
      violations.push(`Name must be at most ${PRODUCT_LIMITS.nameMax} characters.`);
    }
  }
  if (input.slug !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) {
    violations.push('Slug must be lowercase with hyphens only.');
  }
  if (
    input.description !== undefined &&
    input.description.trim().length < PRODUCT_LIMITS.descriptionMin
  ) {
    violations.push(`Description must be at least ${PRODUCT_LIMITS.descriptionMin} characters.`);
  }
  if (input.featuredImage !== undefined || input.additionalImages !== undefined) {
    const totalImages = (input.featuredImage ? 1 : 0) + (input.additionalImages?.length ?? 0);
    if (totalImages < PRODUCT_LIMITS.imagesMin) {
      violations.push('At least one product image is required.');
    }
    if (totalImages > PRODUCT_LIMITS.imagesMax) {
      violations.push(`A product may have at most ${PRODUCT_LIMITS.imagesMax} images.`);
    }
  }
  if (input.categoryId !== undefined && !input.categoryId) {
    violations.push('A primary category is required.');
  }
  if (input.basePrice !== undefined && !(input.basePrice > 0)) {
    violations.push('Price must be greater than zero.');
  }
  if (input.salePrice != null && input.basePrice != null && input.salePrice > input.basePrice) {
    violations.push('Sale price cannot exceed the base price.');
  }
  if (input.seoTitle != null && input.seoTitle.length > PRODUCT_LIMITS.seoTitleMax) {
    violations.push(`SEO title must be at most ${PRODUCT_LIMITS.seoTitleMax} characters.`);
  }
  if (
    input.metaDescription != null &&
    input.metaDescription.length > PRODUCT_LIMITS.metaDescriptionMax
  ) {
    violations.push(
      `Meta description must be at most ${PRODUCT_LIMITS.metaDescriptionMax} characters.`,
    );
  }
  if (input.focusKeyword !== undefined && !input.focusKeyword.trim()) {
    violations.push('A focus keyword is required.');
  }

  return violations;
}

export interface AdminProductFilter {
  status?: ProductStatus;
  search?: string;
}

export interface AdminProductRepository extends ProductRepository {
  create(input: AdminProductInput, actorId: string): Promise<Product>;
  update(id: string, input: Partial<AdminProductInput>, actorId: string): Promise<Product>;
  updateStatus(id: string, status: ProductStatus, actorId: string): Promise<Product>;
  /** True once a product has ever left `draft`/`ai_generated`/`pending_review` — governs SKU immutability (Ch.8 §20). */
  hasBeenPublished(id: string): Promise<boolean>;
  /** Ch.16 §93: admin product list, filterable by status and free-text search — unlike `findPublished`, not restricted to public-facing products. */
  list(filter: AdminProductFilter, pagination: Pagination): Promise<PagedResult<Product>>;
}
