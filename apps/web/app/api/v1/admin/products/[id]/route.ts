import {
  deriveSeoDefaults,
  UpdateProductService,
  UpdateProductStatusService,
  type Product,
  type ProductStatus,
} from '@prana/commerce';
import { type AppError, BusinessRuleError, isOk, ok, type Result } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { stripUndefined } from '@/lib/strip-undefined';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { createApiRoute } from '@/server/http/route-handler';
import { SupabaseAdminProductRepository } from '@/server/repositories/supabase-admin-product-repository';
import { runSecurityChain } from '@/server/security/chain';

const PRODUCT_STATUSES = [
  'draft',
  'ai_generated',
  'pending_review',
  'approved',
  'published',
  'archived',
  'out_of_stock',
  'hidden',
] as const satisfies readonly ProductStatus[];

const patchBodySchema = z.object({
  sku: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  name: z.string().min(3).max(120).optional(),
  shortDescription: z.string().optional(),
  color: z.string().max(60).optional(),
  // Owner-only packing details — never returned by a storefront query.
  flowerType: z.string().max(60).optional(),
  sizeLabel: z.string().max(60).optional(),
  packaging: z.string().max(60).optional(),
  ownerNote: z.string().max(500).optional(),
  description: z.string().min(100).optional(),
  categoryId: zUuid().optional(),
  collectionId: zUuid().optional(),
  basePrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  seoTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  focusKeyword: z.string().min(1).optional(),
  featuredImage: z.string().min(1).optional(),
  additionalImages: z.array(z.string()).max(19).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

interface RouteParams {
  id: string;
}

/**
 * PATCH /api/v1/admin/products/{id} — Ch.16 §93: "Updates Any Product
 * Field", one endpoint for both field edits and status transitions (the
 * handbook doesn't split them). DELETE is the same section's "Soft
 * Delete" — modeled as the `archived` status transition rather than a
 * second code path, since Ch.8 §16 already treats Archived as a real
 * state in the same machine, not a separate deleted-flag.
 */
const updateProduct = createApiRoute<
  undefined,
  Product,
  z.infer<typeof patchBodySchema>,
  RouteParams
>({
  bodySchema: patchBodySchema,
  handler: async ({ body, request, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseAdminProductRepository(admin);
    const { status, ...fields } = body;

    // Owner's explicit call: no manual SEO entry — whenever the admin
    // resubmits name+description (every save from the current form),
    // re-derive seoTitle/metaDescription/focusKeyword unless the caller
    // explicitly set one, so SEO metadata stays in sync automatically
    // instead of going stale after a rename.
    const seoFields =
      fields.name !== undefined && fields.description !== undefined
        ? deriveSeoDefaults(fields.name, fields.description, fields.shortDescription)
        : undefined;

    let result: Result<Product, AppError>;
    if (Object.keys(fields).length > 0) {
      result = await new UpdateProductService(repository).execute(
        params.id,
        stripUndefined({
          ...fields,
          ...(seoFields
            ? {
                seoTitle: fields.seoTitle ?? seoFields.seoTitle,
                metaDescription: fields.metaDescription ?? seoFields.metaDescription,
                focusKeyword: fields.focusKeyword ?? seoFields.focusKeyword,
              }
            : {}),
        }),
        actor.id,
      );
    } else {
      const current = await repository.findById(params.id);
      result = current
        ? ok(current)
        : { ok: false, error: new BusinessRuleError('Product not found.', { httpStatus: 404 }) };
    }

    if (isOk(result) && status !== undefined) {
      result = await new UpdateProductStatusService(repository).execute(
        params.id,
        status,
        actor.id,
      );
    }

    if (isOk(result)) {
      await recordAuditEvent({
        eventType: status !== undefined ? 'admin.product.status_changed' : 'admin.product.updated',
        aggregateType: 'product',
        aggregateId: params.id,
        actor,
        service: 'products',
        next: body,
        request,
      });
    }

    return result;
  },
});

const archiveProduct = createApiRoute<undefined, Product, undefined, RouteParams>({
  handler: async ({ request, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseAdminProductRepository(admin);
    const result = await new UpdateProductStatusService(repository).execute(
      params.id,
      'archived',
      actor.id,
    );

    if (isOk(result)) {
      await recordAuditEvent({
        eventType: 'admin.product.archived',
        aggregateType: 'product',
        aggregateId: params.id,
        actor,
        service: 'products',
        severity: 'warning',
        request,
      });
    }

    return result;
  },
});

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return updateProduct(request, await context.params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return archiveProduct(request, await context.params);
}
