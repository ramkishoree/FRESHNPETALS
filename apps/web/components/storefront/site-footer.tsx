import Link from 'next/link';

/** Ch.12 §15 Homepage Structure footer slot + Ch.6 static-page IA (About/Contact/Privacy/Terms/FAQ/Delivery Policy). */
export function SiteFooter() {
  return (
    <footer className="border-border bg-secondary border-t">
      <div className="container-brand grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <p className="text-h4 text-foreground font-bold">Fresh &amp; Petals</p>
          <p className="text-body text-muted-foreground">
            Premium flower delivery, fresh and on time.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-body text-foreground font-semibold">Shop</p>
          <FooterLink href="/shop">All products</FooterLink>
          <FooterLink href="/blog">Blog</FooterLink>
        </div>

        <div className="space-y-2">
          <p className="text-body text-foreground font-semibold">Company</p>
          <FooterLink href="/about">About us</FooterLink>
          <FooterLink href="/contact">Contact</FooterLink>
          <FooterLink href="/faq">FAQ</FooterLink>
          <FooterLink href="/delivery-policy">Delivery policy</FooterLink>
        </div>

        <div className="space-y-2">
          <p className="text-body text-foreground font-semibold">Legal</p>
          <FooterLink href="/privacy">Privacy policy</FooterLink>
          <FooterLink href="/terms">Terms of service</FooterLink>
        </div>
      </div>
      <div className="border-border border-t py-4">
        <p className="container-brand text-caption text-muted-foreground">
          © {new Date().getFullYear()} Fresh &amp; Petals. Powered by Prana Commerce OS.
        </p>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-body text-muted-foreground hover:text-foreground block">
      {children}
    </Link>
  );
}
