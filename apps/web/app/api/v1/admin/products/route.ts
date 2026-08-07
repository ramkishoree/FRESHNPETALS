import {
  CreateProductService,
  deriveSeoDefaults,
  ListAdminProductsService,
  type ProductStatus,
} from '@prana/commerce';
import { isOk } from '@prana/core';
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

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  search: z.string().min(1).max(200).optional(),
});

const createBodySchema = z.object({
  sku: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(3).max(120),
  shortDescription: z.string().optional(),
  color: z.string().max(60).optional(),
  // Owner-only packing details — never returned by a storefront query.
  ownerDescription: z.string().max(1000).optional(),
  description: z.string().min(100),
  categoryId: zUuid(),
  collectionId: zUuid().optional(),
  basePrice: z.number().positive(),
  salePrice: z.number().positive().optional(),
  seoTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  focusKeyword: z.string().min(1).optional(),
  featuredImage: z.string().min(1),
  additionalImages: z.array(z.string()).max(19).optional(),
});

/**
 * GET/POST /api/v1/admin/products — Ch.16 §93 Product Management API.
 * Every write is audited (Ch.8 §117) via event_store, and gated on the
 * admin-only security chain tier below.
 */
const listProducts = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseAdminProductRepository(admin);
    const service = new ListAdminProductsService(repository);
    return service.execute(
      {
        ...(query.status ? { status: query.status } : {}),
        ...(query.search ? { search: query.search } : {}),
      },
      { limit: query.limit, ...(query.cursor ? { cursor: query.cursor } : {}) },
    );
  },
});

const createProduct = createApiRoute({
  bodySchema: createBodySchema,
  handler: async ({ body, request }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseAdminProductRepository(admin);
    const service = new CreateProductService(repository);
    const seoDefaults = deriveSeoDefaults(body.name, body.description, body.shortDescription);
    const result = await service.execute(
      stripUndefined({
        ...body,
        seoTitle: body.seoTitle ?? seoDefaults.seoTitle,
        metaDescription: body.metaDescription ?? seoDefaults.metaDescription,
        focusKeyword: body.focusKeyword ?? seoDefaults.focusKeyword,
      }),
      actor.id,
    );

    if (isOk(result)) {
      await recordAuditEvent({
        eventType: 'admin.product.created',
        aggregateType: 'product',
        aggregateId: result.value.id,
        actor,
        service: 'products',
        next: body,
        request,
      });
    }

    return result;
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return listProducts(request);
}

export async function POST(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return createProduct(request);
}
