import type { Order, OrderRepository, OrderStatus } from '@prana/commerce';
import type { PagedResult, Pagination } from '@prana/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const SELECT_COLUMNS =
  'id, order_number, customer_id, outlet_id, status, grand_total, notes, created_at';

interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string;
  outlet_id: string;
  status: OrderStatus;
  grand_total: string | number;
  notes: string | null;
  created_at: string;
}

function mapRow(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    outletId: row.outlet_id,
    status: row.status,
    grandTotal: Number(row.grand_total),
    notes: row.notes,
  };
}

export class SupabaseOrderRepository implements OrderRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: string): Promise<Order | null> {
    const { data, error } = await this.client
      .from('orders')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(data as unknown as OrderRow) : null;
  }

  async findMany(pagination: Pagination): Promise<PagedResult<Order>> {
    let query = this.client
      .from('orders')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(pagination.limit);
    if (pagination.cursor) query = query.lt('created_at', pagination.cursor);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as OrderRow[];
    const items = rows.map(mapRow);
    const nextCursor = rows.length === pagination.limit ? (rows.at(-1)?.created_at ?? null) : null;
    return { items, nextCursor };
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    actorId: string,
    notes?: string,
  ): Promise<Order> {
    const { data, error } = await this.client.rpc('admin_update_order_status', {
      p_order_id: id,
      p_new_status: status,
      p_actor_id: actorId,
      p_notes: notes ?? null,
    });
    if (error) throw new Error(error.message);
    return mapRow(data as unknown as OrderRow);
  }

  async updateNotes(id: string, notes: string): Promise<Order> {
    const { data, error } = await this.client
      .from('orders')
      .update({ notes })
      .eq('id', id)
      .select(SELECT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as unknown as OrderRow);
  }
}
