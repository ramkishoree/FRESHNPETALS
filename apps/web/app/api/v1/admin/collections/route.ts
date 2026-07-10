import { z } from 'zod';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/** Ch.16 §101 Collection Management API. */
const schema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().optional(),
  hero_image: z.string().optional(),
  is_featured: z.boolean().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
});

export const { GET, POST } = createAdminCrudCollectionRoute({
  table: 'collections',
  service: 'collections',
  aggregateType: 'collection',
  searchColumns: ['name', 'slug'],
  createSchema: schema,
});
