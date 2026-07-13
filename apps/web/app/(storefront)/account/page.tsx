import Link from 'next/link';
import { AccountSignOutButton } from '@/components/storefront/account-sign-out-button';
import { Card, CardContent } from '@/components/ui/card';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Ch.16 §72 Customer Profile API — account overview + navigation into the rest of Ch.6/§Account IA. */
export default async function AccountOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const customer = await getCurrentCustomer(supabase);
  const { confirmed } = await searchParams;

  return (
    <div className="space-y-8">
      {confirmed === '1' && (
        <div className="rounded-card border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-700">
          Email confirmed! You&apos;re all set.
        </div>
      )}
      <div>
        <h1 className="text-h2 text-foreground font-bold">My account</h1>
        {customer?.email && <p className="text-body text-muted-foreground">{customer.email}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AccountLink
          href="/account/orders"
          label="My orders"
          description="Track and review past orders."
        />
        <AccountLink
          href="/account/addresses"
          label="Addresses"
          description="Manage saved delivery addresses."
        />
        <AccountLink
          href="/account/wishlist"
          label="Wishlist"
          description="Products you've saved."
        />
      </div>

      <AccountSignOutButton />
    </div>
  );
}

function AccountLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="rounded-card hover:bg-muted h-full transition-colors">
        <CardContent className="space-y-1 pt-6">
          <p className="text-body text-foreground font-semibold">{label}</p>
          <p className="text-caption text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
