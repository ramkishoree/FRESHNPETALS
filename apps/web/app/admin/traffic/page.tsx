import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Moved off the dashboard, not deleted.
 *
 * The owner asked for the dashboard to be nothing but navigation tiles,
 * but had previously and deliberately asked for a traffic view inside
 * admin (overriding the standing "no analytics in the admin panel"
 * rule). Deleting it would quietly undo that decision, so it lives here
 * behind its own tile instead.
 */
export default async function AdminTrafficPage() {
  const admin = createSupabaseAdminClient();

  const [daily, topPages] = await Promise.all([
    admin
      .from('site_traffic_daily')
      .select('date, page_views')
      .order('date', { ascending: false })
      .limit(30),
    admin
      .from('site_traffic_page_daily')
      .select('path, page_views')
      .order('page_views', { ascending: false })
      .limit(10),
  ]);

  const days = [...(daily.data ?? [])].reverse();
  const todaysPageViews = days.at(-1)?.page_views ?? 0;
  const weekPageViews = days.slice(-7).reduce((sum, row) => sum + row.page_views, 0);
  const maxDayViews = Math.max(1, ...days.map((row) => row.page_views));

  return (
    <div className="space-y-6">
      <h1 className="text-h2 text-foreground font-bold">Traffic</h1>

      <Card className="rounded-card">
        <CardHeader className="flex flex-row items-center gap-2">
          <TrendingUp className="text-muted-foreground size-4" aria-hidden="true" />
          <h2 className="text-h4 text-foreground font-semibold">Page views</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-6">
            <div>
              <p className="text-hero text-foreground font-bold">{todaysPageViews}</p>
              <p className="text-caption text-muted-foreground">Today</p>
            </div>
            <div>
              <p className="text-h3 text-foreground font-semibold">{weekPageViews}</p>
              <p className="text-caption text-muted-foreground">Last 7 days</p>
            </div>
          </div>

          {days.length > 0 ? (
            <div className="mt-6 flex items-end gap-1" style={{ height: 96 }}>
              {days.map((row) => (
                <div key={row.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="bg-primary/70 w-full rounded-sm"
                    style={{ height: `${Math.max(4, (row.page_views / maxDayViews) * 84)}px` }}
                    title={`${row.date}: ${row.page_views} views`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-caption text-muted-foreground mt-3">
              No traffic recorded yet — data appears after the first storefront visit.
            </p>
          )}
          {days.length > 0 && (
            <p className="text-caption text-muted-foreground mt-2">Last {days.length} days</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-card">
        <CardHeader>
          <h2 className="text-h4 text-foreground font-semibold">Most visited pages</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          {(topPages.data ?? []).length === 0 && (
            <p className="text-body text-muted-foreground">Nothing recorded yet.</p>
          )}
          {(topPages.data ?? []).map((row) => (
            <div
              key={row.path as string}
              className="text-body flex items-center justify-between gap-3"
            >
              <span className="text-foreground truncate">{row.path as string}</span>
              <span className="text-caption text-muted-foreground shrink-0">
                {row.page_views as number} views
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
