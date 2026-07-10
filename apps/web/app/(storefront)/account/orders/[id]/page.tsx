import { notFound } from 'next/navigation';
import { OrderTimeline, type OrderTimelineProps } from '@/components/commerce/order-timeline';
import { InvoicePreview } from '@/components/commerce/invoice-preview';
import { WhatsAppSupportButton } from '@/components/commerce/whatsapp-support-button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getPublicEnv } from '@/config/env';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const customer = await getCurrentCustomer(supabase);
  if (!customer) notFound();

  const [{ data: order }, { data: events }] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, order_number, status, subtotal, delivery_fee, tax_total, grand_total, created_at, order_items(product_name, quantity, line_total), invoices(invoice_number, invoice_url)',
      )
      .eq('id', id)
      .eq('customer_id', customer.id)
      .maybeSingle(),
    supabase
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

  const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 text-foreground font-bold">{order.order_number}</h1>
          <p className="text-body text-muted-foreground">₹{order.grand_total}</p>
        </div>
        <WhatsAppSupportButton
          orderNumber={order.order_number}
          whatsappBusinessNumber={getPublicEnv().NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER}
        />
      </div>

      <Card className="rounded-card">
        <CardHeader>
          <h2 className="text-h4 text-foreground font-semibold">Order status</h2>
        </CardHeader>
        <CardContent>
          <OrderTimeline
            status={order.status as OrderTimelineProps['status']}
            timestamps={timestamps}
          />
        </CardContent>
      </Card>

      <InvoicePreview
        invoiceNumber={invoice?.invoice_number ?? order.order_number}
        issuedAt={order.created_at}
        items={(order.order_items ?? []).map((item) => ({
          name: item.product_name,
          quantity: item.quantity,
          lineTotal: Number(item.line_total),
        }))}
        subtotal={Number(order.subtotal)}
        taxTotal={Number(order.tax_total)}
        deliveryFee={Number(order.delivery_fee)}
        grandTotal={Number(order.grand_total)}
        invoiceUrl={invoice?.invoice_url ?? null}
      />
    </div>
  );
}
