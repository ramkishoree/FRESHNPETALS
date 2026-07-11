import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';
import { previewCheckoutPricing } from '@/server/checkout/preview-pricing';

/** Read-only pricing preview so the checkout UI can show a live total after "Apply coupon" — startCheckout still recomputes everything fresh when the customer actually pays. */
const bodySchema = z.object({
  lines: z.array(z.object({ productId: zUuid(), quantity: z.number().int().positive() })).min(1),
  couponCode: z.string().optional(),
  /** Delivery pin coordinates from Google Maps. */
  addressLatitude: z.number().min(-90).max(90).optional(),
  addressLongitude: z.number().min(-180).max(180).optional(),
  /** When the customer has picked a specific outlet, use it for distance calculation. */
  selectedOutletId: zUuid().optional(),
});

const couponPreview = createApiRoute({
  bodySchema,
  handler: async ({ body }) =>
    previewCheckoutPricing({
      lines: body.lines,
      ...(body.couponCode ? { couponCode: body.couponCode } : {}),
      ...(body.addressLatitude != null && body.addressLongitude != null
        ? { addressLatitude: body.addressLatitude, addressLongitude: body.addressLongitude }
        : {}),
      ...(body.selectedOutletId ? { selectedOutletId: body.selectedOutletId } : {}),
    }),
});

export async function POST(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'checkout', requireAuth: true });
  if (blocked) return blocked;
  return couponPreview(request);
}
