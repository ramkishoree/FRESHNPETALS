import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { CheckoutFlow } from '@/components/storefront/checkout-flow';
import { getCurrentUser } from '@/server/auth/session';

/**
 * Ch.12 §26 Checkout Experience. `proxy.ts` doesn't gate `/checkout`
 * itself (only `/account`/`/admin`) since a guest can browse and add to
 * cart — but paying requires a session (Ch.8 §92's pipeline needs a
 * `customer_id`), so this page-level check sends an unauthenticated
 * visitor to sign in first rather than letting the client-side "Pay now"
 * button fail with a confusing 401.
 */
export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/checkout');
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <div className="container-brand py-10">
      <h1 className="text-h2 text-foreground mb-6 font-bold">Checkout</h1>
      <CheckoutFlow {...(nonce ? { nonce } : {})} />
    </div>
  );
}
