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
  google_cover_photo_url: z.string().optional(),
  // Was missing, so the picker's "note it and link later" PATCH was
  // silently dropped — an unknown key never reaches the table.
  google_place_query: z.string().max(300).nullable().optional(),
});

// `show_google_reviews` is deliberately absent: enabling one outlet
// disables every other, which is a decision about the whole set rather
// than an edit to one row. It has its own endpoint (reviews-source).

export const { PATCH, DELETE } = createAdminCrudItemRoute({
  table: 'outlets',
  service: 'outlets',
  aggregateType: 'outlet',
  updateSchema: schema,
});
