import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createAdminCrudItemRoute } from '@/server/http/admin-crud-route';

const schema = z.object({
  description: z.string().optional(),
  discount_type: z.enum(['percentage', 'fixed', 'free_delivery', 'free_gift']).optional(),
  discount_value: z.number().min(0).optional(),
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

export const { PATCH, DELETE } = createAdminCrudItemRoute({
  table: 'coupons',
  service: 'coupons',
  aggregateType: 'coupon',
  updateSchema: schema,
});
