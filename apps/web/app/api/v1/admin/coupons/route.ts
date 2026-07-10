import { z } from 'zod';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/** Ch.16 §102 Coupon Management API. Ch.8 §73-76: coupon engine. */
const schema = z.object({
  code: z.string().min(3).max(40).toUpperCase(),
  description: z.string().optional(),
  discount_type: z.enum(['percentage', 'fixed', 'free_delivery', 'free_gift']),
  discount_value: z.number().min(0),
  max_discount_amount: z.number().positive().optional(),
  min_cart_value: z.number().min(0).optional(),
  usage_limit_total: z.number().int().positive().optional(),
  usage_limit_per_user: z.number().int().positive().optional(),
  applicable_category_id: z.string().uuid().optional(),
  applicable_product_id: z.string().uuid().optional(),
  applicable_outlet_id: z.string().uuid().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

export const { GET, POST } = createAdminCrudCollectionRoute({
  table: 'coupons',
  service: 'coupons',
  aggregateType: 'coupon',
  searchColumns: ['code'],
  filterKeys: ['active'],
  createSchema: schema,
});
