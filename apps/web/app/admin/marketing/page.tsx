'use client';

import * as React from 'react';
import { AnnouncementsPageContent } from '@/components/admin/announcements-page-content';
import { CouponsPageContent } from '@/components/admin/coupons-page-content';
import { OffersPageContent } from '@/components/admin/offers-page-content';

const TABS = [
  { key: 'sale', label: 'Run a sale', render: () => <OffersPageContent /> },
  { key: 'coupon', label: 'Run a coupon', render: () => <CouponsPageContent /> },
  { key: 'popup', label: 'Run a popup campaign', render: () => <AnnouncementsPageContent /> },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/**
 * Owner's explicit call: Sales (Offers/Coupons) and Marketing
 * (Announcements) were three separate nav destinations for what the
 * owner experiences as one job — "run a promotion" — each doing
 * identical CRUD-form work on a different table. This page is the
 * single entry point; each tab renders the exact same
 * AdminResourcePage config those standalone pages always used (same
 * endpoint, same fields, same checkout/offer-engine behavior), just
 * reached from one screen instead of three.
 */
export default function MarketingPage() {
  const [tab, setTab] = React.useState<TabKey>('sale');

  return (
    <div className="space-y-6">
      <div className="border-border flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-[var(--r-md)] px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {TABS.find((t) => t.key === tab)?.render()}
    </div>
  );
}
