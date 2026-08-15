import { notFound } from 'next/navigation';
import { DeliveryAddress } from '@/components/commerce/delivery-address';
import { InvoicePreview } from '@/components/commerce/invoice-preview';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not yet scheduled';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Order confirmation for someone who bought without an account.
 *
 * `/account/orders/[id]` is useless to a guest — there is no session to
 * scope it by — and order rows are service-role-only, so a guest client
 * cannot read its own order directly. The token issued at checkout is
 * the capability that stands in for a login: it is checked against this
 * one checkout session, and grants sight of that order and nothing else.
 *
 * Anything missing or mismatched is a 404 rather than a distinct error,
 * so this can't be used to probe which session ids exist.
 */
export default async function GuestOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { sessionId } = await params;
  const { t: token } = await searchParams;
  if (!token) notFound();

  const admin = createSupabaseAdminClient();

  const { data: session } = await admin
    .from('checkout_sessions')
    .select('id, metadata')
    .eq('id', sessionId)
    .maybeSingle();

  const expected = (session?.metadata as { guestToken?: string } | null)?.guestToken;
  if (!session || !expected || expected !== token) notFound();

  const { data: order } = await admin
    .from('orders')
    .select(
      'id, order_number, status, payment_method, subtotal, delivery_fee, tax_total, grand_total, created_at, order_snapshot, order_items(product_name, quantity, line_total), invoices(invoice_number, invoice_url)',
    )
    .eq('checkout_session_id', sessionId)
    .maybeSingle();

  if (!order) notFound();

  const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
  const items = order.order_items ?? [];
  const snapshot = order.order_snapshot as {
    delivery?: Record<string, string | null>;
    address?: { flatNo?: string; formattedAddress?: string };
  };
  const delivery = snapshot?.delivery;

  return (
    <div className="container-brand space-y-8 py-10">
      <div>
        <p className="eyebrow">Order confirmed</p>
        <h1 className="text-h2 text-foreground mt-2 font-bold">{order.order_number}</h1>
        <p className="text-body text-muted-foreground mt-1">
          Thank you — we&rsquo;ve got it. A confirmation has been emailed to you.
        </p>
        <p className="text-caption text-muted-foreground mt-3">
          Bookmark this page: it&rsquo;s how you check this order without an account. Creating one
          with the same email address will add it to your order history.
        </p>
      </div>

      <Card className="rounded-card">
        <CardHeader>
          <h2 className="text-h4 text-foreground font-semibold">Order details</h2>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-caption text-muted-foreground">Order date</dt>
              <dd className="text-body">{formatDate(order.created_at)}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Payment method</dt>
              <dd className="text-body">
                {order.payment_method === 'cod' ? 'Cash on delivery' : 'Paid online'}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Delivery date</dt>
              <dd className="text-body">{formatDate(delivery?.['date'])}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Delivery time</dt>
              <dd className="text-body">{delivery?.['slotLabel'] ?? 'Not yet scheduled'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-caption text-muted-foreground">Delivery address</dt>
              <dd>
                <DeliveryAddress
                  flatNo={snapshot?.address?.flatNo}
                  formattedAddress={snapshot?.address?.formattedAddress}
                />
              </dd>
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
