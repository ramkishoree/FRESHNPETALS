import { z } from 'zod';
import { createAdminCrudItemRoute } from '@/server/http/admin-crud-route';

const schema = z.object({
  title: z.string().max(160).optional(),
  message: z.string().min(1).optional(),
  background_color: z.string().optional(),
  text_color: z.string().optional(),
  button_text: z.string().optional(),
  button_url: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  priority: z.number().int().optional(),
  dismissible: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const { PATCH, DELETE } = createAdminCrudItemRoute({
  table: 'announcements',
  service: 'announcements',
  aggregateType: 'announcement',
  trackAttribution: false,
  updateSchema: schema,
});
