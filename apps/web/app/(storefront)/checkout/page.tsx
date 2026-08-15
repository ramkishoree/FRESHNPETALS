import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { CheckoutFlow } from '@/components/storefront/checkout-flow';
import { getPublicEnv } from '@/config/env';
import { getCurrentUser } from '@/server/auth/session';

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

  return (
    <div className="container-brand py-10">
      <h1 className="text-h2 text-foreground mb-6 font-bold">Checkout</h1>
      <CheckoutFlow
        {...(nonce ? { nonce } : {})}
        {...(ownerPhoneNumber ? { ownerPhoneNumber } : {})}
      />
    </div>
  );
}
