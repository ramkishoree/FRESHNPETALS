import Link from 'next/link';
import { AccountSignOutButton } from '@/components/storefront/account-sign-out-button';
import { AddressManager, type SavedAddress } from '@/components/storefront/address-manager';
import { ProfileForm } from '@/components/storefront/profile-form';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Ch.16 §72 Customer Profile API + §73 Address API.
 *
 * Owner's explicit call for the revamp: My Account does exactly two
 * things — change your name, and manage the saved addresses that
 * checkout can replay. Both live on this one page rather than behind
 * sub-navigation, since there is nothing else here to navigate between.
 */
export default async function AccountOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const customer = await getCurrentCustomer(supabase);
  const { confirmed } = await searchParams;

  const { data: addresses } = customer
    ? await supabase
        .from('customer_addresses')
        .select(
          'id, label, recipient_name, phone, address_line_1, address_line_2, latitude, longitude, is_default',
        )
        .eq('customer_id', customer.id)
        .is('deleted_at', null)
        .order('is_default', { ascending: false })
    : { data: [] };

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

      <section className="space-y-4">
        <div>
          <h2 className="text-h4 text-foreground font-semibold">Saved addresses</h2>
          <p className="text-caption text-muted-foreground">
            Pick any of these at checkout instead of pinning the map again.
          </p>
        </div>
        <AddressManager initialAddresses={(addresses ?? []) as SavedAddress[]} />
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
