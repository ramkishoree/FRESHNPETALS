import { notFound } from 'next/navigation';
import { OrderStatusControl } from '@/components/admin/order-status-control';
import { OrderTimeline, type OrderTimelineProps } from '@/components/commerce/order-timeline';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const [{ data: order }, { data: events }] = await Promise.all([
    admin
      .from('orders')
      .select('id, order_number, status, grand_total, notes, created_at')
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('order_events')
      .select('new_state, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!order) notFound();

  const timestamps: Record<string, string> = {};
  for (const event of events ?? []) {
    const state = event.new_state as string | null;
    if (state && !timestamps[state]) timestamps[state] = event.created_at as string;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 text-foreground font-bold">{order.order_number}</h1>
        <p className="text-body text-muted-foreground">₹{order.grand_total}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-card">
          <CardHeader>
            <h2 className="text-h4 text-foreground font-semibold">Timeline</h2>
          </CardHeader>
          <CardContent>
            <OrderTimeline
              status={order.status as OrderTimelineProps['status']}
              timestamps={timestamps}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-h4 text-foreground font-semibold">Manage order</h2>
          <OrderStatusControl
            orderId={order.id}
            currentStatus={order.status}
            initialNotes={order.notes ?? ''}
          />
        </div>
      </div>
    </div>
  );
}
