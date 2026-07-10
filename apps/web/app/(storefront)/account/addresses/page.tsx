import { AddressManager } from '@/components/storefront/address-manager';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Ch.16 §73 Address API + Ch.12 §27 Address Selection. */
export default async function AccountAddressesPage() {
  const supabase = await createSupabaseServerClient();
  const customer = await getCurrentCustomer(supabase);

  const { data: addresses } = customer
    ? await supabase
        .from('customer_addresses')
        .select(
          'id, label, recipient_name, phone, address_line_1, address_line_2, city, state, postal_code, is_default',
        )
        .eq('customer_id', customer.id)
        .is('deleted_at', null)
        .order('is_default', { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-6">
      <h1 className="text-h2 text-foreground font-bold">Addresses</h1>
      <AddressManager initialAddresses={addresses ?? []} />
    </div>
  );
}
