import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { headers } from 'next/headers';
import { CartProvider } from '@/lib/cart-context';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

// Owner's explicit call: drop the Fraunces/Newsreader serif pairing for a
// plain, formal, highly legible face — Arial. It is installed on
// effectively every device, so there is no @font-face, no network
// request, no swap flash and no layout shift while a webfont loads. The
// storefront's --font-display/--font-body vars now resolve to that stack
// directly in styles/storefront-theme.css.

/** Origin serving every product image — preconnected in <head>. */
const SUPABASE_ORIGIN = new URL(process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'https://supabase.co')
  .origin;

const SITE_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://freshnpetals.in';

/**
 * Site-wide metadata.
 *
 * `metadataBase` is the load-bearing part: without it Next cannot turn
 * the relative `alternates.canonical` each page declares into an
 * absolute URL, and no page had a canonical tag at all before this. A
 * catalogue that answers on `/`, `/?sort=price_asc` and `/?sort=newest`
 * is three URLs with the same products on them, which is exactly the
 * duplication a canonical exists to resolve.
 *
 * The title is a template rather than a constant so every page reads as
 * "<what this page is> | Fresh N Petals — Florist in Lucknow" without
 * each one restating the brand.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Fresh N Petals — Flower Shop & Florist in Lucknow | Same-Day Delivery',
    template: '%s | Fresh N Petals — Florist in Lucknow',
  },
  description:
    'Buy flowers online in Lucknow from Fresh N Petals. Fresh bouquets, baskets, chocolate bouquets, indoor plants and gifts, with same-day delivery from our Gomti Nagar and Arjunganj shops. Serving Lucknow since 2021.',
  applicationName: 'Fresh N Petals',
  keywords: [
    'flower shop Lucknow',
    'florist Lucknow',
    'flowers near me',
    'buy flowers online',
    'online flower delivery Lucknow',
    'bouquet delivery Lucknow',
    'flowers Gomti Nagar',
    'flowers Arjunganj',
    'flower delivery Gomti Nagar',
    'same day flower delivery Lucknow',
  ],
  authors: [{ name: 'Fresh N Petals' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Fresh N Petals',
    locale: 'en_IN',
    url: SITE_URL,
    title: 'Fresh N Petals — Flower Shop & Florist in Lucknow',
    description:
      'Fresh bouquets, baskets and gifts delivered across Lucknow the same day. Two shops: Gomti Nagar and Arjunganj.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fresh N Petals — Flower Shop & Florist in Lucknow',
    description: 'Fresh bouquets, baskets and gifts delivered across Lucknow the same day.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  category: 'shopping',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // proxy.ts mints this per-request so next-themes' anti-flash script
  // (the one raw inline <script> this app injects itself) can carry the
  // same nonce as the CSP header's `script-src`, instead of tripping it.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Every product photo comes from Supabase Storage, so the TLS
            handshake to that origin is on the critical path for the LCP
            image. Opening it alongside the document rather than after
            the HTML has parsed removes a round trip from first paint. */}
        <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="" />
        <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
      </head>
      <body>
        {/* Ch.5.27: dark mode architecture must exist but stays dormant in
            v1 — defaultTheme "light" with system detection off means this
            never activates `.dark` on its own; it only makes next-themes'
            useTheme() (which the shadcn Toaster depends on) resolve to a
            real value instead of undefined. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          {...(nonce !== undefined ? { nonce } : {})}
        >
          <CartProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </CartProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
