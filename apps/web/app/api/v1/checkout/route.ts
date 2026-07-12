import { BusinessRuleError, err } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { stripUndefined } from '@/lib/strip-undefined';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';
import { startCheckout } from '@/server/checkout/start-checkout';

/** Ch.16 §62 Checkout API — "Checkout protected by idempotency" (Ch.8 §102) is the payment webhook's job, not this endpoint's; this endpoint's own job is Ch.8 §92's pipeline up through "Create Razorpay Order." */
const bodySchema = z.object({
  lines: z.array(z.object({ productId: zUuid(), quantity: z.number().int().positive() })).min(1),
  address: z.object({
    recipientName: z.string().min(1),
    phone: z.string().min(6),
    email: z.string().email(),
    flatNo: z.string().optional(),
    formattedAddress: z.string().min(1),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  couponCode: z.string().optional(),
  deliverySlotId: zUuid().optional(),
  /** Customer-selected outlet (picked from the outlet selector). When
   *  omitted the server auto-selects the nearest outlet with stock. */
  selectedOutletId: zUuid().optional(),
});

const checkout = createApiRoute({
  bodySchema,
  handler: async ({ body }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    return startCheckout({
      customerId: customer.id,
      lines: body.lines,
      address: stripUndefined(body.address),
      ...(body.couponCode ? { couponCode: body.couponCode } : {}),
      ...(body.deliverySlotId ? { deliverySlotId: body.deliverySlotId } : {}),
      ...(body.selectedOutletId ? { selectedOutletId: body.selectedOutletId } : {}),
    });
  },
});

export async function POST(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'checkout', requireAuth: true });
  if (blocked) return blocked;
  return checkout(request);
}
