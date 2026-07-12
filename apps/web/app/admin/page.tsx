import { AlertTriangle, Package, ShoppingCart, Users } from 'lucide-react';
import Link from 'next/link';
import { StatTile } from '@/components/dashboard/stat-tile';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDateTime } from '@/lib/format-date';

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Ch.12 §44 Dashboard Homepage. Reads straight from Supabase (Server
 * Component) rather than round-tripping through /api/v1/admin/dashboard
 * — that HTTP endpoint exists for external/future consumers (Telegram
 * assistant, mobile app), not for this page to call itself over the
 * network. "AI Recommendations"/"Pending AI Tasks" aren't rendered: no
 * agent exists yet to produce them (Phase 11).
 */
export default async function AdminDashboardPage() {
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
        .limit(8),
    ]);

  const todaysRevenue = (ordersToday.data ?? []).reduce(
    (sum, row) => sum + Number(row.grand_total),
    0,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-h2 text-foreground font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Today's revenue" value={formatInr(todaysRevenue)} />
        <StatTile label="Today's orders" value={String(ordersToday.count ?? 0)} />
        <StatTile label="Active customers" value={String(activeCustomers.count ?? 0)} />
        <StatTile label="Pending deliveries" value={String(pendingDeliveries.count ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-card lg:col-span-2">
          <CardHeader>
            <h2 className="text-h4 text-foreground font-semibold">Recent activity</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {(recentEvents.data ?? []).length === 0 && (
              <p className="text-body text-muted-foreground">No activity recorded yet.</p>
            )}
            {(recentEvents.data ?? []).map((event) => (
              <div
                key={event.id as string}
                className="text-body flex items-center justify-between gap-2"
              >
                <span className="text-foreground">{event.event_type as string}</span>
                <span className="text-caption text-muted-foreground">
                  {formatDateTime(event.created_at as string)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-card">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="text-warning size-4" aria-hidden="true" />
            <h2 className="text-h4 text-foreground font-semibold">Inventory alerts</h2>
          </CardHeader>
          <CardContent>
            <p className="text-hero text-foreground font-bold">{lowStock.count ?? 0}</p>
            <p className="text-caption text-muted-foreground">
              Items at or below 10 units available
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction href="/admin/products" icon={Package} label="Add product" />
        <QuickAction href="/admin/orders" icon={ShoppingCart} label="View orders" />
        <QuickAction href="/admin/customers" icon={Users} label="View customers" />
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Package;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-card border-border text-body text-foreground hover:bg-muted flex items-center gap-3 border p-4 font-medium transition-colors"
    >
      <Icon className="text-muted-foreground size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
