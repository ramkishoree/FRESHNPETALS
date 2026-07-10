import type {
  AdminInventoryAdjustment,
  InventoryRecord,
  InventoryRepository,
} from '@prana/commerce';
import type { PagedResult, Pagination } from '@prana/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const SELECT_COLUMNS =
  'id, product_id, outlet_id, physical_quantity, reserved_quantity, available_quantity, low_stock_threshold, critical_threshold, reorder_quantity, created_at';

interface InventoryRow {
  id: string;
  product_id: string;
  outlet_id: string;
  physical_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  low_stock_threshold: number;
  critical_threshold: number;
  reorder_quantity: number;
  created_at: string;
}

function mapRow(row: InventoryRow): InventoryRecord {
  return {
    id: row.id,
    productId: row.product_id,
    outletId: row.outlet_id,
    physicalQuantity: row.physical_quantity,
    reservedQuantity: row.reserved_quantity,
    availableQuantity: row.available_quantity,
    lowStockThreshold: row.low_stock_threshold,
    criticalThreshold: row.critical_threshold,
    reorderQuantity: row.reorder_quantity,
  };
}

export class SupabaseInventoryRepository implements InventoryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: string): Promise<InventoryRecord | null> {
    const { data, error } = await this.client
      .from('inventory')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(data as unknown as InventoryRow) : null;
  }

  async findByProductAndOutlet(
    productId: string,
    outletId: string,
  ): Promise<InventoryRecord | null> {
    const { data, error } = await this.client
      .from('inventory')
      .select(SELECT_COLUMNS)
      .eq('product_id', productId)
      .eq('outlet_id', outletId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(data as unknown as InventoryRow) : null;
  }

  async findMany(pagination: Pagination): Promise<PagedResult<InventoryRecord>> {
    let query = this.client
      .from('inventory')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(pagination.limit);
    if (pagination.cursor) query = query.lt('created_at', pagination.cursor);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as InventoryRow[];
    const items = rows.map(mapRow);
    const nextCursor = rows.length === pagination.limit ? (rows.at(-1)?.created_at ?? null) : null;
    return { items, nextCursor };
  }

  async adjust(
    inventoryId: string,
    adjustment: AdminInventoryAdjustment,
    actorId: string,
  ): Promise<InventoryRecord> {
    const { data, error } = await this.client.rpc('admin_adjust_inventory', {
      p_inventory_id: inventoryId,
      p_transaction_type: adjustment.transactionType,
      p_quantity_delta: adjustment.quantityDelta,
      p_actor_id: actorId,
      p_reason: adjustment.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return mapRow(data as unknown as InventoryRow);
  }
}
