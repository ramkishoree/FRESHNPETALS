import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDate } from '@/lib/format-date';

export interface InvoiceLineItem {
  name: string;
  quantity: number;
  lineTotal: number;
}

export interface InvoicePreviewProps {
  invoiceNumber: string;
  issuedAt: string;
  items: InvoiceLineItem[];
  subtotal: number;
  taxTotal: number;
  deliveryFee: number;
  grandTotal: number;
  invoiceUrl?: string | null;
  currency?: string;
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Ch.12 §82. Ch.10 §52: invoices are versioned — this always renders one
 * immutable version's data, never a live-recalculated total.
 */
export function InvoicePreview({
  invoiceNumber,
  issuedAt,
  items,
  subtotal,
  taxTotal,
  deliveryFee,
  grandTotal,
  invoiceUrl,
  currency = 'INR',
}: InvoicePreviewProps) {
  return (
    <Card className="rounded-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <p className="text-foreground font-semibold">{invoiceNumber}</p>
          <time dateTime={issuedAt} className="text-caption text-muted-foreground">
            Issued {formatDate(issuedAt)}
          </time>
        </div>
        {invoiceUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={invoiceUrl} download>
              <Download aria-hidden="true" />
              Download
            </a>
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="text-body flex justify-between">
            <span>
              {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
            </span>
            <span>{formatAmount(item.lineTotal, currency)}</span>
          </div>
        ))}
      </CardContent>

      <Separator />

      <CardFooter className="flex flex-col gap-1">
        <div className="text-caption text-muted-foreground flex w-full justify-between">
          <span>Subtotal</span>
          <span>{formatAmount(subtotal, currency)}</span>
        </div>
        <div className="text-caption text-muted-foreground flex w-full justify-between">
          <span>Delivery</span>
          <span>{formatAmount(deliveryFee, currency)}</span>
        </div>
        <div className="text-caption text-muted-foreground flex w-full justify-between">
          <span>Tax</span>
          <span>{formatAmount(taxTotal, currency)}</span>
        </div>
        <div className="text-h4 text-foreground mt-2 flex w-full justify-between font-semibold">
          <span>Total</span>
          <span>{formatAmount(grandTotal, currency)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
