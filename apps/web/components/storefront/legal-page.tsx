import Link from 'next/link';
import { BUSINESS_DETAILS_COMPLETE } from '@/lib/legal/business-details';

/**
 * The four policy pages are the only content pages left on the site, and
 * the `static_pages` CMS table that used to back them was dropped along
 * with the rest of the admin CMS. Their copy now lives in the page files
 * that render through here — editing it is a code change, which is the
 * accepted trade for removing the CMS.
 *
 * Legal copy needs structure the old flat-paragraph version couldn't
 * express: numbered clauses customers and Razorpay can cite, and lists.
 * A `string` in a section body is a paragraph; a `string[]` is a bullet
 * list.
 */
export type LegalBlock = string | string[];

export interface LegalSection {
  heading: string;
  body: LegalBlock[];
}

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  /** ISO date. Rendered as "Last updated 2 August 2026". */
  updated: string;
  intro?: LegalBlock[];
  sections: LegalSection[];
}) {
  return (
    <div className="container-brand max-w-3xl py-10">
      <h1 className="text-h2 text-foreground font-bold">{title}</h1>
      <p className="text-caption text-muted-foreground mt-2">
        Last updated{' '}
        {new Date(updated).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>

      {/* A policy naming TODO_PROPRIETOR_FULL_LEGAL_NAME still reads as
          authoritative to a customer skimming it. Make the gap loud
          rather than letting a half-filled document look finished. */}
      {!BUSINESS_DETAILS_COMPLETE && (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body text-foreground mt-6 border-l-4 py-3 pl-4"
        >
          <strong>Draft — not yet in force.</strong> The business registration details in this
          policy are placeholders. Fill in{' '}
          <code className="text-caption">apps/web/lib/legal/business-details.ts</code> before
          relying on this document or submitting it for payment-gateway review.
        </p>
      )}

      {intro && <div className="mt-6 space-y-4">{intro.map(renderBlock)}</div>}

      {/* Numbered so a clause can be referred to as "clause 4" in a
          dispute, a refund conversation, or a payment-gateway review. */}
      <ol className="mt-8 space-y-8">
        {sections.map((section, index) => (
          <li key={section.heading}>
            <h2 className="text-h4 text-foreground font-semibold">
              {index + 1}. {section.heading}
            </h2>
            <div className="mt-3 space-y-4">{section.body.map(renderBlock)}</div>
          </li>
        ))}
      </ol>

      <p className="text-caption text-muted-foreground mt-12">
        See also our <LegalLink href="/privacy">Privacy Policy</LegalLink>,{' '}
        <LegalLink href="/terms">Terms of Service</LegalLink>,{' '}
        <LegalLink href="/shipping">Shipping &amp; Delivery Policy</LegalLink> and{' '}
        <LegalLink href="/refunds">Cancellation &amp; Refund Policy</LegalLink>.
      </p>
    </div>
  );
}

function renderBlock(block: LegalBlock, index: number) {
  if (Array.isArray(block)) {
    return (
      <ul key={index} className="text-body text-foreground list-disc space-y-2 pl-5">
        {block.map((item, itemIndex) => (
          <li key={itemIndex}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <p key={index} className="text-body text-foreground whitespace-pre-line">
      {block}
    </p>
  );
}

function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="underline underline-offset-2">
      {children}
    </Link>
  );
}
