import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';
import { previewCheckoutPricing } from '@/server/checkout/preview-pricing';

/** Read-only pricing preview so the checkout UI can show a live total after "Apply coupon" — startCheckout still recomputes everything fresh when the customer actually pays. */
const bodySchema = z.object({
  lines: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() }))
    .min(1),
  couponCode: z.string().optional(),
});

const couponPreview = createApiRoute({
  bodySchema,
  handler: async ({ body }) =>
    previewCheckoutPricing({
      lines: body.lines,
      ...(body.couponCode ? { couponCode: body.couponCode } : {}),
    }),
});

export async function POST(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'checkout', requireAuth: true });
  if (blocked) return blocked;
  return couponPreview(request);
}
