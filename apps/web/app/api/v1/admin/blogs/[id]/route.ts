import { z } from 'zod';
import { createAdminCrudItemRoute } from '@/server/http/admin-crud-route';

const BLOG_STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const;

const schema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional(),
  excerpt: z.string().optional(),
  featured_image: z.string().optional(),
  author: z.string().uuid().optional(),
  status: z.enum(BLOG_STATUSES).optional(),
  reading_time_minutes: z.number().int().positive().optional(),
  published_at: z.string().datetime().optional(),
  scheduled_at: z.string().datetime().optional(),
});

export const { PATCH, DELETE } = createAdminCrudItemRoute({
  table: 'blogs',
  service: 'blogs',
  aggregateType: 'blog',
  trackAttribution: false,
  updateSchema: schema,
});
