'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface OfferRow extends Record<string, unknown> {
  id: string;
  name: string;
  coupon_code: string | null;
  ends_at: string | null;
  active: boolean;
}

const columns: ColumnDef<OfferRow>[] = [
  { accessorKey: 'name', header: 'Offer' },
  {
    accessorKey: 'coupon_code',
    header: 'Code',
    cell: ({ row }) => row.original.coupon_code ?? '—',
  },
  {
    accessorKey: 'ends_at',
    header: 'Ends',
    cell: ({ row }) =>
      row.original.ends_at
        ? new Date(row.original.ends_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })
        : '—',
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={row.original.active ? 'text-success-text' : 'text-muted-foreground'}
      >
        {row.original.active ? 'Live' : 'Off'}
      </Badge>
    ),
  },
];

/**
 * Ch.16 §103 Offer Management API — rewritten as something a florist
 * fills in, not a pricing-engine control panel.
 *
 * It used to ask for an offer type, a priority number and two raw JSON
 * blobs. Those drive the automatic discount engine, which still exists
 * and still runs for offers created that way; but nobody sets up a
 * Diwali promotion by writing `{"minSubtotal": 999}` into a JSON field.
 *
 * What is written here is **advertised, not applied**: the offer shows a
 * coupon code the customer types at checkout. That is deliberate — the
 * person writing marketing copy should not be able to change what
 * customers are charged by accident. `display_only` is what enforces it,
 * and `resolveActiveOffer` filters on it.
 */
export function OffersPageContent() {
  return (
    <AdminResourcePage
      title="Offers"
      singularLabel="Offer"
      description="Shows as a banner across the site, a badge customers can tap, and a poster with the full terms."
      endpoint="/api/v1/admin/offers"
      columns={columns}
      searchPlaceholder="Search offers..."
      fields={[
        {
          name: 'name',
          label: 'Offer name (for you)',
          type: 'text',
          required: true,
          placeholder: 'Diwali 2026',
        },
        {
          name: 'tagline',
          label: 'Offer tagline',
          type: 'text',
          placeholder: 'Flat 20% off everything',
          helperText: 'The headline. Shown on the badge and at the top of the poster.',
        },
        {
          name: 'banner_heading',
          label: 'Banner heading',
          type: 'text',
          placeholder: 'Diwali offer is live',
          helperText: 'The one line that runs across the top of every page.',
        },
        {
          name: 'coupon_code',
          label: 'Coupon code',
          type: 'text',
          placeholder: 'DIWALI20',
          helperText: 'Customers type this at checkout. Create it under Coupons first.',
        },
        { name: 'starts_at', label: 'Starts at', type: 'datetime' },
        { name: 'ends_at', label: 'Ends at', type: 'datetime' },
        {
          name: 'conditions_text',
          label: 'Conditions',
          type: 'textarea',
          placeholder:
            'Minimum order ₹999. Not valid with other offers. Same-day delivery only within Lucknow.',
          helperText: 'Write these however you like — shown in full on the poster.',
        },
        { name: 'active', label: 'Live on the site', type: 'boolean' },
      ]}
    />
  );
}
