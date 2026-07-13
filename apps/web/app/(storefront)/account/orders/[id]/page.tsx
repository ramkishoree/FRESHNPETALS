import { notFound } from 'next/navigation';
import { ContactUsButton } from '@/components/commerce/contact-us-button';
import { InvoicePreview } from '@/components/commerce/invoice-preview';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getPublicEnv } from '@/config/env';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not yet scheduled';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const customer = await getCurrentCustomer(supabase);
  if (!customer) notFound();

  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, payment_method, subtotal, delivery_fee, tax_total, grand_total, created_at, order_snapshot, order_items(product_name, quantity, line_total), invoices(invoice_number, invoice_url)',
    )
    .eq('id', id)
    .eq('customer_id', customer.id)
    .maybeSingle();

  if (!order) notFound();

  const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
  const items = order.order_items ?? [];
  const delivery = (order.order_snapshot as { delivery?: Record<string, string | null> })?.delivery;
  const paymentMethodLabel = order.payment_method === 'cod' ? 'Cash on delivery' : 'Paid online';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 text-foreground font-bold">{order.order_number}</h1>
          <p className="text-body text-muted-foreground">₹{order.grand_total}</p>
        </div>
        <ContactUsButton ownerPhoneNumber={getPublicEnv().NEXT_PUBLIC_OWNER_PHONE_NUMBER} />
      </div>

      <Card className="rounded-card">
        <CardHeader>
          <h2 className="text-h4 text-foreground font-semibold">Order details</h2>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-caption text-muted-foreground">Order name</dt>
              <dd className="text-body">
                {items.map((item) => item.product_name).join(', ') || 'No items on file'}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Order ID</dt>
              <dd className="text-body">{order.order_number}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Order date</dt>
              <dd className="text-body">{formatDate(order.created_at)}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Payment method</dt>
              <dd className="text-body">{paymentMethodLabel}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Delivery date</dt>
              <dd className="text-body">{formatDate(delivery?.['date'])}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Delivery time</dt>
              <dd className="text-body">{delivery?.['slotLabel'] ?? 'Not yet scheduled'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <InvoicePreview
        invoiceNumber={invoice?.invoice_number ?? order.order_number}
        issuedAt={order.created_at}
        items={items.map((item) => ({
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
