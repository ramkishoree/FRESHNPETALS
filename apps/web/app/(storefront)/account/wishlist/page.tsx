import { WishlistGrid } from '@/components/storefront/wishlist-grid';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Ch.16 §79 Wishlist API + Ch.12 §32. */
export default async function AccountWishlistPage() {
  const supabase = await createSupabaseServerClient();
  const customer = await getCurrentCustomer(supabase);

  const { data } = customer
    ? await supabase
        .from('wishlists')
        .select(
          'id, products(id, slug, name, featured_image, status, product_prices(base_price, sale_price), inventory(available_quantity))',
        )
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-6">
      <h1 className="text-h2 text-foreground font-bold">Wishlist</h1>
      <WishlistGrid entries={data ?? []} />
    </div>
  );
}
