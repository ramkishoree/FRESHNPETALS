import { z } from 'zod';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/** Ch.16 §105 CMS Management API — static_pages (Homepage/About/Contact/etc.). */
const schema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  layout: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
});

export const { GET, POST } = createAdminCrudCollectionRoute({
  table: 'static_pages',
  service: 'cms',
  aggregateType: 'static_page',
  searchColumns: ['title', 'slug'],
  filterKeys: ['status'],
  trackAttribution: false,
  createSchema: schema,
});
