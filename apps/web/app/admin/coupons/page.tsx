'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface CouponRow extends Record<string, unknown> {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  eligibility_type: string | null;
  times_used: number;
  active: boolean;
}

const columns: ColumnDef<CouponRow>[] = [
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'discount_type', header: 'Type' },
  { accessorKey: 'discount_value', header: 'Value' },
  { accessorKey: 'eligibility_type', header: 'Who' },
  { accessorKey: 'times_used', header: 'Times used' },
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

/** Ch.16 §102 Coupon Management API + Ch.8 §73-76 Coupon Engine. */
export default function CouponsPage() {
  return (
    <AdminResourcePage
      title="Coupons"
      singularLabel="Coupon"
      description="Discount codes customers redeem at checkout."
      endpoint="/api/v1/admin/coupons"
      columns={columns}
      searchPlaceholder="Search coupon codes..."
      fields={[
        { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'WELCOME10' },
        { name: 'description', label: 'Description', type: 'textarea' },
        {
          name: 'discount_type',
          label: 'Discount type',
          type: 'select',
          required: true,
          options: [
            { label: 'Percentage', value: 'percentage' },
            { label: 'Fixed amount', value: 'fixed' },
            { label: 'Free delivery', value: 'free_delivery' },
            { label: 'Free gift', value: 'free_gift' },
          ],
        },
        { name: 'discount_value', label: 'Discount value', type: 'number', required: true },
        {
          name: 'eligibility_type',
          label: 'Who can use it',
          type: 'select',
          options: [
            { label: 'Anyone', value: 'general' },
            { label: "First order only (customer's first order)", value: 'first_order' },
            {
              label: "Birthday month (needs the customer's date of birth on file)",
              value: 'birthday',
            },
            { label: 'Corporate (share the code privately)', value: 'corporate' },
            { label: 'Influencer (share the code privately)', value: 'influencer' },
            { label: 'Employee (share the code privately)', value: 'employee' },
          ],
        },
        { name: 'max_discount_amount', label: 'Max discount amount', type: 'number' },
        { name: 'min_cart_value', label: 'Minimum cart value', type: 'number' },
        { name: 'usage_limit_total', label: 'Total usage limit', type: 'number' },
        { name: 'usage_limit_per_user', label: 'Per-customer usage limit', type: 'number' },
        { name: 'starts_at', label: 'Starts at', type: 'datetime' },
        { name: 'ends_at', label: 'Ends at', type: 'datetime' },
        { name: 'active', label: 'Active', type: 'boolean' },
      ]}
    />
  );
}
