import type { Metadata } from 'next';
import { LegalPage } from '@/components/storefront/legal-page';

export const metadata: Metadata = { title: 'Terms of Service | Fresh & Petals' };

/** Copy carried over verbatim from the `static_pages` rows this replaced —
 * the old `terms` row plus the `delivery-policy` row, whose page was
 * removed but whose fee/slot terms still need to be stated somewhere.
 * NOTE: the first paragraph is still the placeholder text that shipped
 * with the demo data — replace it with your real terms before launch. */
const PARAGRAPHS = [
  'This is placeholder demo content — replace with your actual terms before launch.',
  'Orders are confirmed once payment is captured. Delivery windows are estimates based on outlet capacity and distance; same-day orders placed after 6 PM may be scheduled for next-day delivery.',
  'Delivery fee is calculated by distance from your nearest Fresh & Petals outlet: ₹50 for the first 5 km, plus ₹5 per additional km. Same-day delivery is available for orders placed before 6 PM, subject to outlet stock and delivery slot availability. Choose your preferred slot at checkout.',
];

export default function TermsPage() {
  return <LegalPage title="Terms of Service" paragraphs={PARAGRAPHS} />;
}
