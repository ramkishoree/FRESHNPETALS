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

export const metadata: Metadata = {
  title: 'Fresh & Petals',
  description: 'Fresh N Petals — serving flowers in Lucknow since 2021.',
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
