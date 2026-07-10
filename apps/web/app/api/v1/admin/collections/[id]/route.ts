import { z } from 'zod';
import { createAdminCrudItemRoute } from '@/server/http/admin-crud-route';

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().optional(),
  hero_image: z.string().optional(),
  is_featured: z.boolean().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
});

export const { PATCH, DELETE } = createAdminCrudItemRoute({
  table: 'collections',
  service: 'collections',
  aggregateType: 'collection',
  updateSchema: schema,
});
