import { z } from 'zod';
import { createAdminCrudItemRoute } from '@/server/http/admin-crud-route';

const schema = z.object({
  label: z.string().min(1).optional(),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional(),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional(),
  max_capacity: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
  holiday_override: z.record(z.string(), z.unknown()).optional(),
});

export const { PATCH, DELETE } = createAdminCrudItemRoute({
  table: 'delivery_slots',
  service: 'delivery',
  aggregateType: 'delivery_slot',
  updateSchema: schema,
});
