import Link from 'next/link';
import { EmptyState } from '@/components/states/empty-state';
import { Badge } from '@/components/ui/badge';
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

/** Ch.16 §77 Order History API + Ch.12 §31 My Orders. */
export default async function AccountOrdersPage() {
  const supabase = await createSupabaseServerClient();
  const customer = await getCurrentCustomer(supabase);

  const { data: orders } = customer
    ? await supabase
        .from('orders')
        .select('id, order_number, status, grand_total, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-6">
      <h1 className="text-h2 text-foreground font-bold">My orders</h1>

      {(orders ?? []).length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Browse our collection to place your first order."
          actionLabel="Shop now"
        />
      ) : (
        <div className="divide-border rounded-card border-border divide-y border">
          {(orders ?? []).map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="hover:bg-muted flex items-center justify-between gap-4 p-4"
            >
              <div>
                <p className="text-foreground font-medium">{order.order_number}</p>
                <p className="text-caption text-muted-foreground">₹{order.grand_total}</p>
              </div>
              <Badge variant="outline" className={STATUS_CLASS[order.status] ?? ''}>
                {order.status.replace(/_/g, ' ')}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
