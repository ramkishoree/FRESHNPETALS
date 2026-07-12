import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/**
 * Ch.16 §100 Category Management API. Field names match `categories`'
 * columns directly (snake_case) — this generic Tier-B route has no
 * domain-layer DTO to translate to/from (see admin-crud-repository.ts);
 * Tier A resources with real business logic (Products, Inventory, Orders)
 * keep the camelCase domain-shaped request bodies.
 */
const schema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  parent_id: zUuid().optional(),
  description: z.string().optional(),
  image_url: z.string().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export const { GET, POST } = createAdminCrudCollectionRoute({
  table: 'categories',
  service: 'categories',
  aggregateType: 'category',
  searchColumns: ['name', 'slug'],
  createSchema: schema,
});
