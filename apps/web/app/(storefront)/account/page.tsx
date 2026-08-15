import Link from 'next/link';
import { AccountSignOutButton } from '@/components/storefront/account-sign-out-button';
import { ProfileForm } from '@/components/storefront/profile-form';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Ch.16 §72 Customer Profile API + §73 Address API.
 *
 * Owner's explicit call: My Account does exactly one thing — change
 * your name. Saved addresses were removed; every order's address comes
 * from the map pin at checkout, which is also what the delivery fee is
 * measured from, so a replayed address could only ever disagree with
 * the pin that priced it.
 */
export default async function AccountOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const customer = await getCurrentCustomer(supabase);
  const { confirmed } = await searchParams;

  return (
    <div className="space-y-10">
      {confirmed === '1' && (
        <div className="rounded-card border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-700">
          Email confirmed! You&apos;re all set.
        </div>
      )}

      <h1 className="text-h2 text-foreground font-bold">My account</h1>

      <section className="space-y-4">
        <h2 className="text-h4 text-foreground font-semibold">Your details</h2>
        <ProfileForm
          initialFirstName={customer?.firstName ?? ''}
          initialLastName={customer?.lastName ?? ''}
          initialPhone={customer?.phone ?? ''}
          email={customer?.email ?? null}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-h4 text-foreground font-semibold">Elsewhere</h2>
        <div className="flex flex-wrap gap-4">
          <Link href="/account/orders" className="text-body text-primary hover:underline">
            My orders
          </Link>
          <Link href="/account/wishlist" className="text-body text-primary hover:underline">
            Wishlist
          </Link>
        </div>
      </section>

      <AccountSignOutButton />
    </div>
  );
}
