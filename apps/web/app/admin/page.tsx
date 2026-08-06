import Link from 'next/link';
import { ADMIN_DASHBOARD_TILES } from '@/components/admin/admin-nav-config';

/**
 * Ch.12 §44 Dashboard Homepage — owner's explicit call: tiles only.
 *
 * It previously opened on revenue, traffic, recent activity and
 * inventory alerts. None of that is what the dashboard is used for
 * day to day; it was four scroll-lengths between landing here and
 * reaching Orders. Every metric moved to the page it belongs to
 * (traffic to /admin/traffic, stock to Products), leaving one job:
 * get to the right section in a single tap.
 *
 * Tiles come from the same list as the sidebar, so a section can never
 * exist in one and not the other.
 */
export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 text-foreground font-bold">Dashboard</h1>
        <p className="text-body text-muted-foreground mt-1">Where would you like to go?</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_DASHBOARD_TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className="rounded-card border-border hover:border-primary hover:bg-muted/40 focus-visible:ring-ring flex items-start gap-4 border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="bg-muted text-foreground rounded-button grid size-11 shrink-0 place-items-center">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="text-h4 text-foreground block font-semibold">{tile.label}</span>
                <span className="text-caption text-muted-foreground block">{tile.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
