import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { CheckoutFlow } from '@/components/storefront/checkout-flow';
import { getPublicEnv } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/auth/session';
import { getRateConfig } from '@/server/checkout/get-rate-config';

/**
 * Ch.12 §26 Checkout Experience. `proxy.ts` doesn't gate `/checkout`
 * itself (only `/account`/`/admin`) since a guest can browse and add to
 * cart — but paying requires a session (Ch.8 §92's pipeline needs a
 * `customer_id`), so this page-level check sends an unauthenticated
 * visitor to sign in first rather than letting the client-side "Pay now"
 * button fail with a confusing 401.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ retry?: string }>;
}) {
  const { retry } = await searchParams;
  // Guests buy without an account (Ch.8: never force registration) — a
  // `customers` row is created from the address they fill in. Only the
  // retry path still needs a session, because it reopens a payment
  // against an existing checkout that was scoped to someone.
  if (retry) {
    const user = await getCurrentUser();
    if (!user) {
      redirect(`/login?next=${encodeURIComponent(`/checkout?retry=${encodeURIComponent(retry)}`)}`);
    }
  }
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  // Read here rather than in the client component: only a literal
  // `process.env.NEXT_PUBLIC_*` reference is inlined into the browser
  // bundle, and `getPublicEnv` reads it dynamically.
  const ownerPhoneNumber = getPublicEnv().NEXT_PUBLIC_OWNER_PHONE_NUMBER;

  // The same rates start-checkout prices the order with, handed to the
  // outlet cards so the fee they advertise is the fee that gets charged.
  // They were quoting `@prana/commerce`'s fallback constants instead, so
  // a 5.2km delivery showed ₹55 on the card and ₹60 in the summary.
  // Read through the admin client because `system_settings` is not
  // readable by anon; nothing here is secret — every one of these
  // numbers is already on screen in the order summary.
  const { standardDeliveryKm, standardDeliveryFee, perKmFee } = await getRateConfig(
    createSupabaseAdminClient(),
  );

  return (
    // No page-level <h1> here: CheckoutFlow's own banner already carries
    // one, and two of them meant the word "Checkout" was rendered twice,
    // one above the other, with two competing top-level headings for a
    // screen reader and for search.
    <div className="container-brand py-10">
      <CheckoutFlow
        {...(nonce ? { nonce } : {})}
        {...(ownerPhoneNumber ? { ownerPhoneNumber } : {})}
        deliveryRates={{ standardDeliveryKm, standardDeliveryFee, perKmFee }}
      />
    </div>
  );
}
