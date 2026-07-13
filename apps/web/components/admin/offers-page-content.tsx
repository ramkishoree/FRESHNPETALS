'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface OfferRow extends Record<string, unknown> {
  id: string;
  name: string;
  offer_type: string;
  priority: number;
  active: boolean;
}

const columns: ColumnDef<OfferRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'offer_type', header: 'Type' },
  { accessorKey: 'priority', header: 'Priority' },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={row.original.active ? 'text-success-text' : 'text-muted-foreground'}
      >
        {row.original.active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

/** Ch.16 §103 Offer Management API + Ch.8 §69-72 Offer Engine. */
export function OffersPageContent() {
  return (
    <AdminResourcePage
      title="Offers"
      singularLabel="Offer"
      description="Homepage banners, flash sales, and festival campaigns."
      endpoint="/api/v1/admin/offers"
      columns={columns}
      searchPlaceholder="Search offers..."
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        {
          name: 'offer_type',
          label: 'Offer type',
          type: 'select',
          required: true,
          options: [
            { label: 'Percentage', value: 'percentage' },
            { label: 'Fixed amount', value: 'fixed' },
            { label: 'Buy X get Y', value: 'buy_x_get_y' },
            { label: 'Free gift', value: 'free_gift' },
            { label: 'Free delivery', value: 'free_delivery' },
          ],
        },
        { name: 'priority', label: 'Priority (lower number = applies first)', type: 'number' },
        {
          name: 'conditions',
          label:
            'Conditions (JSON) — e.g. {"minCartValue": 999, "productIds": [...], "categoryIds": [...]}',
          type: 'json',
        },
        {
          name: 'reward',
          label:
            'Reward (JSON) — percentage/fixed: {"discountValue": 10, "maxDiscountAmount": 200}. ' +
            'buy_x_get_y: {"buyProductId": "...", "buyQuantity": 2, "getQuantity": 1} (same product). ' +
            'free_gift: {"giftProductId": "...", "giftQuantity": 1}. free_delivery: {} (no fields needed).',
          type: 'json',
        },
        { name: 'starts_at', label: 'Starts at', type: 'datetime' },
        { name: 'ends_at', label: 'Ends at', type: 'datetime' },
        { name: 'active', label: 'Active', type: 'boolean' },
      ]}
    />
  );
}
