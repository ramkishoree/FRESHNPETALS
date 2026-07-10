import { z } from 'zod';
import { createAdminCrudItemRoute } from '@/server/http/admin-crud-route';

const schema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional(),
  layout: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
});

export const { PATCH, DELETE } = createAdminCrudItemRoute({
  table: 'static_pages',
  service: 'cms',
  aggregateType: 'static_page',
  trackAttribution: false,
  updateSchema: schema,
});
