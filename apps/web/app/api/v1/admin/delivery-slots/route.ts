import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/** Ch.16 §106 Delivery Slot Management API. */
const schema = z.object({
  delivery_group_id: zUuid(),
  label: z.string().min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  max_capacity: z.number().int().positive(),
  is_active: z.boolean().optional(),
  holiday_override: z.record(z.string(), z.unknown()).optional(),
});

export const { GET, POST } = createAdminCrudCollectionRoute({
  table: 'delivery_slots',
  service: 'delivery',
  aggregateType: 'delivery_slot',
  filterKeys: ['delivery_group_id', 'is_active'],
  createSchema: schema,
});
