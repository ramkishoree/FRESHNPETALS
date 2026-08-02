import type { Metadata } from 'next';
import { LegalPage } from '@/components/storefront/legal-page';

export const metadata: Metadata = { title: 'Privacy Policy | Fresh & Petals' };

/** Copy carried over verbatim from the `static_pages` row this replaced.
 * NOTE: still the placeholder text that shipped with the demo data —
 * replace it with your real policy before taking payments at volume. */
const PARAGRAPHS = [
  'This is placeholder demo content — replace with your actual privacy policy before launch.',
  'We collect only the information needed to process and deliver your order: name, delivery address, phone number, and payment confirmation from our payment processor. We never sell customer data to third parties.',
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" paragraphs={PARAGRAPHS} />;
}
