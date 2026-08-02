import Image from 'next/image';
import Link from 'next/link';
import { ContactUsButton } from '@/components/commerce/contact-us-button';
import { EmptyState } from '@/components/states/empty-state';
import { Badge } from '@/components/ui/badge';
import { getPublicEnv } from '@/config/env';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const STATUS_CLASS: Record<string, string> = {
  pending_payment: 'text-muted-foreground',
  paid: 'text-info-text',
  confirmed: 'text-info-text',
  preparing: 'text-warning-text',
  ready: 'text-warning-text',
  out_for_delivery: 'text-warning-text',
  delivered: 'text-success-text',
  completed: 'text-success-text',
  cancelled: 'text-destructive',
  failed: 'text-destructive',
  refunded: 'text-destructive',
};

interface OrderSnapshot {
  address?: { flatNo?: string; formattedAddress?: string };
}

function formatOrderDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Ch.16 §77 Order History API + Ch.12 §31 My Orders.
 *
 * Owner's explicit call: a past order has to be readable without opening
 * it — picture, product name, price, how it was paid, and where it went,
 * all on the card, plus a way to reach the shop about it. The card still
 * links through to the full order detail (invoice, timeline, per-line
 * totals) for anything deeper than that.
 */
export default async function AccountOrdersPage() {
  const supabase = await createSupabaseServerClient();
  const customer = await getCurrentCustomer(supabase);

  const { data: orders } = customer
    ? await supabase
        .from('orders')
        .select(
          'id, order_number, status, payment_method, grand_total, created_at, order_snapshot, order_items(product_name, quantity, products(featured_image))',
        )
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  const ownerPhoneNumber = getPublicEnv().NEXT_PUBLIC_OWNER_PHONE_NUMBER;

  return (
    <div className="space-y-6">
      <h1 className="text-h2 text-foreground font-bold">My orders</h1>

      {(orders ?? []).length === 0 ? (
        // `actionLabel` without an `onAction` handler renders no button at
        // all, and this is a Server Component so it can't supply one — a
        // plain link is the working equivalent.
        <div className="space-y-4">
          <EmptyState
            title="No orders yet"
            description="Browse our collection to place your first order."
          />
          <div className="text-center">
            <Link href="/" className="text-body text-primary hover:underline">
              Browse products
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {(orders ?? []).map((order) => {
            const items = order.order_items ?? [];
            const snapshot = order.order_snapshot as OrderSnapshot | null;
            const address =
              [snapshot?.address?.flatNo, snapshot?.address?.formattedAddress]
                .filter(Boolean)
                .join(', ') || 'No address on file';
            const paymentLabel =
              order.payment_method === 'cod' ? 'Cash on delivery' : 'Paid online';

            return (
              <article
                key={order.id}
                className="rounded-card border-border space-y-4 border p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="text-foreground font-medium hover:underline"
                    >
                      {order.order_number}
                    </Link>
                    <p className="text-caption text-muted-foreground">
                      {formatOrderDate(order.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className={STATUS_CLASS[order.status] ?? ''}>
                    {order.status.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <ul className="space-y-3">
                  {items.map((item, index) => {
                    const product = Array.isArray(item.products) ? item.products[0] : item.products;
                    return (
                      <li key={index} className="flex items-center gap-4">
                        {product?.featured_image ? (
                          <Image
                            src={product.featured_image}
                            alt={item.product_name}
                            width={72}
                            height={72}
                            className="rounded-card size-18 shrink-0 object-cover"
                          />
                        ) : (
                          <div className="rounded-card bg-muted size-18 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-body text-foreground">{item.product_name}</p>
                          {item.quantity > 1 && (
                            <p className="text-caption text-muted-foreground">
                              Qty {item.quantity}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <dl className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-caption text-muted-foreground">Total paid</dt>
                    <dd className="text-body text-foreground font-medium">₹{order.grand_total}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">Payment</dt>
                    <dd className="text-body">{paymentLabel}</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-caption text-muted-foreground">Delivered to</dt>
                    <dd className="text-body">{address}</dd>
                  </div>
                </dl>

                <ContactUsButton ownerPhoneNumber={ownerPhoneNumber} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
