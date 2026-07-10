import { z } from 'zod';
import { createAdminCrudItemRoute } from '@/server/http/admin-crud-route';

const schema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().optional(),
  offer_type: z
    .enum(['percentage', 'fixed', 'buy_x_get_y', 'free_gift', 'free_delivery'])
    .optional(),
  priority: z.number().int().optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  reward: z.record(z.string(), z.unknown()).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

export const { PATCH, DELETE } = createAdminCrudItemRoute({
  table: 'offers',
  service: 'offers',
  aggregateType: 'offer',
  updateSchema: schema,
});
