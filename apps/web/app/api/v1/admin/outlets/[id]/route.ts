import { z } from 'zod';
import { createAdminCrudItemRoute } from '@/server/http/admin-crud-route';

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().optional(),
  country: z.string().length(2).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  delivery_radius_km: z.number().positive().optional(),
  working_hours: z.record(z.string(), z.unknown()).optional(),
  timezone: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  is_active: z.boolean().optional(),
});

export const { PATCH, DELETE } = createAdminCrudItemRoute({
  table: 'outlets',
  service: 'outlets',
  aggregateType: 'outlet',
  updateSchema: schema,
});
