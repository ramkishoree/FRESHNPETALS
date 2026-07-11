import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createAdminCrudItemRoute } from '@/server/http/admin-crud-route';

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional(),
  parent_id: zUuid().optional(),
  description: z.string().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export const { PATCH, DELETE } = createAdminCrudItemRoute({
  table: 'categories',
  service: 'categories',
  aggregateType: 'category',
  updateSchema: schema,
});
