import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/** Ch.16 §108 (Notification Management, "Website Banner") / Ch.6 Announcement Management. */
const schema = z.object({
  title: z.string().max(160).optional(),
  message: z.string().min(1),
  image_url: z.string().optional(),
  offer_id: zUuid().optional(),
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

export const { GET, POST } = createAdminCrudCollectionRoute({
  table: 'announcements',
  service: 'announcements',
  aggregateType: 'announcement',
  filterKeys: ['enabled'],
  trackAttribution: false,
  createSchema: schema,
});
