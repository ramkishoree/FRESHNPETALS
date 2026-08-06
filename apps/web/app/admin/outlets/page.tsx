import { OutletManagementPanel } from '@/components/admin/outlet-management-panel';

/**
 * Outlets used to live in a collapsed `<details>` at the bottom of the
 * Products page, which is why a newly added store was reported as
 * impossible to find or rename. Store locations are infrequent to edit
 * but consequential when you do — they decide which stock a customer can
 * buy and what the delivery fee is — so they get a page.
 */
export default function AdminOutletsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 text-foreground font-bold">Outlets</h1>
        <p className="text-body text-muted-foreground mt-1">
          Your stores. Each one carries its own stock and delivery radius, and can be linked to a
          Google Business Profile for reviews.
        </p>
      </div>
      <OutletManagementPanel />
    </div>
  );
}
