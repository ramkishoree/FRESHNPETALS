'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface DeliverySlotRow extends Record<string, unknown> {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_bookings: number;
  is_active: boolean;
}

const columns: ColumnDef<DeliverySlotRow>[] = [
  { accessorKey: 'label', header: 'Label' },
  { accessorKey: 'start_time', header: 'Start' },
  { accessorKey: 'end_time', header: 'End' },
  {
    id: 'capacity',
    header: 'Capacity',
    cell: ({ row }) => `${row.original.current_bookings} / ${row.original.max_capacity}`,
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={row.original.is_active ? 'text-success-text' : 'text-muted-foreground'}
      >
        {row.original.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

/** Ch.16 §106 Delivery Slot Management API. */
export default function DeliverySlotsPage() {
  return (
    <AdminResourcePage
      title="Delivery slots"
      singularLabel="Delivery slot"
      description="Time windows and capacity per delivery group."
      endpoint="/api/v1/admin/delivery-slots"
      columns={columns}
      fields={[
        {
          name: 'delivery_group_id',
          label: 'Delivery group ID',
          type: 'text',
          required: true,
          placeholder: 'uuid',
        },
        {
          name: 'label',
          label: 'Label',
          type: 'text',
          required: true,
          placeholder: '9 AM - 12 PM',
        },
        {
          name: 'start_time',
          label: 'Start time',
          type: 'text',
          required: true,
          placeholder: '09:00',
        },
        { name: 'end_time', label: 'End time', type: 'text', required: true, placeholder: '12:00' },
        { name: 'max_capacity', label: 'Max capacity', type: 'number', required: true },
        { name: 'is_active', label: 'Active', type: 'boolean' },
      ]}
    />
  );
}
