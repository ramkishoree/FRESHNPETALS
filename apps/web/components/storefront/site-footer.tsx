import Link from 'next/link';

/**
 * Owner's explicit call: the site is Products / Orders / My Account and
 * nothing else, so the footer carries no second navigation of its own —
 * only the legal pages Razorpay's merchant terms require to stay
 * reachable, plus the copyright line.
 */
export function SiteFooter() {
  return (
    <footer className="border-border bg-secondary border-t">
      <div className="container-brand flex flex-wrap items-center justify-between gap-4 py-6">
        {/* One template string rather than JSX text around an expression:
            the latter renders as `2026<!-- -->Fresh` — React drops the
            separating space when the interpolation sits between text
            nodes, which is exactly what the old footer shipped. */}
        <p className="text-caption text-muted-foreground">
          {`© ${new Date().getFullYear()} Fresh & Petals. Powered by Prana Commerce OS.`}
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
