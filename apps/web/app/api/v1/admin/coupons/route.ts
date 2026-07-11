import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/** Ch.16 §102 Coupon Management API. Ch.8 §73-76: coupon engine. */
const schema = z.object({
  code: z.string().min(3).max(40).toUpperCase(),
  description: z.string().optional(),
  discount_type: z.enum(['percentage', 'fixed', 'free_delivery', 'free_gift']),
  discount_value: z.number().min(0),
  // Ch.8 §73: who the coupon is for, separate from how much it takes off
  // (discount_type/discount_value above) — a corporate coupon can still
  // be percentage or fixed, for example.
  eligibility_type: z
    .enum(['general', 'first_order', 'birthday', 'corporate', 'influencer', 'employee'])
    .optional(),
  max_discount_amount: z.number().positive().optional(),
  min_cart_value: z.number().min(0).optional(),
  usage_limit_total: z.number().int().positive().optional(),
  usage_limit_per_user: z.number().int().positive().optional(),
  applicable_category_id: zUuid().optional(),
  applicable_product_id: zUuid().optional(),
  applicable_outlet_id: zUuid().optional(),
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
