import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

const BLOG_STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const;

/** Ch.16 §104 Blog Management API. Ch.12 §51 Blog Module. */
const schema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  excerpt: z.string().optional(),
  featured_image: z.string().optional(),
  author: zUuid().optional(),
  status: z.enum(BLOG_STATUSES).optional(),
  reading_time_minutes: z.number().int().positive().optional(),
  published_at: z.string().datetime().optional(),
  scheduled_at: z.string().datetime().optional(),
});

export const { GET, POST } = createAdminCrudCollectionRoute({
  table: 'blogs',
  service: 'blogs',
  aggregateType: 'blog',
  searchColumns: ['title', 'slug'],
  filterKeys: ['status'],
  trackAttribution: false,
  createSchema: schema,
});
