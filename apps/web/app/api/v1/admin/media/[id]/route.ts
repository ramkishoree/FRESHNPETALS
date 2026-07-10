import { z } from 'zod';
import { createAdminCrudItemRoute } from '@/server/http/admin-crud-route';

const schema = z.object({
  alt_text: z.string().optional(),
  tags: z.array(z.string()).optional(),
  cdn_url: z.string().optional(),
});

export const { PATCH, DELETE } = createAdminCrudItemRoute({
  table: 'media_library',
  service: 'media',
  aggregateType: 'media_asset',
  trackAttribution: false,
  updateSchema: schema,
});
