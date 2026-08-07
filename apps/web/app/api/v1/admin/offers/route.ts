import { z } from 'zod';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/** Ch.16 §103 Offer Management API. Ch.8 §69-72: offer engine. */
const schema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().optional(),
  // Defaults to 'display' so the simplified admin form doesn't have to
  // ask. The engine-facing types still work for offers created before
  // this change, or through the API directly.
  offer_type: z
    .enum(['percentage', 'fixed', 'buy_x_get_y', 'free_gift', 'free_delivery', 'display'])
    .default('display'),
  // True for anything written in the admin form: advertised via a coupon
  // code, never applied automatically to a customer's total.
  display_only: z.boolean().default(true),
  priority: z.number().int().optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  reward: z.record(z.string(), z.unknown()).optional(),
  tagline: z.string().max(160).optional(),
  banner_heading: z.string().max(160).optional(),
  coupon_code: z.string().max(60).optional(),
  conditions_text: z.string().max(2000).optional(),
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
