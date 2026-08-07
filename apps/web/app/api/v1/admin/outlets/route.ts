import { z } from 'zod';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/**
 * Ch.16 §96 Outlet Management API. latitude/longitude are no longer
 * admin-entered — nobody should have to type exact coordinates by hand.
 * They default to Lucknow's city centre on create and get overwritten
 * with the real value the moment the outlet is linked to its Google
 * Business Profile (link-google-place/route.ts), which is where the
 * precise coordinates actually come from now.
 */
const schema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().optional(),
  country: z.string().length(2).optional(),
  latitude: z.number().min(-90).max(90).default(26.8467),
  longitude: z.number().min(-180).max(180).default(80.9462),
  delivery_radius_km: z.number().positive().optional(),
  working_hours: z.record(z.string(), z.unknown()).optional(),
  timezone: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  is_active: z.boolean().optional(),
  google_cover_photo_url: z.string().optional(),
  // Set when the shop is too new for the Places API to find; the review
  // sweep retries it and clears it once a place_id resolves.
  google_place_query: z.string().max(300).optional(),
  // Whether this outlet's Google reviews appear on the storefront.
  show_google_reviews: z.boolean().optional(),
});

export const { GET, POST } = createAdminCrudCollectionRoute({
  table: 'outlets',
  service: 'outlets',
  aggregateType: 'outlet',
  searchColumns: ['name', 'city'],
  filterKeys: ['is_active'],
  createSchema: schema,
});
