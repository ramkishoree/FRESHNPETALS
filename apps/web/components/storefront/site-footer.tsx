import Link from 'next/link';

export interface FooterOutlet {
  name: string;
  slug: string;
  area: string;
  address: string;
  city: string;
  phone: string | null;
}

/**
 * Owner's explicit call: the site is Products / Orders / My Account and
 * nothing else, so the footer carries no second navigation of its own —
 * only the legal pages Razorpay's merchant terms require to stay
 * reachable, plus the copyright line.
 *
 * The shop addresses are the one addition. A florist's name, address and
 * phone number appearing consistently on every page is the plainest
 * local-search signal there is, and the shop pages had no link into them
 * from anywhere on the site — a page nothing links to is a page a
 * crawler reaches late and weights lightly.
 */
export function SiteFooter({ outlets = [] }: { outlets?: FooterOutlet[] }) {
  return (
    <footer className="border-border bg-secondary border-t">
      {outlets.length > 0 && (
        <div className="container-brand grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-caption text-foreground font-semibold">Fresh N Petals</p>
            <p className="text-caption text-muted-foreground mt-1">
              Florist in Lucknow since 2021. Fresh bouquets, baskets, gift hampers and indoor
              plants, delivered across the city.
            </p>
          </div>
          {outlets.map((outlet) => (
            <div key={outlet.slug}>
              <p className="text-caption text-foreground font-semibold">
                <Link
                  href={`/flower-shop/${outlet.slug}`}
                  className="hover:text-[var(--gold-deep)]"
                >
                  Flower shop in {outlet.area}
                </Link>
              </p>
              <address className="text-caption text-muted-foreground mt-1 not-italic">
                {outlet.address}
                <br />
                {outlet.city}
                {outlet.phone && (
                  <>
                    <br />
                    <a href={`tel:${outlet.phone}`} className="hover:text-foreground">
                      {outlet.phone}
                    </a>
                  </>
                )}
              </address>
            </div>
          ))}
        </div>
      )}
      <div className="container-brand flex flex-wrap items-center justify-between gap-4 border-t border-[var(--sf-border)] py-6">
        <p className="text-caption text-muted-foreground">
          Fresh N Petals &mdash; Serving Flowers Since 2021
        </p>
        {/* Razorpay's merchant activation checklist looks for all four of
            these reachable from every page, and the Consumer Protection
            (E-Commerce) Rules 2020 require the delivery and refund terms
            to be published. */}
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
          <FooterLink href="/privacy">Privacy policy</FooterLink>
          <FooterLink href="/terms">Terms of service</FooterLink>
          <FooterLink href="/shipping">Shipping &amp; delivery</FooterLink>
          <FooterLink href="/refunds">Cancellation &amp; refunds</FooterLink>
        </nav>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-caption text-muted-foreground hover:text-foreground">
      {children}
    </Link>
  );
}
