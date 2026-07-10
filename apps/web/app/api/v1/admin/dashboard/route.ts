import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/**
 * GET /api/v1/admin/dashboard — Ch.16 §92 + Ch.12 §44 Dashboard Homepage.
 * "AI Recommendations" isn't populated here — Phase 11 builds the agents
 * that would produce them; every other widget is a real aggregate query.
 */
const getDashboard = createApiRoute({
  handler: async () => {
    const admin = createSupabaseAdminClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [ordersToday, activeCustomers, pendingDeliveries, lowStock, recentEvents] =
      await Promise.all([
        admin
          .from('orders')
          .select('grand_total', { count: 'exact' })
          .gte('created_at', todayStart.toISOString()),
        admin.from('customers').select('id', { count: 'exact', head: true }),
        admin
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['confirmed', 'preparing', 'ready', 'out_for_delivery']),
        admin
          .from('inventory')
          .select('id', { count: 'exact', head: true })
          .lte('available_quantity', 10),
        admin
          .from('event_store')
          .select('id, event_type, aggregate_type, severity, created_at')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

    for (const result of [
      ordersToday,
      activeCustomers,
      pendingDeliveries,
      lowStock,
      recentEvents,
    ]) {
      if (result.error) {
        return err(
          new InfrastructureError('Failed to load dashboard.', { cause: result.error.message }),
        );
      }
    }

    const todaysRevenue = (ordersToday.data ?? []).reduce(
      (sum, row) => sum + Number(row.grand_total),
      0,
    );

    return ok({
      todaysRevenue,
      todaysOrders: ordersToday.count ?? 0,
      activeCustomers: activeCustomers.count ?? 0,
      pendingDeliveries: pendingDeliveries.count ?? 0,
      inventoryAlerts: lowStock.count ?? 0,
      recentActivity: recentEvents.data ?? [],
    });
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return getDashboard(request);
}
