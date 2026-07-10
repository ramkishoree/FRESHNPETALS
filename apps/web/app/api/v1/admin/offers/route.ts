import { z } from 'zod';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/** Ch.16 §103 Offer Management API. Ch.8 §69-72: offer engine. */
const schema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().optional(),
  offer_type: z.enum(['percentage', 'fixed', 'buy_x_get_y', 'free_gift', 'free_delivery']),
  priority: z.number().int().optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  reward: z.record(z.string(), z.unknown()).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

export const { GET, POST } = createAdminCrudCollectionRoute({
  table: 'offers',
  service: 'offers',
  aggregateType: 'offer',
  searchColumns: ['name'],
  filterKeys: ['active', 'offer_type'],
  createSchema: schema,
});
